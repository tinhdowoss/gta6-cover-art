// Sunset State Cover Studio: editor state, controls, live preview and PNG export.
import { COVER_SIZES, LAYOUT_CHOICES, computeTiltedPanelLayout, pointInPolygon, tracePolygonPath } from './layouts.js';
import { GRADE_PRESETS } from './grades.js';
import { LETTERING_FILLS } from './lettering.js';
import {
  loadPhotoFiles, autoCenterCrop, clampCropToPanel, fillAllPanelsFromOnePhoto, distributePhotosAcrossPanels,
} from './photos.js';
import { renderCoverArt } from './render.js';

const MAX_PANELS = 9;
const $ = (id) => document.getElementById(id);

// The default preset is the look we stand behind with zero tweaking.
const editorState = {
  size: '1920x1080',
  layout: 'hero',
  grade: { id: 'viceSunset', strength: 0.9, contrast: 0.06, saturation: 0.06, grain: 0.28, vignette: 0.5, halftone: false },
  caption: { title: 'SUNSET STATE', subtitle: 'Neon Tide', tagline: 'One coast · No rules · Coming soon' },
  lettering: { fill: 'cream', tilt: -5, badge: true, badgeText: 'ORIGINAL', subtitleStyle: 'script', extras: true },
  panels: new Array(MAX_PANELS).fill(null),
  selectedSlot: 0,
};

const photos = [];
const photosById = new Map();
const previewCanvas = $('coverPreviewCanvas');
const previewCtx = previewCanvas.getContext('2d');
let previewLayout = null;
let previewScale = 1;
let renderQueued = false;

function currentSize() {
  return COVER_SIZES.find((s) => s.id === editorState.size) || COVER_SIZES[0];
}

function currentPhotoPanelCount() {
  const s = currentSize();
  return computeTiltedPanelLayout(editorState.layout, s.w, s.h).photoPanelCount;
}

// ---------- live preview ----------

function sizePreviewCanvas() {
  const s = currentSize();
  const frame = $('previewFrame');
  const pad = 20;
  const availW = Math.max(100, frame.clientWidth - pad * 2);
  const availH = Math.max(100, frame.clientHeight - pad * 2);
  const k = Math.min(availW / s.w, availH / s.h);
  const cssW = Math.floor(s.w * k);
  const cssH = Math.floor(s.h * k);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  previewScale = Math.min(1, (cssW * dpr) / s.w);
  const pw = Math.round(s.w * previewScale);
  const ph = Math.round(s.h * previewScale);
  if (previewCanvas.width !== pw || previewCanvas.height !== ph) {
    previewCanvas.width = pw;
    previewCanvas.height = ph;
  }
  previewCanvas.style.width = `${cssW}px`;
  previewCanvas.style.height = `${cssH}px`;
}

function renderLivePreview() {
  renderQueued = false;
  sizePreviewCanvas();
  const w = previewCanvas.width;
  const h = previewCanvas.height;
  previewLayout = renderCoverArt(previewCtx, w, h, editorState, photosById, {
    highlightSlot: photos.length ? editorState.selectedSlot : -1,
  });
}

function requestPreviewRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(renderLivePreview);
}

function refreshEverything() {
  syncControlsFromState();
  requestPreviewRender();
}

// ---------- photos into panels ----------

async function addPhotosFromFiles(files, targetSlot = null) {
  const loaded = await loadPhotoFiles(files);
  if (!loaded.length) return;
  const hadPhotos = photos.length > 0;
  for (const p of loaded) {
    photos.push(p);
    photosById.set(p.id, p);
  }
  if (targetSlot != null && hadPhotos) {
    loaded.forEach((p, i) => {
      const slot = (targetSlot + i) % MAX_PANELS;
      editorState.panels[slot] = autoCenterCrop(p);
    });
    editorState.selectedSlot = targetSlot;
  } else if (photos.length === 1) {
    editorState.panels = padPanels(fillAllPanelsFromOnePhoto(photos[0], MAX_PANELS));
  } else {
    editorState.panels = padPanels(distributePhotosAcrossPanels(photos, MAX_PANELS));
  }
  setStatus(`${loaded.length} photo${loaded.length > 1 ? 's' : ''} added · drag panels to reposition`);
  renderPhotoTray();
  refreshEverything();
}

function padPanels(list) {
  const out = list.slice(0, MAX_PANELS);
  while (out.length < MAX_PANELS) out.push(null);
  return out;
}

function selectedCrop() {
  return editorState.panels[editorState.selectedSlot];
}

function renderPhotoTray() {
  const tray = $('photoTray');
  tray.textContent = '';
  photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'photo-thumb';
    b.title = `Put "${p.name}" in the selected panel`;
    b.dataset.photoId = String(p.id);
    const img = document.createElement('img');
    img.src = p.thumbUrl;
    img.alt = p.name;
    const tag = document.createElement('span');
    tag.textContent = String(i + 1);
    b.append(img, tag);
    b.addEventListener('click', () => {
      editorState.panels[editorState.selectedSlot] = autoCenterCrop(p);
      refreshEverything();
    });
    tray.append(b);
  });
  $('photoCount').textContent = `${photos.length} loaded`;
}

// ---------- controls ----------

function buildSizeTabs() {
  const nav = $('sizeTabs');
  for (const s of COVER_SIZES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn size-tab';
    b.dataset.size = s.id;
    b.innerHTML = `<span>${s.label}</span><small>${s.hint}</small>`;
    b.addEventListener('click', () => {
      editorState.size = s.id;
      drawLayoutPickerIcons();
      refreshEverything();
    });
    nav.append(b);
  }
}

function buildLayoutPicker() {
  const host = $('layoutPicker');
  for (const l of LAYOUT_CHOICES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'layout-choice';
    b.dataset.layout = l.id;
    b.title = l.hint;
    const c = document.createElement('canvas');
    c.width = 88;
    c.height = 64;
    const label = document.createElement('span');
    label.textContent = l.short || l.label;
    b.append(c, label);
    b.addEventListener('click', () => {
      editorState.layout = l.id;
      refreshEverything();
    });
    host.append(b);
  }
  drawLayoutPickerIcons();
}

// Mini diagrams of each layout at the current output ratio, so the picker shows the re-flow.
function drawLayoutPickerIcons() {
  const s = currentSize();
  document.querySelectorAll('.layout-choice canvas').forEach((c) => {
    const id = c.parentElement.dataset.layout;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const k = Math.min(c.width / s.w, c.height / s.h);
    const lay = computeTiltedPanelLayout(id, s.w, s.h);
    ctx.save();
    ctx.translate((c.width - s.w * k) / 2, (c.height - s.h * k) / 2);
    ctx.scale(k, k);
    ctx.fillStyle = '#0c0612';
    ctx.fillRect(0, 0, s.w, s.h);
    ctx.fillStyle = '#f7f3ee';
    ctx.fillRect(lay.content.x, lay.content.y, lay.content.w, lay.content.h);
    lay.panels.forEach((p, i) => {
      tracePolygonPath(ctx, p.poly);
      ctx.fillStyle = p.kind === 'title' ? '#ff8a3a' : ['#c0186a', '#5a1a7a', '#e2445a', '#3a1260'][i % 4];
      ctx.fill();
    });
    ctx.restore();
  });
}

function buildGradePicker() {
  const host = $('gradePicker');
  for (const [id, g] of Object.entries(GRADE_PRESETS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'grade-choice';
    b.dataset.grade = id;
    b.title = g.note;
    const sw = document.createElement('i');
    sw.style.background = `linear-gradient(90deg, ${g.swatch.join(', ')})`;
    const label = document.createElement('span');
    label.textContent = g.label;
    b.append(sw, label);
    b.addEventListener('click', () => {
      editorState.grade.id = id;
      refreshEverything();
    });
    host.append(b);
  }
}

function buildLetteringFillPicker() {
  const host = $('letteringFillPicker');
  for (const [id, f] of Object.entries(LETTERING_FILLS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fill-choice';
    b.dataset.fill = id;
    b.title = f.label;
    b.textContent = 'Aa';
    b.style.background = `linear-gradient(180deg, ${f.stops.join(', ')})`;
    b.addEventListener('click', () => {
      editorState.lettering.fill = id;
      refreshEverything();
    });
    host.append(b);
  }
}

function bindSlider(id, get, set, fmt = (v) => v.toFixed(2)) {
  const input = $(id);
  const out = input.parentElement.querySelector('output');
  input.addEventListener('input', () => {
    set(parseFloat(input.value));
    if (out) out.textContent = fmt(parseFloat(input.value));
    requestPreviewRender();
  });
  return { input, out, get, fmt };
}

const sliderBindings = [];

function bindAllControls() {
  sliderBindings.push(
    bindSlider('gradeStrengthSlider', () => editorState.grade.strength, (v) => (editorState.grade.strength = v)),
    bindSlider('gradeContrastSlider', () => editorState.grade.contrast, (v) => (editorState.grade.contrast = v)),
    bindSlider('gradeSaturationSlider', () => editorState.grade.saturation, (v) => (editorState.grade.saturation = v)),
    bindSlider('grainSlider', () => editorState.grade.grain, (v) => (editorState.grade.grain = v)),
    bindSlider('vignetteSlider', () => editorState.grade.vignette, (v) => (editorState.grade.vignette = v)),
    bindSlider('letteringTiltSlider', () => editorState.lettering.tilt, (v) => (editorState.lettering.tilt = v), (v) => `${v}°`),
  );
  $('halftoneToggle').addEventListener('change', (e) => { editorState.grade.halftone = e.target.checked; requestPreviewRender(); });
  $('originalBadgeToggle').addEventListener('change', (e) => { editorState.lettering.badge = e.target.checked; requestPreviewRender(); });
  $('posterExtrasToggle').addEventListener('change', (e) => { editorState.lettering.extras = e.target.checked; requestPreviewRender(); });
  $('subtitleStyleSelect').addEventListener('change', (e) => { editorState.lettering.subtitleStyle = e.target.value; requestPreviewRender(); });
  $('badgeTextInput').addEventListener('input', (e) => { editorState.lettering.badgeText = e.target.value; requestPreviewRender(); });
  $('captionTitleInput').addEventListener('input', (e) => { editorState.caption.title = e.target.value; requestPreviewRender(); });
  $('captionSubtitleInput').addEventListener('input', (e) => { editorState.caption.subtitle = e.target.value; requestPreviewRender(); });
  $('captionTaglineInput').addEventListener('input', (e) => { editorState.caption.tagline = e.target.value; requestPreviewRender(); });

  $('photoFileInput').addEventListener('change', (e) => {
    addPhotosFromFiles(e.target.files);
    e.target.value = '';
  });
  $('replacePanelPhotoButton').addEventListener('click', () => $('panelFileInput').click());
  $('panelFileInput').addEventListener('change', async (e) => {
    const slot = editorState.selectedSlot;
    const loaded = await loadPhotoFiles(e.target.files);
    e.target.value = '';
    if (!loaded.length) return;
    for (const p of loaded) { photos.push(p); photosById.set(p.id, p); }
    editorState.panels[slot] = autoCenterCrop(loaded[0]);
    renderPhotoTray();
    refreshEverything();
  });
  $('panelZoomSlider').addEventListener('input', (e) => {
    const crop = selectedCrop();
    if (!crop) return;
    crop.zoom = parseFloat(e.target.value);
    $('panelZoomValue').textContent = `${crop.zoom.toFixed(1)}×`;
    requestPreviewRender();
  });
  $('autoCenterCropButton').addEventListener('click', () => {
    const crop = selectedCrop();
    const photo = crop && photosById.get(crop.photoId);
    if (!photo) return;
    editorState.panels[editorState.selectedSlot] = autoCenterCrop(photo);
    refreshEverything();
  });
  $('fillAllFromPhotoButton').addEventListener('click', () => {
    const crop = selectedCrop();
    const photo = (crop && photosById.get(crop.photoId)) || photos[0];
    if (!photo) return;
    editorState.panels = padPanels(fillAllPanelsFromOnePhoto(photo, MAX_PANELS));
    setStatus(`Every panel now shows "${photo.name}" with its own crop`);
    refreshEverything();
  });
  $('spreadPhotosButton').addEventListener('click', () => {
    if (!photos.length) return;
    editorState.panels = padPanels(distributePhotosAcrossPanels(photos, MAX_PANELS));
    refreshEverything();
  });
  $('exportPngButton').addEventListener('click', () => exportCoverPng(currentSize()));
  $('exportAllSizesButton').addEventListener('click', exportAllCoverSizes);
  $('exportAllSizesButtonBottom').addEventListener('click', exportAllCoverSizes);
}

function syncControlsFromState() {
  document.querySelectorAll('.size-tab').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === editorState.size)));
  document.querySelectorAll('.layout-choice').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === editorState.layout)));
  document.querySelectorAll('.grade-choice').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.grade === editorState.grade.id)));
  document.querySelectorAll('.fill-choice').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fill === editorState.lettering.fill)));
  for (const s of sliderBindings) {
    const v = s.get();
    s.input.value = String(v);
    if (s.out) s.out.textContent = s.fmt(v);
  }
  $('halftoneToggle').checked = editorState.grade.halftone;
  $('originalBadgeToggle').checked = editorState.lettering.badge;
  $('posterExtrasToggle').checked = editorState.lettering.extras !== false;
  $('subtitleStyleSelect').value = editorState.lettering.subtitleStyle;
  if (document.activeElement !== $('badgeTextInput')) $('badgeTextInput').value = editorState.lettering.badgeText;
  if (document.activeElement !== $('captionTitleInput')) $('captionTitleInput').value = editorState.caption.title;
  if (document.activeElement !== $('captionSubtitleInput')) $('captionSubtitleInput').value = editorState.caption.subtitle;
  if (document.activeElement !== $('captionTaglineInput')) $('captionTaglineInput').value = editorState.caption.tagline;
  $('exportPngButton').textContent = `⬇ Export PNG ${currentSize().label}`;
  syncPanelInspector();
}

function syncPanelInspector() {
  const count = currentPhotoPanelCount();
  if (editorState.selectedSlot >= count) editorState.selectedSlot = 0;
  const chips = $('panelChips');
  chips.textContent = '';
  for (let i = 0; i < count; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'panel-chip';
    b.textContent = String(i + 1);
    b.setAttribute('aria-pressed', String(i === editorState.selectedSlot));
    const crop = editorState.panels[i];
    const photo = crop && photosById.get(crop.photoId);
    if (photo) b.style.backgroundImage = `url("${photo.thumbUrl}")`;
    b.addEventListener('click', () => { editorState.selectedSlot = i; refreshEverything(); });
    chips.append(b);
  }
  $('selectedPanelLabel').textContent = `${editorState.selectedSlot + 1} of ${count}`;
  const crop = selectedCrop();
  $('panelZoomSlider').value = String(crop ? crop.zoom : 1);
  $('panelZoomValue').textContent = `${(crop ? crop.zoom : 1).toFixed(1)}×`;
  document.querySelectorAll('.photo-thumb').forEach((t) => t.classList.toggle('in-panel', !!crop && t.dataset.photoId === String(crop.photoId)));
}

// ---------- direct manipulation on the preview ----------

function previewPointToCanvas(e) {
  const r = previewCanvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * previewCanvas.width, y: ((e.clientY - r.top) / r.height) * previewCanvas.height };
}

function photoPanelAtPoint(pt) {
  if (!previewLayout) return null;
  return previewLayout.panels.find((p) => p.kind === 'photo' && pointInPolygon(pt, p.poly)) || null;
}

let dragState = null;

function bindPreviewPanning() {
  previewCanvas.addEventListener('pointerdown', (e) => {
    const panel = photoPanelAtPoint(previewPointToCanvas(e));
    if (!panel) return;
    editorState.selectedSlot = panel.photoSlot;
    const crop = editorState.panels[panel.photoSlot];
    syncPanelInspector();
    requestPreviewRender();
    if (!crop || !photosById.get(crop.photoId)) return;
    dragState = { panel, last: previewPointToCanvas(e) };
    previewCanvas.setPointerCapture(e.pointerId);
    previewCanvas.classList.add('dragging');
  });
  previewCanvas.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const pt = previewPointToCanvas(e);
    const crop = editorState.panels[dragState.panel.photoSlot];
    const photo = photosById.get(crop.photoId);
    const box = dragState.panel.bbox;
    const scale = (Math.max(box.w / photo.w, box.h / photo.h) * crop.zoom);
    crop.cx -= (pt.x - dragState.last.x) / (photo.w * scale);
    crop.cy -= (pt.y - dragState.last.y) / (photo.h * scale);
    clampCropToPanel(photo, crop, box);
    dragState.last = pt;
    requestPreviewRender();
  });
  const endDrag = () => { dragState = null; previewCanvas.classList.remove('dragging'); };
  previewCanvas.addEventListener('pointerup', endDrag);
  previewCanvas.addEventListener('pointercancel', endDrag);
  previewCanvas.addEventListener('wheel', (e) => {
    const panel = photoPanelAtPoint(previewPointToCanvas(e));
    if (!panel) return;
    const crop = editorState.panels[panel.photoSlot];
    if (!crop) return;
    e.preventDefault();
    editorState.selectedSlot = panel.photoSlot;
    crop.zoom = Math.min(5, Math.max(1, crop.zoom * Math.exp(-e.deltaY * 0.0015)));
    syncPanelInspector();
    requestPreviewRender();
  }, { passive: false });
  previewCanvas.addEventListener('dblclick', (e) => {
    const panel = photoPanelAtPoint(previewPointToCanvas(e));
    const crop = panel && editorState.panels[panel.photoSlot];
    const photo = crop && photosById.get(crop.photoId);
    if (!photo) return;
    editorState.panels[panel.photoSlot] = autoCenterCrop(photo);
    refreshEverything();
  });
}

function bindFileDropping() {
  let depth = 0;
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files')) { depth++; document.body.classList.add('drag-active'); } });
  window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('drag-active'); });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    document.body.classList.remove('drag-active');
    const files = e.dataTransfer?.files;
    if (!files || !files.length) return;
    let slot = null;
    if (e.target === previewCanvas) {
      const panel = photoPanelAtPoint(previewPointToCanvas(e));
      if (panel) slot = panel.photoSlot;
    }
    addPhotosFromFiles(files, slot);
  });
}

// ---------- export ----------

function setStatus(text) {
  $('exportStatus').textContent = text;
}

function coverFileName(size) {
  const slug = (editorState.caption.title || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
  return `${slug}-${size.w}x${size.h}.png`;
}

export async function renderCoverToCanvas(size) {
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = size.w;
  c.height = size.h;
  renderCoverArt(c.getContext('2d'), size.w, size.h, editorState, photosById, {});
  return c;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Renders the cover at full output resolution and saves it as a PNG.
export async function exportCoverPng(size) {
  setStatus(`Rendering ${size.label}…`);
  const c = await renderCoverToCanvas(size);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const name = coverFileName(size);
  downloadBlob(blob, name);
  setStatus(`Saved ${name}`);
  return name;
}

export async function exportAllCoverSizes() {
  const names = [];
  for (const size of COVER_SIZES) {
    names.push(await exportCoverPng(size));
    await new Promise((r) => setTimeout(r, 350));
  }
  setStatus(`Saved ${names.length} PNGs: ${COVER_SIZES.map((s) => s.label).join(' · ')}`);
  return names;
}

// ---------- boot ----------

async function bootCoverStudio() {
  buildSizeTabs();
  buildLayoutPicker();
  buildGradePicker();
  buildLetteringFillPicker();
  bindAllControls();
  bindPreviewPanning();
  bindFileDropping();
  try {
    await Promise.all([document.fonts.load('100px Anton'), document.fonts.load('700 40px Oswald'), document.fonts.load('500 40px Oswald'), document.fonts.load('40px "Kaushan Script"')]);
  } catch { /* fonts are local; fall back silently */ }
  refreshEverything();
  new ResizeObserver(requestPreviewRender).observe($('previewFrame'));
}

window.coverStudio = { state: editorState, photos, exportCoverPng, exportAllCoverSizes, refresh: refreshEverything, sizes: COVER_SIZES };
bootCoverStudio();
