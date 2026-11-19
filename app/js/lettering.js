// Caption lettering and poster ephemera, drawn entirely on canvas with the bundled OFL fonts:
// Anton (title), Oswald (subtitle caps, fine print) and Kaushan Script (neon script line).
// Title: heavy condensed italic via a shear, stepped 3-D extrusion, thick dark outline, cream inline,
// warm gradient face with gloss. Ephemera: starburst sticker, star-rating strip, monogram,
// barcode and a fine-print credits strip. All of it is this app's own invented design.

export const LETTERING_FILLS = {
  cream: { label: 'Cream sunset', stops: ['#fffdf2', '#fff1c4', '#ffd47e', '#ffa24e', '#ff6a4a'], extrude: ['#e0306a', '#7a0f5a', '#2a0430'], inline: '#fff7e0', glow: 'rgba(255,110,70,0.55)' },
  sunset: { label: 'Hot sunset', stops: ['#fff6c4', '#ffd451', '#ff8a3a', '#ff2f78', '#c2128a'], extrude: ['#9a1660', '#4a0a46', '#1c0322'], inline: '#ffffff', glow: 'rgba(255,90,80,0.55)' },
  neon: { label: 'Neon pink/cyan', stops: ['#e9fdff', '#6ff3ff', '#29b8ff', '#ff4fd8', '#ff2f9a'], extrude: ['#3a1ca0', '#1a1060', '#05031a'], inline: '#ffffff', glow: 'rgba(60,220,255,0.6)' },
  gold: { label: 'Gold foil', stops: ['#fffbe0', '#ffe27a', '#ffb52e', '#e07a12', '#9c4a08'], extrude: ['#8a3a08', '#5a2606', '#160700'], inline: '#fff8dc', glow: 'rgba(255,190,80,0.5)' },
  white: { label: 'Solid white', stops: ['#ffffff', '#ffffff', '#f2f2f2', '#e6e6e6', '#d9d9d9'], extrude: ['#ff2f78', '#a0124e', '#3a0626'], inline: '#ff2f78', glow: 'rgba(255,60,140,0.45)' },
};

const TITLE_FONT = 'Anton';
const SUB_FONT = 'Oswald';
const SCRIPT_FONT = '"Kaushan Script"';
const ITALIC_SHEAR = -0.2;
const OUTLINE_INK = '#12021c';

// Candidate line breaks: the whole title on one line, or every 2-line split (explicit breaks win).
function titleLineCandidates(title) {
  const clean = (title || '').toUpperCase().trim();
  if (!clean) return [];
  if (clean.includes('\n')) return [clean.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3)];
  const words = clean.split(/\s+/);
  const out = [[clean]];
  for (let i = 1; i < words.length; i++) out.push([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
  return out;
}

// Size the title block to its zone: picks the line arrangement that lets the letters be biggest.
function fitTitleBlock(ctx, title, zone, unit, hasScript) {
  ctx.font = `100px ${TITLE_FONT}`;
  let best = { lines: [], size: unit * 0.1 };
  for (const lines of titleLineCandidates(title)) {
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width)) / 100;
    const blockLines = 0.86 + (lines.length - 1) * 0.92 + 0.16 + (hasScript ? 0.36 : 0);
    const byWidth = zone.w / (widest + 0.2 + blockLines * Math.abs(ITALIC_SHEAR));
    const byHeight = zone.h / blockLines;
    const size = Math.max(unit * 0.04, Math.min(byWidth, byHeight, unit * 0.34));
    if (size > best.size * 1.04 || !best.lines.length) best = { lines, size, widest };
  }
  return best;
}

function letteringGradient(ctx, stops, top, bottom) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) + ((((pb >> s) & 255) - ((pa >> s) & 255)) * t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// Draws the heavy title block centred on (0,0) in the current (rotated + sheared) transform.
function drawExtrudedTitle(ctx, lines, size, fill) {
  ctx.font = `${size}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const cap = size * 0.86;
  const advance = size * 0.92;
  const blockH = cap + advance * (lines.length - 1);
  const baselines = lines.map((_, i) => -blockH / 2 + cap + i * advance);
  const outline = size * 0.12;
  const depth = size * 0.15;
  const steps = Math.max(6, Math.ceil(depth / Math.max(1, size * 0.008)));
  const each = (fn) => lines.forEach((l, i) => fn(l, baselines[i]));
  const dirX = 0.62, dirY = 1;

  // Warm glow pooled behind the block.
  ctx.save();
  ctx.shadowColor = fill.glow;
  ctx.shadowBlur = size * 0.6;
  ctx.fillStyle = 'rgba(10,0,20,0.7)';
  each((l, y) => ctx.fillText(l, depth * 0.5, y + depth * 0.6));
  ctx.restore();

  // Back silhouette: outline of the deepest extrusion step, the hard drop shadow.
  ctx.strokeStyle = OUTLINE_INK;
  ctx.fillStyle = OUTLINE_INK;
  ctx.lineWidth = outline * 1.25;
  for (let s = 0; s <= steps; s++) {
    const o = (depth * s) / steps;
    each((l, y) => ctx.strokeText(l, o * dirX, y + o * dirY));
  }
  // Stepped extrusion: bands of colour from the light edge to the dark back.
  for (let s = steps; s >= 1; s--) {
    const o = (depth * s) / steps;
    const t = s / steps;
    const [c0, c1, c2] = fill.extrude;
    ctx.fillStyle = t < 0.5 ? mixHex(c0, c1, t * 2) : mixHex(c1, c2, (t - 0.5) * 2);
    each((l, y) => ctx.fillText(l, o * dirX, y + o * dirY));
  }
  // Thick outline, cream inline, gradient face, gloss.
  ctx.lineWidth = outline;
  ctx.strokeStyle = OUTLINE_INK;
  each((l, y) => ctx.strokeText(l, 0, y));
  ctx.lineWidth = size * 0.04;
  ctx.strokeStyle = fill.inline;
  each((l, y) => ctx.strokeText(l, 0, y));
  each((l, y) => {
    ctx.fillStyle = letteringGradient(ctx, fill.stops, y - cap, y);
    ctx.fillText(l, 0, y);
  });
  each((l, y) => {
    const g = ctx.createLinearGradient(0, y - cap, 0, y - cap * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillText(l, 0, y);
  });
  ctx.font = `100px ${TITLE_FONT}`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width)) * size / 100;
  return { top: -blockH / 2, bottom: blockH / 2 + depth, height: blockH + depth, width: widest };
}

// Neon script line under the title: dark outline, coloured glow, hot core and a white hot-spot.
function drawNeonScriptLine(ctx, text, x, y, size, palette) {
  ctx.save();
  ctx.font = `${size}px ${SCRIPT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = OUTLINE_INK;
  ctx.strokeText(text, x + size * 0.06, y + size * 0.08);
  ctx.strokeText(text, x, y);
  ctx.shadowColor = palette.scriptGlow;
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = palette.script;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = size * 0.15;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Alternative subtitle look: a slanted ribbon with its own outline and hard shadow.
function drawSubtitleRibbon(ctx, text, centerY, size, colour) {
  const s = size;
  ctx.save();
  ctx.font = `700 ${s}px ${SUB_FONT}`;
  ctx.letterSpacing = `${(s * 0.16).toFixed(1)}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = text.toUpperCase();
  const tw = ctx.measureText(label).width;
  const h = s * 1.5;
  const w = tw + s * 1.4;
  const ribbonPath = (dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + h * 0.3 + dx, centerY - h / 2 + dy);
    ctx.lineTo(w / 2 + h * 0.3 + dx, centerY - h / 2 + dy);
    ctx.lineTo(w / 2 - h * 0.3 + dx, centerY + h / 2 + dy);
    ctx.lineTo(-w / 2 - h * 0.3 + dx, centerY + h / 2 + dy);
    ctx.closePath();
  };
  ctx.lineJoin = 'miter';
  ribbonPath(s * 0.22, s * 0.26);
  ctx.fillStyle = OUTLINE_INK;
  ctx.fill();
  ribbonPath(0, 0);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.lineWidth = s * 0.14;
  ctx.strokeStyle = OUTLINE_INK;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, s * 0.08, centerY + s * 0.04);
  ctx.restore();
  return h;
}

// Fits text on one line inside maxWidth at no more than maxSize.
function fitFont(ctx, text, family, weight, maxSize, maxWidth) {
  ctx.font = `${weight} 100px ${family}`;
  const w = ctx.measureText(text).width || 1;
  return Math.min(maxSize, (maxWidth * 100) / w);
}

// Starburst sticker: the app's own seal, never a game logo. Every line is fitted inside the inner disc.
export function drawStarburstBadge(ctx, cx, cy, r, text, rotationDeg) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  const points = 20;
  const star = (dx, dy) => {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2;
      const rr = i % 2 ? r * 0.86 : r;
      ctx.lineTo(dx + Math.cos(a) * rr, dy + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  ctx.lineJoin = 'miter';
  star(r * 0.08, r * 0.1);
  ctx.fillStyle = OUTLINE_INK;
  ctx.fill();
  star(0, 0);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, '#ff5aa8');
  g.addColorStop(1, '#e0105e');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.06;
  ctx.strokeStyle = OUTLINE_INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe9a8';
  ctx.fill();
  ctx.lineWidth = r * 0.05;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  ctx.lineWidth = r * 0.02;
  ctx.stroke();
  ctx.fillStyle = OUTLINE_INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = (text || 'ORIGINAL').toUpperCase();
  ctx.font = `${fitFont(ctx, label, TITLE_FONT, '', r * 0.42, r * 1.05)}px ${TITLE_FONT}`;
  ctx.fillText(label, 0, r * 0.03);
  ctx.font = `700 ${r * 0.14}px ${SUB_FONT}`;
  ctx.letterSpacing = `${(r * 0.03).toFixed(1)}px`;
  ctx.fillText('★ ★ ★', 0, -r * 0.36);
  ctx.font = `700 ${fitFont(ctx, 'COVER ART', SUB_FONT, 700, r * 0.13, r * 0.8)}px ${SUB_FONT}`;
  ctx.fillText('COVER ART', 0, r * 0.38);
  ctx.restore();
}

// Kept as the badge's public name for callers that toggle the "ORIGINAL" sticker.
export const drawOriginalBadge = drawStarburstBadge;

function drawStarShape(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// Five-star rating strip with a tiny invented review line, the "critics love it" poster flourish.
export function drawStarRatingStrip(ctx, x, y, h, quote) {
  ctx.save();
  const r = h * 0.42;
  const gap = r * 2.3;
  ctx.font = `700 ${h * 0.4}px ${SUB_FONT}`;
  ctx.letterSpacing = `${(h * 0.07).toFixed(1)}px`;
  const qw = quote ? ctx.measureText(quote).width : 0;
  const w = gap * 5 + (quote ? qw + h * 0.6 : 0) + h * 0.3;
  ctx.fillStyle = 'rgba(12,2,22,0.82)';
  ctx.beginPath();
  ctx.moveTo(x + h * 0.2, y);
  ctx.lineTo(x + w + h * 0.2, y);
  ctx.lineTo(x + w - h * 0.2, y + h);
  ctx.lineTo(x - h * 0.2, y + h);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    drawStarShape(ctx, x + h * 0.35 + r + i * gap, y + h / 2, r);
    ctx.fillStyle = '#ffd451';
    ctx.fill();
    ctx.lineWidth = Math.max(1, h * 0.06);
    ctx.strokeStyle = '#ff7a2a';
    ctx.stroke();
  }
  if (quote) {
    ctx.fillStyle = '#fff1d6';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(quote, x + h * 0.35 + gap * 5, y + h * 0.53);
  }
  ctx.restore();
}

// Monogram: the title's initials in a slanted rounded square, the studio's own mark.
export function drawMonogramMark(ctx, x, y, s, initials, accent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, ITALIC_SHEAR, 1, 0, 0);
  const r = s * 0.2;
  ctx.beginPath();
  ctx.roundRect(0, 0, s, s, r);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.strokeStyle = '#fff3dc';
  ctx.stroke();
  ctx.fillStyle = '#fff8ea';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fitFont(ctx, initials, TITLE_FONT, '', s * 0.66, s * 0.8)}px ${TITLE_FONT}`;
  ctx.fillText(initials, s / 2, s * 0.54);
  ctx.restore();
}

// Barcode + catalogue number, generated from the title so every cover gets its own.
export function drawCatalogueBarcode(ctx, x, y, w, h, seedText) {
  ctx.save();
  let seed = 7;
  for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  ctx.fillStyle = '#fff3dc';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#12021c';
  const barH = h * 0.62;
  let bx = x + w * 0.06;
  while (bx < x + w * 0.94) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const bw = Math.max(1, (w / 70) * (1 + (seed >>> 28) % 3));
    if ((seed >>> 16) & 1) ctx.fillRect(bx, y + h * 0.1, bw, barH);
    bx += bw + w / 90;
  }
  ctx.font = `600 ${h * 0.22}px ${SUB_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`0 26${String(seed % 100000).padStart(5, '0')} 1080 7`, x + w / 2, y + h * 0.94);
  ctx.restore();
}

// Fine-print credits strip along the bottom edge: monogram, invented billing block, barcode.
export function drawFinePrintCredits(ctx, layout, caption, palette) {
  const z = layout.creditsZone;
  const h = z.h;
  const title = (caption.title || 'COVER').toUpperCase().replace(/\s+/g, ' ').trim();
  const initials = title.split(' ').map((w) => w[0]).join('').slice(0, 3) || 'C';
  ctx.save();
  const markS = h * 0.7;
  drawMonogramMark(ctx, z.x + markS * 0.25, z.y + (h - markS) / 2, markS, initials, palette.script);
  const bw = h * 2.6;
  const bh = h * 0.78;
  drawCatalogueBarcode(ctx, z.x + z.w - bw, z.y + (h - bh) / 2, bw, bh, title);
  const credits = (caption.credits || `${title} · A SUNSET STATE COVER STUDIO PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED BY HAND · LETTERING AND SEAL ORIGINAL · CAT. SSC-${initials}-0626`).toUpperCase();
  const left = z.x + markS * 1.6;
  const right = z.x + z.w - bw - h * 0.5;
  const fs = fitFont(ctx, credits, SUB_FONT, 500, h * 0.3, right - left);
  ctx.font = `500 ${fs}px ${SUB_FONT}`;
  ctx.fillStyle = 'rgba(255,240,225,0.72)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(credits, (left + right) / 2, z.y + h * 0.52);
  ctx.restore();
}

// Spaced-caps tagline set over the sunset band, with a hard ink shadow so it reads on any colour.
export function drawBandTagline(ctx, layout, tagline) {
  if (!tagline) return;
  const z = layout.sunsetBand;
  const label = tagline.toUpperCase();
  ctx.save();
  let size = z.h * 0.4;
  ctx.font = `700 ${size}px ${SUB_FONT}`;
  ctx.letterSpacing = `${(size * 0.42).toFixed(1)}px`;
  const tw = ctx.measureText(label).width;
  if (tw > z.w * 0.9) {
    size *= (z.w * 0.9) / tw;
    ctx.font = `700 ${size}px ${SUB_FONT}`;
    ctx.letterSpacing = `${(size * 0.42).toFixed(1)}px`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = z.x + z.w / 2 + size * 0.21;
  const cy = z.y + z.h * 0.53;
  ctx.fillStyle = OUTLINE_INK;
  ctx.fillText(label, cx + size * 0.08, cy + size * 0.1);
  ctx.lineWidth = size * 0.16;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUTLINE_INK;
  ctx.strokeText(label, cx, cy);
  ctx.fillStyle = '#fff8ea';
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

// Maps a point from the current local transform to canvas pixels.
function toCanvasPoint(ctx, x, y) {
  const m = ctx.getTransform();
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

// Public entry: title + subtitle (script or ribbon) + badge + star strip in the layout's title zone.
export function renderCaptionLettering(ctx, layout, caption, style, palette) {
  const fill = LETTERING_FILLS[style.fill] || LETTERING_FILLS.cream;
  const zone = layout.titleZone;
  const unit = layout.unit;
  const scriptMode = (style.subtitleStyle || 'script') === 'script';
  const subtitle = (caption.subtitle || '').trim();
  // A title tile lets the lettering spill a little past its edges, over the gutters.
  const fitZone = zone.mode === 'tile' ? { w: zone.w * 1.14, h: zone.h * 1.1 } : zone;
  const fit = fitTitleBlock(ctx, caption.title, fitZone, unit, !!subtitle);
  const { lines, size } = fit;
  const tiltRad = ((style.tilt ?? -4) * Math.PI) / 180;
  const scriptSize = Math.min(size * 0.62, unit * 0.12);
  const ribbonSize = Math.max(8, Math.min(size * 0.21, unit * 0.045));
  const subH = subtitle ? (scriptMode ? scriptSize * 0.55 : ribbonSize * 1.3) : 0;
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h * 0.5;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tiltRad);
  let box = { top: -size * 0.4, bottom: size * 0.4, width: size * 3 };
  ctx.save();
  ctx.transform(1, 0, ITALIC_SHEAR, 1, 0, 0);
  ctx.translate(0, -subH / 2);
  if (lines.length) box = drawExtrudedTitle(ctx, lines, size, fill);
  const topRight = toCanvasPoint(ctx, box.width / 2, box.top);
  const topLeft = toCanvasPoint(ctx, -box.width / 2, box.top);
  if (subtitle && !scriptMode) drawSubtitleRibbon(ctx, subtitle, box.bottom + ribbonSize * 0.7, ribbonSize, palette.script);
  ctx.restore();
  if (subtitle && scriptMode) {
    const sy = -subH / 2 + box.bottom + scriptSize * 0.42;
    drawNeonScriptLine(ctx, subtitle, box.width * 0.12, sy, scriptSize, palette);
  }
  ctx.restore();

  const c = layout.content;
  if (style.extras !== false && lines.length) {
    const sh = Math.max(10, unit * 0.032);
    const sx = Math.max(c.x + sh * 0.6, topLeft.x - sh * 0.2);
    const sy = Math.max(c.y + sh * 0.4, topLeft.y - sh * 1.7);
    const quote = caption.quote ?? (zone.w > unit * 1.05 ? '“A FEVER DREAM IN NEON” — THE COAST HERALD' : zone.w > unit * 0.75 ? '“A FEVER DREAM IN NEON”' : '');
    drawStarRatingStrip(ctx, sx, sy, sh, quote);
  }
  if (style.badge) {
    const r = unit * (zone.mode === 'tile' ? 0.08 : 0.088);
    // Sits on the title's top-right corner and above it, so it never covers the letters' faces.
    // A title tile keeps its badge pinned to the tile's own corner, off the neighbouring photos' faces.
    const tile = zone.mode === 'tile';
    const bx = Math.min(c.x + c.w - r * 1.05, Math.max(c.x + r * 1.05, tile ? zone.x + zone.w - r * 0.15 : topRight.x + r * 0.2));
    const by = Math.min(c.y + c.h - r * 1.05, Math.max(c.y + r * 1.05, tile ? zone.y - r * 0.3 : topRight.y - r * 0.95));
    drawStarburstBadge(ctx, bx, by, r, style.badgeText, 12);
  }
}
