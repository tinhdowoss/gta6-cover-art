// Photos stay on the person's machine: files are decoded with createImageBitmap, never uploaded.
// Each panel holds a crop { photoId, zoom, cx, cy }: cx/cy is the photo point (0..1) shown at the
// panel's centre, so a crop survives any re-flow of the layout to another size.

const MAX_PHOTO_EDGE = 2800;
let nextPhotoId = 1;

export async function loadPhotoFile(file) {
  let bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const longEdge = Math.max(bitmap.width, bitmap.height);
  if (longEdge > MAX_PHOTO_EDGE) {
    const k = MAX_PHOTO_EDGE / longEdge;
    const resized = await createImageBitmap(bitmap, {
      resizeWidth: Math.round(bitmap.width * k), resizeHeight: Math.round(bitmap.height * k), resizeQuality: 'high',
    });
    bitmap.close();
    bitmap = resized;
  }
  const focus = findPhotoFocusPoint(bitmap);
  return {
    id: nextPhotoId++,
    name: file.name || 'photo',
    bitmap,
    w: bitmap.width,
    h: bitmap.height,
    focus,
    thumbUrl: makePhotoThumbnail(bitmap),
  };
}

export async function loadPhotoFiles(fileList) {
  const files = [...fileList].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name));
  const out = [];
  for (const f of files) {
    try {
      out.push(await loadPhotoFile(f));
    } catch (err) {
      console.warn('Could not read', f.name, err);
    }
  }
  return out;
}

function makePhotoThumbnail(bitmap) {
  const c = document.createElement('canvas');
  const k = 160 / Math.max(bitmap.width, bitmap.height);
  c.width = Math.round(bitmap.width * k);
  c.height = Math.round(bitmap.height * k);
  c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

// Cheap saliency: weighted centroid of edge energy and colourfulness on a 64px copy, pulled toward
// the upper-middle where faces and subjects usually sit. Drives the "auto center crop".
export function findPhotoFocusPoint(bitmap) {
  const n = 64;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, n, n);
  const d = ctx.getImageData(0, 0, n, n).data;
  const lum = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) lum[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
  let sx = 0, sy = 0, sw = 0;
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + n] - lum[i - n];
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const centerBias = 1 - Math.hypot(x / n - 0.5, (y / n - 0.42) * 1.2) * 1.3;
      const w = (Math.hypot(gx, gy) + chroma * 0.25) * Math.max(0.05, centerBias);
      sx += x * w; sy += y * w; sw += w;
    }
  }
  if (!sw) return { x: 0.5, y: 0.45 };
  const fx = sx / sw / n;
  const fy = sy / sw / n;
  return { x: 0.5 + (fx - 0.5) * 0.85, y: 0.45 + (fy - 0.45) * 0.85 };
}

export function autoCenterCrop(photo) {
  return { photoId: photo.id, zoom: 1, cx: photo.focus.x, cy: photo.focus.y };
}

// Where to draw the photo so it covers the panel's box at the crop's zoom, centred on (cx, cy).
export function computePanelCropRect(photo, crop, box) {
  const cover = Math.max(box.w / photo.w, box.h / photo.h);
  const scale = cover * Math.max(1, crop.zoom || 1);
  const dw = photo.w * scale;
  const dh = photo.h * scale;
  let dx = box.x + box.w / 2 - crop.cx * dw;
  let dy = box.y + box.h / 2 - crop.cy * dh;
  dx = Math.min(box.x, Math.max(box.x + box.w - dw, dx));
  dy = Math.min(box.y, Math.max(box.y + box.h - dh, dy));
  return { dx, dy, dw, dh, scale };
}

// Keeps cx/cy inside the range that still covers the box, so dragging never "sticks" past an edge.
export function clampCropToPanel(photo, crop, box) {
  const r = computePanelCropRect(photo, crop, box);
  crop.cx = (box.x + box.w / 2 - r.dx) / r.dw;
  crop.cy = (box.y + box.h / 2 - r.dy) / r.dh;
  return crop;
}

// One photo, many panels: each panel gets a different crop (wide, mid, tight details), the
// "same scene, different angles" rhythm of a multi-panel poster.
const CROP_VARIATIONS = [
  { zoom: 1, ox: 0, oy: 0 },
  { zoom: 2.2, ox: 0, oy: -0.04 },
  { zoom: 1.5, ox: -0.22, oy: 0.08 },
  { zoom: 2.8, ox: 0.12, oy: 0.1 },
  { zoom: 1.7, ox: 0.25, oy: -0.1 },
  { zoom: 3.4, ox: -0.06, oy: 0.04 },
  { zoom: 1.25, ox: -0.3, oy: -0.15 },
  { zoom: 2.5, ox: 0.3, oy: 0.2 },
  { zoom: 1.9, ox: -0.15, oy: 0.25 },
];

export function fillAllPanelsFromOnePhoto(photo, panelCount) {
  return Array.from({ length: panelCount }, (_, i) => {
    const v = CROP_VARIATIONS[i % CROP_VARIATIONS.length];
    return {
      photoId: photo.id,
      zoom: v.zoom,
      cx: Math.min(0.95, Math.max(0.05, photo.focus.x + v.ox / v.zoom * 1.4)),
      cy: Math.min(0.95, Math.max(0.05, photo.focus.y + v.oy / v.zoom * 1.4)),
    };
  });
}

// Several photos: hand them out across panels; when panels outnumber photos, repeats get a tighter crop.
export function distributePhotosAcrossPanels(photos, panelCount) {
  if (!photos.length) return [];
  return Array.from({ length: panelCount }, (_, i) => {
    const photo = photos[i % photos.length];
    const round = Math.floor(i / photos.length);
    // The hero panel gets a slightly closer crop: big and close sells the poster.
    if (round === 0) return { ...autoCenterCrop(photo), zoom: i === 0 ? 1.15 : 1 };
    const v = CROP_VARIATIONS[(round * 3 + i) % CROP_VARIATIONS.length];
    return {
      photoId: photo.id,
      zoom: Math.max(1.8, v.zoom),
      cx: Math.min(0.9, Math.max(0.1, photo.focus.x + v.ox * 0.5)),
      cy: Math.min(0.9, Math.max(0.1, photo.focus.y + v.oy * 0.5)),
    };
  });
}
