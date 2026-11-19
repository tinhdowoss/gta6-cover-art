// Panel geometry for the cover: every layout is a tree of slanted cuts through the cover's content area.
// Each leaf becomes a convex polygon (a tilted/angled panel); gutters are produced by insetting every
// polygon, so the white lines between panels stay the same thickness whatever the angle of the cut.

export const COVER_SIZES = [
  { id: '1920x1080', w: 1920, h: 1080, label: '1920 × 1080', hint: 'Landscape' },
  { id: '1080x1350', w: 1080, h: 1350, label: '1080 × 1350', hint: 'Portrait' },
  { id: '1080x1080', w: 1080, h: 1080, label: '1080 × 1080', hint: 'Square' },
];

export const LAYOUT_CHOICES = [
  { id: 'hero', short: 'Hero', label: 'Hero collage', hint: 'Big hero panel + 5 tilted panels, title across them' },
  { id: 'collage', short: 'Comic', label: 'Comic page', hint: '7 tilted panels + sunset title tile' },
  { id: 'mosaic', short: '9 panels', label: '9-panel mosaic', hint: 'Hero + 8 tilted panels' },
  { id: 'single', short: '1 panel', label: '1 panel', hint: 'Full bleed hero' },
  { id: 'duo', label: '2 panels', hint: 'Split' },
  { id: 'trio', label: '3 panels', hint: 'Hero + two' },
  { id: 'quad', label: '4 panels', hint: 'Angled grid' },
];

const P = { kind: 'photo' };
const T = { kind: 'title' };
const cutV = (at, slant, a, b) => ({ cut: 'v', at, slant, a, b });
const cutH = (at, slant, a, b) => ({ cut: 'h', at, slant, a, b });

// Hand-tuned cut trees per aspect class, so the collage re-flows instead of being squashed.
const HERO = { kind: 'photo', hero: true };
const LAYOUT_TREES = {
  landscape: {
    hero: cutV(0.57, 5, HERO,
      cutH(0.36, -4, cutV(0.52, -7, P, P),
        cutH(0.5, 4, P, cutV(0.46, 7, P, P)))),
    mosaic: cutV(0.46, 5, HERO,
      cutH(0.34, -4, cutV(0.36, -6, P, cutV(0.5, 6, P, P)),
        cutH(0.52, 3, cutV(0.56, 6, P, P), cutV(0.33, -6, P, cutV(0.5, 5, P, P))))),
    single: P,
    duo: cutV(0.5, 7, P, P),
    trio: cutV(0.57, 6, P, cutH(0.5, -5, P, P)),
    quad: cutV(0.5, 6, cutH(0.56, -4, P, P), cutH(0.44, -4, P, P)),
    collage: cutV(0.29, 5,
      cutH(0.56, -5, P, P),
      cutV(0.62, -6,
        cutH(0.33, 3, P, cutH(0.62, -3, T, P)),
        cutH(0.4, 6, P, cutH(0.55, -4, P, P)))),
  },
  portrait: {
    hero: cutH(0.7, -3,
      cutV(0.62, 4, HERO, cutH(0.34, -5, P, cutH(0.5, 5, P, P))),
      cutV(0.5, -7, P, P)),
    mosaic: cutH(0.62, -3,
      cutV(0.64, 4, HERO, cutH(0.5, -5, P, P)),
      cutH(0.5, 4, cutV(0.36, -6, P, cutV(0.5, 6, P, P)), cutV(0.5, 6, P, cutV(0.5, -5, P, P)))),
    single: P,
    duo: cutH(0.5, -6, P, P),
    trio: cutH(0.56, -5, P, cutV(0.5, 6, P, P)),
    quad: cutH(0.5, -5, cutV(0.55, 6, P, P), cutV(0.45, 6, P, P)),
    collage: cutH(0.34, -3,
      cutV(0.56, 6, P, cutH(0.5, -4, P, P)),
      cutH(0.5, 4,
        cutV(0.36, -5, P, T),
        cutV(0.34, 5, P, cutV(0.5, -4, P, P)))),
  },
  square: {
    hero: cutH(0.72, -3,
      cutV(0.59, 4, HERO, cutH(0.5, -6, P, P)),
      cutV(0.36, 6, P, cutV(0.5, -6, P, P))),
    mosaic: cutH(0.66, -3,
      cutV(0.55, 4, HERO, cutH(0.34, -5, P, cutH(0.5, 5, P, P))),
      cutV(0.25, 6, P, cutV(0.34, -6, P, cutV(0.5, 6, P, P)))),
    single: P,
    duo: cutV(0.5, 6, P, P),
    trio: cutV(0.56, 6, P, cutH(0.5, -5, P, P)),
    quad: cutV(0.5, 5, cutH(0.55, -4, P, P), cutH(0.45, -4, P, P)),
    collage: cutH(0.38, -3,
      cutV(0.4, 5, P, cutV(0.52, -5, P, P)),
      cutH(0.55, 4,
        cutV(0.62, -5, T, P),
        cutV(0.3, 6, P, cutV(0.55, -4, P, P)))),
  },
};

// Where the overlaid title block sits (fractions of the content box): low and wide, so the
// lettering spans the hero and the panels beside it instead of hiding inside one tile.
const OVERLAY_TITLE_ZONES = {
  landscape: { hero: [0.015, 0.47, 0.74, 0.5], mosaic: [0.01, 0.47, 0.7, 0.5], default: [0.17, 0.52, 0.66, 0.44] },
  portrait: { hero: [0.02, 0.49, 0.96, 0.36], mosaic: [0.02, 0.45, 0.96, 0.36], default: [0.04, 0.58, 0.92, 0.36] },
  square: { hero: [0.02, 0.47, 0.96, 0.4], mosaic: [0.02, 0.43, 0.96, 0.4], default: [0.06, 0.54, 0.88, 0.4] },
};

export function aspectClassOf(w, h) {
  const r = w / h;
  if (r > 1.3) return 'landscape';
  if (r < 0.9) return 'portrait';
  return 'square';
}

export function polygonBounds(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function polygonCentroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p.x; y += p.y; }
  return { x: x / poly.length, y: y / poly.length };
}

// Sutherland–Hodgman against one half-plane: keeps the side where cross(dir, v - origin) has the given sign.
function clipPolygonToHalfPlane(poly, origin, dir, keepSign) {
  const side = (p) => keepSign * (dir.x * (p.y - origin.y) - dir.y * (p.x - origin.x));
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % poly.length];
    const sc = side(cur);
    const sn = side(nxt);
    if (sc >= 0) out.push(cur);
    if ((sc >= 0) !== (sn >= 0)) {
      const t = sc / (sc - sn);
      out.push({ x: cur.x + (nxt.x - cur.x) * t, y: cur.y + (nxt.y - cur.y) * t });
    }
  }
  return out;
}

export function splitPolygonBySlantedCut(poly, node) {
  const b = polygonBounds(poly);
  const rad = (node.slant * Math.PI) / 180;
  let origin, dir, probeA;
  if (node.cut === 'v') {
    origin = { x: b.x + node.at * b.w, y: b.y + b.h / 2 };
    dir = { x: Math.sin(rad), y: Math.cos(rad) };
    probeA = { x: b.x - 1e5, y: origin.y };
  } else {
    origin = { x: b.x + b.w / 2, y: b.y + node.at * b.h };
    dir = { x: Math.cos(rad), y: Math.sin(rad) };
    probeA = { x: origin.x, y: b.y - 1e5 };
  }
  const signA = Math.sign(dir.x * (probeA.y - origin.y) - dir.y * (probeA.x - origin.x)) || 1;
  return [clipPolygonToHalfPlane(poly, origin, dir, signA), clipPolygonToHalfPlane(poly, origin, dir, -signA)];
}

// Moves every edge of a convex polygon inward by d and re-intersects neighbours: uniform-width gutters.
export function insetConvexPolygon(poly, d) {
  const c = polygonCentroid(poly);
  const lines = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    let nx = -(b.y - a.y) / len;
    let ny = (b.x - a.x) / len;
    if ((c.x - a.x) * nx + (c.y - a.y) * ny < 0) { nx = -nx; ny = -ny; }
    lines.push({ px: a.x + nx * d, py: a.y + ny * d, dx: b.x - a.x, dy: b.y - a.y });
  }
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l1 = lines[(i + lines.length - 1) % lines.length];
    const l2 = lines[i];
    const den = l1.dx * l2.dy - l1.dy * l2.dx;
    if (Math.abs(den) < 1e-9) { out.push({ x: l2.px, y: l2.py }); continue; }
    const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / den;
    out.push({ x: l1.px + l1.dx * t, y: l1.py + l1.dy * t });
  }
  return out;
}

export function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function tracePolygonPath(ctx, poly) {
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

function collectLeafPanels(node, poly, out) {
  if (!node.cut) {
    out.push({ kind: node.kind, hero: !!node.hero, rawPoly: poly });
    return;
  }
  const [a, b] = splitPolygonBySlantedCut(poly, node);
  collectLeafPanels(node.a, a, out);
  collectLeafPanels(node.b, b, out);
}

// The whole cover geometry for one output size: dark frame, gutter colour area, panel polygons,
// where the title lettering sits and the band that holds the tagline.
export function computeTiltedPanelLayout(layoutId, W, H) {
  const aspect = aspectClassOf(W, H);
  const tree = (LAYOUT_TREES[aspect] || LAYOUT_TREES.square)[layoutId] || LAYOUT_TREES[aspect].hero;
  const unit = Math.min(W, H);
  const margin = Math.round(unit * 0.024);
  const sunsetBand = Math.round(unit * 0.078);
  const creditsStrip = Math.round(unit * 0.04);
  const gutter = Math.max(3, Math.round(unit * 0.008));
  const content = { x: margin, y: margin, w: W - margin * 2, h: H - margin - sunsetBand - creditsStrip };
  const half = gutter / 2;
  const startPoly = [
    { x: content.x + half, y: content.y + half },
    { x: content.x + content.w - half, y: content.y + half },
    { x: content.x + content.w - half, y: content.y + content.h - half },
    { x: content.x + half, y: content.y + content.h - half },
  ];
  const leaves = [];
  collectLeafPanels(tree, startPoly, leaves);
  let photoSlot = 0;
  const panels = leaves.map((leaf, index) => {
    const poly = insetConvexPolygon(leaf.rawPoly, half);
    const panel = { index, kind: leaf.kind, hero: leaf.hero, poly, bbox: polygonBounds(poly), photoSlot: -1 };
    if (leaf.kind === 'photo') panel.photoSlot = photoSlot++;
    return panel;
  });
  const titlePanel = panels.find((p) => p.kind === 'title');
  let titleZone;
  if (titlePanel) {
    titleZone = { mode: 'tile', ...titlePanel.bbox };
  } else {
    const zones = OVERLAY_TITLE_ZONES[aspect];
    const [fx, fy, fw, fh] = zones[layoutId] || zones.default;
    titleZone = { mode: 'overlay', x: content.x + fx * content.w, y: content.y + fy * content.h, w: fw * content.w, h: fh * content.h };
  }
  const bandTop = content.y + content.h + gutter * 1.5;
  return {
    W, H, aspect, layoutId, unit, margin, gutter, content, panels, titleZone,
    photoPanelCount: photoSlot,
    sunsetBand: { x: content.x, y: bandTop, w: content.w, h: content.y + content.h + sunsetBand - bandTop },
    creditsZone: { x: content.x, y: content.y + content.h + sunsetBand, w: content.w, h: creditsStrip },
  };
}
