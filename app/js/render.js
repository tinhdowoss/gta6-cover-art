// Composes one cover at any size: the same function feeds the live preview and the PNG export.
import { computeTiltedPanelLayout, tracePolygonPath } from './layouts.js';
import { applyCoverGrade, gradeArtPalette, GRADE_PRESETS } from './grades.js';
import { computePanelCropRect } from './photos.js';
import { drawTitleTileBackdrop, drawEmptyPanelPlaceholder, drawPanelVignette, drawSunsetBand } from './backdrop.js';
import { renderCaptionLettering, drawBandTagline, drawFinePrintCredits } from './lettering.js';

let scratchCanvas = null;
function getScratchCanvas(w, h) {
  if (!scratchCanvas) scratchCanvas = document.createElement('canvas');
  if (scratchCanvas.width !== w || scratchCanvas.height !== h) {
    scratchCanvas.width = w;
    scratchCanvas.height = h;
  }
  return scratchCanvas;
}

// Draws every panel's photo crop into its tilted polygon on a separate layer, then grades that layer
// at pixel level (so the lettering and frame stay crisp and ungraded).
function drawGradedPhotoLayer(layout, state, photosById) {
  const { W, H } = layout;
  const layer = getScratchCanvas(W, H);
  const lctx = layer.getContext('2d', { willReadFrequently: true });
  lctx.clearRect(0, 0, W, H);
  lctx.imageSmoothingQuality = 'high';
  let any = false;
  for (const panel of layout.panels) {
    if (panel.kind !== 'photo') continue;
    const crop = state.panels[panel.photoSlot];
    const photo = crop && photosById.get(crop.photoId);
    if (!photo) continue;
    any = true;
    const r = computePanelCropRect(photo, crop, panel.bbox);
    lctx.save();
    tracePolygonPath(lctx, panel.poly);
    lctx.clip();
    lctx.drawImage(photo.bitmap, r.dx, r.dy, r.dw, r.dh);
    lctx.restore();
  }
  if (any && state.grade.id) {
    const c = layout.content;
    const x = Math.floor(c.x), y = Math.floor(c.y);
    const w = Math.ceil(c.w), h = Math.ceil(c.h);
    const img = lctx.getImageData(x, y, w, h);
    applyCoverGrade(img, {
      grade: state.grade.id,
      strength: state.grade.strength,
      contrast: state.grade.contrast,
      saturation: state.grade.saturation,
      grain: state.grade.grain,
      halftone: state.grade.halftone,
      scale: layout.unit / 1080,
      seed: 90210,
    });
    lctx.putImageData(img, x, y);
  }
  return layer;
}

function clipToPhotoPanels(ctx, layout) {
  ctx.beginPath();
  for (const p of layout.panels) {
    if (p.kind !== 'photo') continue;
    p.poly.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
    ctx.closePath();
  }
  ctx.clip();
}

// One sky across every panel: a soft-light gradient (and a warm glow rising from the bottom)
// laid over the whole collage, so photos shot in different light share one sunset.
function drawCohesiveSkyOverlay(ctx, layout, preset, strength) {
  const sky = preset.skyOverlay;
  const c = layout.content;
  ctx.save();
  clipToPhotoPanels(ctx, layout);
  if (sky) {
    const g = ctx.createLinearGradient(c.x, c.y, c.x + c.w * 0.25, c.y + c.h);
    sky.stops.forEach((col, i) => g.addColorStop(i / (sky.stops.length - 1), col));
    ctx.globalCompositeOperation = sky.mode;
    ctx.globalAlpha = sky.alpha * strength;
    ctx.fillStyle = g;
    ctx.fillRect(c.x, c.y, c.w, c.h);
  }
  if (preset.glow) {
    const gl = ctx.createLinearGradient(0, c.y + c.h, 0, c.y + c.h * 0.35);
    gl.addColorStop(0, preset.glow);
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = strength;
    ctx.fillStyle = gl;
    ctx.fillRect(c.x, c.y, c.w, c.h);
  }
  ctx.restore();
}

// Soft dark pool behind overlaid lettering so the caption always reads over busy photos.
function drawCaptionScrim(ctx, layout, palette) {
  const z = layout.titleZone;
  const cx = z.x + z.w / 2;
  const cy = z.y + z.h * 0.55;
  const r = Math.max(z.w, z.h) * 0.62;
  ctx.save();
  clipToPhotoPanels(ctx, layout);
  ctx.translate(cx, cy);
  ctx.scale(1, (z.h / z.w) * 1.5);
  const g = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
  g.addColorStop(0, `${palette.ink}b0`);
  g.addColorStop(0.6, `${palette.ink}60`);
  g.addColorStop(1, `${palette.ink}00`);
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

// Public entry used by preview and export alike.
export function renderCoverArt(ctx, W, H, state, photosById, opts = {}) {
  const layout = computeTiltedPanelLayout(state.layout, W, H);
  const palette = gradeArtPalette(state.grade.id);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Dark frame, then the white gutter field the panels sit in.
  ctx.fillStyle = palette.frame;
  ctx.fillRect(0, 0, W, H);
  const c = layout.content;
  ctx.fillStyle = state.gutterColor || '#f7f3ee';
  ctx.fillRect(c.x, c.y, c.w, c.h);

  const photoLayer = drawGradedPhotoLayer(layout, state, photosById);
  ctx.drawImage(photoLayer, 0, 0);
  if (state.grade.id) drawCohesiveSkyOverlay(ctx, layout, GRADE_PRESETS[state.grade.id] || GRADE_PRESETS.natural, state.grade.strength);

  for (const panel of layout.panels) {
    if (panel.kind === 'title') {
      drawTitleTileBackdrop(ctx, panel, palette);
      continue;
    }
    const crop = state.panels[panel.photoSlot];
    if (!crop || !photosById.get(crop.photoId)) drawEmptyPanelPlaceholder(ctx, panel, palette, panel.photoSlot, layout.unit);
    drawPanelVignette(ctx, panel, state.grade.vignette, palette);
  }

  // Hairline ink edge inside each gutter for a printed, comic-panel crispness.
  ctx.lineWidth = Math.max(1, layout.unit * 0.0022);
  ctx.strokeStyle = 'rgba(10,4,20,0.75)';
  for (const panel of layout.panels) {
    tracePolygonPath(ctx, panel.poly);
    ctx.stroke();
  }

  drawSunsetBand(ctx, layout, palette);
  drawBandTagline(ctx, layout, state.caption.tagline);
  if (state.lettering.extras !== false) drawFinePrintCredits(ctx, layout, state.caption, palette);

  if (layout.titleZone.mode === 'overlay' && (state.caption.title || state.caption.subtitle)) drawCaptionScrim(ctx, layout, palette);
  renderCaptionLettering(ctx, layout, state.caption, state.lettering, palette);

  if (opts.highlightSlot != null && opts.highlightSlot >= 0) {
    const panel = layout.panels.find((p) => p.photoSlot === opts.highlightSlot);
    if (panel) drawSelectedPanelOutline(ctx, panel, layout.unit);
  }
  ctx.restore();
  return layout;
}

function drawSelectedPanelOutline(ctx, panel, unit) {
  ctx.save();
  ctx.setLineDash([unit * 0.02, unit * 0.012]);
  ctx.lineWidth = Math.max(2, unit * 0.006);
  ctx.strokeStyle = '#19e0ff';
  tracePolygonPath(ctx, panel.poly);
  ctx.stroke();
  ctx.restore();
}
