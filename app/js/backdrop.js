// Procedural, original artwork drawn on canvas: the title tile's sunset sky with a striped sun,
// palm silhouettes and water lines, plus the placeholder art shown in a panel that has no photo yet.
import { tracePolygonPath } from './layouts.js';

function drawPalmSilhouette(ctx, baseX, baseY, height, lean, color, seed) {
  const topX = baseX + lean * height;
  const topY = baseY - height;
  const trunkW = height * 0.045;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(baseX - trunkW, baseY);
  ctx.quadraticCurveTo(baseX + lean * height * 0.2 - trunkW * 0.6, baseY - height * 0.55, topX - trunkW * 0.35, topY);
  ctx.lineTo(topX + trunkW * 0.35, topY);
  ctx.quadraticCurveTo(baseX + lean * height * 0.2 + trunkW * 0.6, baseY - height * 0.55, baseX + trunkW, baseY);
  ctx.closePath();
  ctx.fill();
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const angle = -Math.PI / 2 + ((i - (fronds - 1) / 2) / fronds) * Math.PI * 1.85 + Math.sin(seed + i) * 0.12;
    const len = height * (0.42 + 0.12 * Math.abs(Math.sin(seed * 3 + i * 1.7)));
    const droop = len * 0.42;
    const ex = topX + Math.cos(angle) * len;
    const ey = topY + Math.sin(angle) * len * 0.55 + droop;
    const mx = topX + Math.cos(angle) * len * 0.55;
    const my = topY + Math.sin(angle) * len * 0.55 - len * 0.12;
    const w = len * 0.11;
    const nx = -Math.sin(angle) * w;
    const ny = Math.cos(angle) * w;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(mx + nx, my + ny, ex, ey);
    ctx.quadraticCurveTo(mx - nx, my - ny, topX, topY);
    ctx.fill();
  }
}

// The title tile: sunset sky, striped retro sun, ocean lines and palms. No photo needed.
export function drawTitleTileBackdrop(ctx, panel, palette) {
  const { poly, bbox } = panel;
  ctx.save();
  tracePolygonPath(ctx, poly);
  ctx.clip();
  const { x, y, w, h } = bbox;
  const horizon = y + h * 0.7;
  const sky = ctx.createLinearGradient(0, y, 0, horizon);
  sky.addColorStop(0, palette.sky[0]);
  sky.addColorStop(0.38, palette.sky[1]);
  sky.addColorStop(0.75, palette.sky[2]);
  sky.addColorStop(1, palette.sky[3]);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);

  // Striped sun sitting on the horizon.
  const sunR = Math.min(w, h) * 0.42;
  const sunX = x + w * 0.5;
  const sunY = horizon - sunR * 0.18;
  const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR * 0.3);
  sunGrad.addColorStop(0, palette.sun[0]);
  sunGrad.addColorStop(1, palette.sun[1]);
  ctx.save();
  ctx.shadowColor = palette.sun[1];
  ctx.shadowBlur = sunR * 0.5;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fillStyle = sunGrad;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const t = i / 7;
    const by = sunY - sunR * 0.05 + t * sunR * 0.9;
    ctx.fillRect(sunX - sunR - 2, by, sunR * 2 + 4, sunR * (0.03 + t * 0.07));
  }
  ctx.restore();
  // Re-fill the stripes with the sky colour so the cut-outs read as sky, not as holes.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  // Ocean below the horizon with glowing reflection lines.
  const sea = ctx.createLinearGradient(0, horizon, 0, y + h);
  sea.addColorStop(0, palette.sky[1]);
  sea.addColorStop(1, palette.ink);
  ctx.fillStyle = sea;
  ctx.fillRect(x, horizon, w, y + h - horizon);
  ctx.strokeStyle = palette.sun[1];
  for (let i = 0; i < 9; i++) {
    const t = i / 9;
    const ly = horizon + (y + h - horizon) * (t * t * 0.9 + 0.04);
    const half = sunR * (0.9 - t * 0.55);
    ctx.globalAlpha = 0.75 - t * 0.5;
    ctx.lineWidth = Math.max(1, h * 0.006 * (1 + t * 2));
    ctx.beginPath();
    ctx.moveTo(sunX - half, ly);
    ctx.lineTo(sunX + half, ly);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Palm silhouettes framing the sun.
  const palmH = h * 0.78;
  drawPalmSilhouette(ctx, x + w * 0.08, y + h * 1.02, palmH, 0.18, palette.ink, 1.3);
  drawPalmSilhouette(ctx, x + w * 0.2, y + h * 1.04, palmH * 0.7, 0.3, palette.ink, 4.1);
  drawPalmSilhouette(ctx, x + w * 0.93, y + h * 1.03, palmH * 0.92, -0.22, palette.ink, 2.7);
  ctx.restore();
}

// Placeholder for a panel that is still waiting for a photo: graded sky + slot number.
export function drawEmptyPanelPlaceholder(ctx, panel, palette, slotNumber, unit) {
  const { poly, bbox } = panel;
  ctx.save();
  tracePolygonPath(ctx, poly);
  ctx.clip();
  const g = ctx.createLinearGradient(bbox.x, bbox.y, bbox.x + bbox.w * 0.4, bbox.y + bbox.h);
  const shift = slotNumber % 3;
  g.addColorStop(0, palette.sky[shift]);
  g.addColorStop(1, palette.ink);
  ctx.fillStyle = g;
  ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  drawPalmSilhouette(ctx, bbox.x + bbox.w * (0.15 + 0.6 * ((slotNumber * 37) % 10) / 10), bbox.y + bbox.h * 1.05,
    bbox.h * 0.8, slotNumber % 2 ? 0.2 : -0.2, 'rgba(0,0,0,0.45)', slotNumber);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `${Math.round(unit * 0.05)}px Anton, Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`PHOTO ${slotNumber + 1}`, bbox.x + bbox.w / 2, bbox.y + bbox.h / 2);
  ctx.font = `600 ${Math.round(unit * 0.018)}px Oswald, sans-serif`;
  ctx.fillText('DROP OR CLICK "ADD PHOTOS"', bbox.x + bbox.w / 2, bbox.y + bbox.h / 2 + unit * 0.045);
  ctx.restore();
}

// Inner vignette + sun-glow edge light per panel so each tile reads as its own lit frame.
export function drawPanelVignette(ctx, panel, amount, palette) {
  if (amount <= 0) return;
  const { poly, bbox } = panel;
  ctx.save();
  tracePolygonPath(ctx, poly);
  ctx.clip();
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h * 0.45;
  const r = Math.hypot(bbox.w, bbox.h) * 0.62;
  const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(8,0,18,${0.85 * amount})`);
  ctx.fillStyle = g;
  ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  const glow = ctx.createLinearGradient(0, bbox.y, 0, bbox.y + bbox.h);
  glow.addColorStop(0, 'rgba(0,0,0,0)');
  glow.addColorStop(1, palette.glow);
  ctx.globalAlpha = 0.12 * amount;
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = glow;
  ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  ctx.restore();
}

// The sunset band under the panels: sky gradient strip, a striped half-sun on the horizon,
// palm silhouettes at both ends and glinting water lines. Pure canvas drawing, no images.
export function drawSunsetBand(ctx, layout, palette) {
  const { x, y, w, h } = layout.sunsetBand;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, palette.sky[1]);
  sky.addColorStop(0.45, palette.sky[2]);
  sky.addColorStop(0.8, palette.sky[3]);
  sky.addColorStop(1, palette.sun[0]);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  const horizon = y + h * 0.78;
  // The sun sits off-centre (left third) so the centred tagline never hides it.
  const sunR = h * 0.95;
  const sunX = x + w * 0.16 + h * 2.5;
  const sunGrad = ctx.createLinearGradient(0, horizon - sunR, 0, horizon);
  sunGrad.addColorStop(0, palette.sun[0]);
  sunGrad.addColorStop(1, palette.sun[1]);
  ctx.save();
  ctx.shadowColor = palette.sun[1];
  ctx.shadowBlur = h * 0.8;
  ctx.beginPath();
  ctx.arc(sunX, horizon, sunR, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = sunGrad;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.restore();
  // Horizontal stripes cut through the lower sun.
  ctx.fillStyle = palette.sky[2];
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    const sy = horizon - sunR * (0.62 - t * 0.6);
    ctx.fillRect(sunX - sunR, sy, sunR * 2, h * (0.035 + t * 0.06));
  }
  const sea = ctx.createLinearGradient(0, horizon, 0, y + h);
  sea.addColorStop(0, palette.sky[1]);
  sea.addColorStop(1, palette.ink);
  ctx.fillStyle = sea;
  ctx.fillRect(x, horizon, w, y + h - horizon);
  ctx.strokeStyle = palette.sun[0];
  ctx.lineWidth = Math.max(1, h * 0.03);
  for (let i = 0; i < 3; i++) {
    const ly = horizon + (y + h - horizon) * (0.25 + i * 0.3);
    const half = sunR * (0.8 - i * 0.22);
    ctx.globalAlpha = 0.7 - i * 0.18;
    ctx.beginPath();
    ctx.moveTo(sunX - half, ly);
    ctx.lineTo(sunX + half, ly);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Palm skyline: a dense row at each end, thinning toward the sun.
  const palms = Math.max(4, Math.round(w / (h * 2.2)));
  for (let i = 0; i < palms; i++) {
    const side = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2);
    const px = side < 0 ? x + h * (0.4 + k * 1.15) : x + w - h * (0.4 + k * 1.15);
    const ph = h * (1.25 - k * 0.12);
    drawPalmSilhouette(ctx, px, y + h * 1.05, ph, side * -0.12 * (1 + (k % 2)), palette.ink, i * 1.7 + 0.5);
  }
  ctx.restore();
}
