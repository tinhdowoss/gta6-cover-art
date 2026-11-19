// Pixel-level colour grades for the photo layer. Everything runs on ImageData with lookup tables,
// so the live preview and the full-size PNG export get the same look. A grade is:
//   S-curve contrast → saturation → split-tone (shadow / highlight tints) → luminance-preserving
//   gradient map → tinted black lift → optional comic-ink pass → halftone → grain.
// render.js then lays a soft-light "sky" gradient over every panel (grade.skyOverlay) so photos
// shot in different light still read as one sunset.

export const GRADE_PRESETS = {
  viceSunset: {
    label: 'Vice Sunset', note: 'magenta shadows, molten orange highlights, glowing skin',
    swatch: ['#2a0b4a', '#c0186a', '#ff6248', '#ffd27a'],
    mapStops: [[0, '#0e0220'], [0.22, '#4a0c62'], [0.45, '#c81f62'], [0.66, '#ff6436'], [0.85, '#ffb04e'], [1, '#fff0c4']],
    mapMix: 0.42, sat: 0.42, contrast: 0.56,
    shadowTint: [14, -16, 30], highlightTint: [42, 12, -34],
    blackLift: [16, 2, 28],
    skyOverlay: { stops: ['#6a1cc8', '#ff2a7a', '#ff7426', '#ffb238'], mode: 'soft-light', alpha: 0.4 },
    glow: 'rgba(255,110,40,0.16)',
  },
  neonNight: {
    label: 'Neon Night', note: 'teal shadows, hot-pink highlights, crushed blacks',
    swatch: ['#041a33', '#00b3c7', '#ff2fa0', '#ffd6f3'],
    mapStops: [[0, '#02061a'], [0.3, '#0a2c5c'], [0.55, '#7a1aa8'], [0.78, '#ff2f9a'], [1, '#ffe3fb']],
    mapMix: 0.42, sat: 0.42, contrast: 0.46,
    shadowTint: [-40, 22, 58], highlightTint: [62, -22, 40], crush: 0.05,
    blackLift: [4, 8, 26],
    skyOverlay: { stops: ['#00e1ff', '#6a2cff', '#ff2fa0', '#ff5ac8'], mode: 'soft-light', alpha: 0.42 },
    glow: 'rgba(40,220,255,0.2)',
  },
  goldenHour: {
    label: 'Golden Hour', note: 'amber highlights, rosy shadows, warm haze',
    swatch: ['#3a1408', '#b4501c', '#ffae42', '#fff0c2'],
    mapStops: [[0, '#1e0a06'], [0.35, '#7a2e14'], [0.65, '#e98a32'], [1, '#fff3cf']],
    mapMix: 0.34, sat: 0.24, contrast: 0.26,
    shadowTint: [26, -4, -24], highlightTint: [44, 18, -40],
    blackLift: [40, 16, 10],
    skyOverlay: { stops: ['#ff8a3a', '#ffb347', '#ffd27a', '#ff7a3a'], mode: 'soft-light', alpha: 0.45 },
    glow: 'rgba(255,190,90,0.22)',
  },
  duotonePinkTeal: {
    label: 'Duotone Pink/Teal', note: 'two-ink gradient map',
    swatch: ['#03222c', '#0a7380', '#ff4f9a', '#ffe6f2'],
    mapStops: [[0, '#031c26'], [0.33, '#08626e'], [0.62, '#ff4f9a'], [1, '#fff0f6']],
    mapMix: 0.94, preserveLum: false, sat: 0, contrast: 0.32,
    skyOverlay: null, glow: 'rgba(255,79,154,0.18)',
  },
  comicInk: {
    label: 'Comic Ink', note: 'posterized sunset colour, inked edges, halftone shadows',
    swatch: ['#14031f', '#ff2f78', '#ff9a3c', '#fff1b8'],
    mapStops: [[0, '#14031f'], [0.25, '#5a0f6e'], [0.48, '#e0246a'], [0.7, '#ff7a3a'], [0.88, '#ffc45a'], [1, '#fff6d8']],
    mapMix: 0.55, sat: 0.4, contrast: 0.3,
    shadowTint: [14, -10, 28], highlightTint: [30, 10, -20],
    ink: { levels: 6, edge: 0.3, dots: true },
    skyOverlay: { stops: ['#7a1fd6', '#ff2f8a', '#ff7a2a', '#ffc04a'], mode: 'soft-light', alpha: 0.35 },
    glow: 'rgba(255,120,60,0.15)',
  },
  natural: {
    label: 'Natural', note: 'contrast and saturation only',
    swatch: ['#222', '#666', '#aaa', '#eee'], sat: 0.1, contrast: 0.14, skyOverlay: null, glow: 'rgba(255,255,255,0)',
  },
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function buildGradientMapLut(stops) {
  const lut = new Float32Array(256 * 3);
  const parsed = stops.map(([t, hex]) => [t, hexToRgb(hex)]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < parsed.length - 2 && t > parsed[k + 1][0]) k++;
    const [t0, c0] = parsed[k];
    const [t1, c1] = parsed[k + 1];
    const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0 || 1)));
    const s = f * f * (3 - 2 * f);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * s;
  }
  return lut;
}

// Smooth S-curve; amount 0 = identity, 1 = strong punch.
export function buildContrastCurveLut(amount) {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    const s = x * x * (3 - 2 * x);
    const y = x + (s - x) * amount * 1.6;
    lut[i] = Math.round(Math.min(1, Math.max(0, y)) * 255);
  }
  return lut;
}

// Small seeded PRNG so grain is identical between preview and export.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lutCache = new Map();
function cachedGradientMap(id, stops) {
  if (!lutCache.has(id)) lutCache.set(id, buildGradientMapLut(stops));
  return lutCache.get(id);
}

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Main entry: grades an ImageData in place.
// opts: { grade, strength 0..1, contrast -1..1, saturation -1..1, grain 0..1, halftone bool, scale, seed }
export function applyCoverGrade(imageData, opts) {
  const preset = GRADE_PRESETS[opts.grade] || GRADE_PRESETS.natural;
  const k = opts.strength ?? 1;
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const contrastLut = buildContrastCurveLut(Math.max(-0.5, (preset.contrast || 0) * k + (opts.contrast || 0)));
  const sat = 1 + (preset.sat || 0) * k + (opts.saturation || 0);
  const mapLut = preset.mapStops ? cachedGradientMap(opts.grade, preset.mapStops) : null;
  const mapMix = (preset.mapMix || 0) * k;
  const preserveLum = preset.preserveLum !== false;
  const sh = preset.shadowTint ? preset.shadowTint.map((v) => v * k) : null;
  const hi = preset.highlightTint ? preset.highlightTint.map((v) => v * k) : null;
  const lift = preset.blackLift ? preset.blackLift.map((v) => (v * k) / 255) : null;
  const crush = (preset.crush || 0) * k;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = contrastLut[data[i]];
    let g = contrastLut[data[i + 1]];
    let b = contrastLut[data[i + 2]];
    const lum = luma(r, g, b);
    if (sat !== 1) {
      r = lum + (r - lum) * sat;
      g = lum + (g - lum) * sat;
      b = lum + (b - lum) * sat;
    }
    if (sh) {
      const l = lum / 255;
      const ws = l < 0.5 ? (1 - l / 0.5) : 0;
      const wh = l > 0.45 ? (l - 0.45) / 0.55 : 0;
      r += sh[0] * ws + hi[0] * wh;
      g += sh[1] * ws + hi[1] * wh;
      b += sh[2] * ws + hi[2] * wh;
    }
    if (mapLut) {
      const cl = Math.max(0, Math.min(255, luma(r, g, b)));
      const li = (cl | 0) * 3;
      let mr = mapLut[li], mg = mapLut[li + 1], mb = mapLut[li + 2];
      if (preserveLum) {
        // Keep the photo's own brightness, take only the map's hue: tint without the mud.
        const ml = luma(mr, mg, mb) || 1;
        const f = Math.min(2.2, cl / ml);
        mr *= f; mg *= f; mb *= f;
      }
      r += (mr - r) * mapMix;
      g += (mg - g) * mapMix;
      b += (mb - b) * mapMix;
    }
    if (crush) {
      r = (r - 255 * crush) / (1 - crush);
      g = (g - 255 * crush) / (1 - crush);
      b = (b - 255 * crush) / (1 - crush);
    }
    if (lift) {
      // Blacks print as deep tinted ink rather than dead #000, like a lit poster.
      r = lift[0] * 255 + r * (1 - lift[0]);
      g = lift[1] * 255 + g * (1 - lift[1]);
      b = lift[2] * 255 + b * (1 - lift[2]);
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  if (preset.ink) applyComicInkFilter(imageData, { ...preset.ink, scale: opts.scale || 1 });
  if (opts.halftone || (preset.ink && preset.ink.dots)) {
    applyHalftoneDots(imageData, preset.ink && !opts.halftone
      ? { scale: opts.scale || 1, strength: 0.34, shadowsOnly: true, cellSize: 9 }
      : { scale: opts.scale || 1, strength: 0.42 });
  }
  if (opts.grain) applyFilmGrain(imageData, opts.grain, opts.seed || 1337);
  return imageData;
}

// Illustrated look: posterize each channel to a few flat levels and ink every strong edge
// (Sobel on a softened luminance copy, sampled at a radius that scales with output size).
export function applyComicInkFilter(imageData, { levels = 6, edge = 0.2, scale = 1 }) {
  const { data, width, height } = imageData;
  const n = width * height;
  const lum = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) lum[p] = luma(data[i], data[i + 1], data[i + 2]) / 255;
  // Two 3x3 box-blur passes so grain, skin texture and JPEG noise do not become ink.
  let soft = lum;
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(n);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = y * width + x;
        next[p] = (soft[p - width - 1] + soft[p - width] + soft[p - width + 1] + soft[p - 1] + soft[p] + soft[p + 1]
          + soft[p + width - 1] + soft[p + width] + soft[p + width + 1]) / 9;
      }
    }
    soft = next;
  }
  const d = Math.max(1, Math.round(1.4 * scale));
  const step = 255 / (levels - 1);
  const posterLut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) posterLut[v] = Math.round(Math.round(v / step) * step * 0.82 + v * 0.18);
  for (let y = d; y < height - d; y++) {
    for (let x = d; x < width - d; x++) {
      const p = y * width + x;
      const i = p * 4;
      if (data[i + 3] === 0) continue;
      const gx = soft[p - d * width + d] + 2 * soft[p + d] + soft[p + d * width + d]
        - soft[p - d * width - d] - 2 * soft[p - d] - soft[p + d * width - d];
      const gy = soft[p + d * width - d] + 2 * soft[p + d * width] + soft[p + d * width + d]
        - soft[p - d * width - d] - 2 * soft[p - d * width] - soft[p - d * width + d];
      const mag = Math.sqrt(gx * gx + gy * gy);
      let r = posterLut[data[i]], g = posterLut[data[i + 1]], b = posterLut[data[i + 2]];
      if (mag > edge) {
        const t = Math.min(1, (mag - edge) / (edge * 0.8));
        r += (16 - r) * t; g += (4 - g) * t; b += (28 - b) * t;
      }
      data[i] = r; data[i + 1] = g; data[i + 2] = b;
    }
  }
  return imageData;
}

// Print-style halftone: ink dots on a 45° grid, bigger where the image is darker.
export function applyHalftoneDots(imageData, { scale = 1, strength = 0.42, shadowsOnly = false, cellSize = 7 }) {
  const { data, width, height } = imageData;
  const cell = Math.max(4, Math.round(cellSize * scale));
  const inkR = 26, inkG = 6, inkB = 40;
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i += 4) {
      if (data[i + 3] === 0) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const l = luma(r, g, b) / 255;
      if (shadowsOnly && l > 0.58) continue;
      const u = (x + y) * 0.70710678 / cell;
      const v = (x - y) * 0.70710678 / cell;
      const du = u - Math.floor(u) - 0.5;
      const dv = v - Math.floor(v) - 0.5;
      const radius = shadowsOnly ? 0.6 * Math.sqrt(Math.max(0, 1 - l / 0.58)) : 0.62 * Math.sqrt(Math.max(0, 1 - l));
      if (du * du + dv * dv < radius * radius) {
        data[i] = r + (inkR - r) * strength; data[i + 1] = g + (inkG - g) * strength; data[i + 2] = b + (inkB - b) * strength;
      } else if (!shadowsOnly) {
        data[i] = r + (255 - r) * 0.05; data[i + 1] = g + (240 - g) * 0.05; data[i + 2] = b + (230 - b) * 0.05;
      }
    }
  }
  return imageData;
}

// Seeded luminance grain, strongest in the mid-tones like film.
export function applyFilmGrain(imageData, amount, seed) {
  const { data } = imageData;
  const rand = mulberry32(seed);
  const grain = amount * 44;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const l = luma(data[i], data[i + 1], data[i + 2]) / 255;
    const n = (rand() - 0.5) * grain * (0.45 + 2.2 * l * (1 - l));
    data[i] += n; data[i + 1] += n; data[i + 2] += n;
  }
  return imageData;
}

// Palette each grade hands to the lettering, sunset band, title tile and frame so the whole cover stays coherent.
export function gradeArtPalette(gradeId) {
  switch (gradeId) {
    case 'neonNight':
      return { sky: ['#05021a', '#1b0846', '#5a0f7a', '#d4207f'], sun: ['#ffe24d', '#ff3d9a'], ink: '#0a0418', glow: '#2de2ff', frame: '#07040f', script: '#ff3ec8', scriptGlow: '#ff3ec8' };
    case 'goldenHour':
      return { sky: ['#2a0d12', '#7c2a1c', '#e0662a', '#ffc861'], sun: ['#fff6c6', '#ff8a2a'], ink: '#1d0904', glow: '#ffcf6b', frame: '#120806', script: '#ff4f7a', scriptGlow: '#ff8a3a' };
    case 'duotonePinkTeal':
      return { sky: ['#031a24', '#06505c', '#0e8b93', '#ff6aa9'], sun: ['#fff0f6', '#ff4f9a'], ink: '#021015', glow: '#ff4f9a', frame: '#030f14', script: '#ff4f9a', scriptGlow: '#ff4f9a' };
    case 'natural':
      return { sky: ['#140a2a', '#47206b', '#d84a6a', '#ffb36b'], sun: ['#fff1b8', '#ff6a3d'], ink: '#0d0614', glow: '#ffffff', frame: '#0b0910', script: '#ff3e8e', scriptGlow: '#ff3e8e' };
    default:
      return { sky: ['#14042b', '#4a0d5e', '#c4195f', '#ff8a3d'], sun: ['#fff3a8', '#ff3f6e'], ink: '#14031f', glow: '#ff9f43', frame: '#0c0612', script: '#ff2f9a', scriptGlow: '#ff2f9a' };
  }
}
