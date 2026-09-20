// Generates the method graphic for research.html: how one observation becomes
// a network. Three feature pairs from a reference population on the left, one
// observation off each expected relationship, and the three deviations carried
// across as the edge weights of a three node graph on the right.
//
// The seed is fixed so the picture is reproducible. That is not a convenience:
// the site claims reproducibility as a property of the product, and a graphic
// that comes out identical every time it is generated is a small, free proof
// of the same idea. The home page network uses seed 20260920; this uses
// 20260921 so the two pictures are not the same noise.
//
// Deviation maps to stroke width because that is the method. The parenclitic
// representation measures how far one observation sits from the relationship
// a reference population expects between two features, and that distance is
// the weight of the edge between those two features. Drawing it any other way
// would show a picture of a network rather than the construction of one.
//
// This is an illustration of a method, not a plot of measurements. The
// reference scatter is seeded and random so it looks like a population, but
// the three deviations of the subject observation are FIXED, chosen so that
// the three edge widths can be told apart at reading distance. Nothing in
// this picture is a result, and it must never be captioned or cited as one.
//
// The output is static SVG, pasted into research.html by hand. The page stays
// free of JavaScript at runtime; nothing is generated in the browser.
//
//   node tools/research-graphic.mjs            leaders from panel to edge
//   node tools/research-graphic.mjs --arrow    one arrow instead of leaders

const SEED = 20260921;

// mulberry32: small, fast, and good enough for a picture. Same generator as
// the home page graph so the two are produced the same way.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const between = (lo, hi) => lo + (hi - lo) * rand();
// Box-Muller, so the reference scatter is Gaussian around the line rather than
// a uniform band, which is what a real population looks like.
function gauss(sd) {
  const u = 1 - rand(), v = rand();
  return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const f = (n) => Math.round(n * 10) / 10;

// --- panels ----------------------------------------------------------------
// Three feature pairs, stacked. Each panel is 260 x 130 in its own coordinates.
const PANEL_W = 260, PANEL_H = 130, PANEL_Y = [0, 160, 320];
const N_REF = 90;

// The subject's deviation in each panel, in units of that panel's scatter.
// Fixed, not sampled: the picture exists to show that a distance becomes a
// weight, and three widths that cannot be told apart would say nothing. The
// values are chosen for legibility, roughly 2, 4 and 7 pixel edges, and the
// order is deliberately not monotonic so the column does not read as a scale.
// The largest sits in the bottom panel, whose edge faces the panels, so the
// accent thread from point to edge never has to pass behind another edge.
const SIGMAS = [1.9, 0.9, 3.4];

const panels = PANEL_Y.map((y0, i) => {
  // A weak positive relationship: y falls as x rises, because SVG y points
  // down. Slope and intercept vary a little per panel so the three do not
  // read as copies.
  const slope = -between(0.16, 0.24);
  const intercept = between(88, 100);
  const line = (x) => intercept + slope * x;
  const sd = between(10, 13);

  const refs = [];
  for (let i = 0; i < N_REF; i++) {
    const x = between(14, PANEL_W - 14);
    let y = line(x) + gauss(sd);
    y = Math.min(PANEL_H - 6, Math.max(6, y));
    refs.push([f(x), f(y0 + y)]);
  }

  // One observation, clearly off the line. The deviation is drawn in the
  // open, so its size is what the reader compares across panels.
  const ox = between(96, 196);
  const sigma = SIGMAS[i];
  const dev = sigma * sd;
  const side = rand() < 0.5 ? -1 : 1;
  const oy = line(ox) + side * dev;

  return {
    y0, sigma,
    fit: [[0, f(y0 + line(0))], [PANEL_W, f(y0 + line(PANEL_W))]],
    refs,
    obs: [f(ox), f(y0 + oy)],
    foot: [f(ox), f(y0 + line(ox))],
  };
});

// --- graph -----------------------------------------------------------------
// Three nodes as a triangle with a vertex pointing at the panels, so two of
// the three edges face them. A leader has to land on the edge itself, since
// the edge is what the deviation becomes, and the edge it lands on is decided
// deterministically: edge midpoints sorted by y, panels sorted by the y of
// their subject point, paired in that order. Both sequences are monotonic in
// y, so no two leaders can cross. One leader still has to reach the far
// edge past a near one; that is the middle panel's, and it carries the
// smallest deviation, so it is the faintest line in the picture.
// The left vertex sits below the middle panel's leader on purpose. With the
// vertex at the leader's height the line appeared to end on the node, which
// is exactly the misreading the leaders exist to prevent.
const nodes = [[420, 285], [600, 140], [600, 340]];
const edges = [[0, 1], [1, 2], [0, 2]];
const mid = (a, b) => [f((a[0] + b[0]) / 2), f((a[1] + b[1]) / 2)];
const mids = edges.map(([a, b]) => mid(nodes[a], nodes[b]));

const edgeOrder = mids.map((m, i) => i).sort((i, j) => mids[i][1] - mids[j][1]);
const panelOrder = panels.map((p, i) => i).sort((i, j) => panels[i].obs[1] - panels[j].obs[1]);
// edgeOf[panel] = edge index that panel's deviation becomes
const edgeOf = [];
panelOrder.forEach((pi, k) => { edgeOf[pi] = edgeOrder[k]; });

// Two units of sigma per pixel of stroke: 0.9, 1.9 and 3.4 sigma give edges
// of about 2, 4 and 7 pixels. Screen pixels, since strokes do not scale.
const width = (sigma) => f(2 * sigma);
const imax = panels.map((p) => p.sigma).indexOf(Math.max(...panels.map((p) => p.sigma)));

// Belt and braces: assert that no two leaders intersect, so a future change to
// the node positions or the seed cannot quietly break the one thing the
// picture is for.
function segmentsCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
const leaders = panels.map((p, i) => [p.obs, mids[edgeOf[i]]]);
for (let i = 0; i < leaders.length; i++) {
  for (let j = i + 1; j < leaders.length; j++) {
    if (segmentsCross(leaders[i][0], leaders[i][1], leaders[j][0], leaders[j][1])) {
      throw new Error(`Leaders ${i} and ${j} cross; the pairing should make that impossible.`);
    }
  }
}
// And that no leader passes close enough to a node to look as if it ends
// there. A leader lands on an edge, never on a node.
function pointToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
leaders.forEach(([a, b], i) => {
  nodes.forEach((n, k) => {
    if (pointToSegment(n, a, b) < 24) {
      throw new Error(`Leader ${i} passes within 24 units of node ${k}; move the node.`);
    }
  });
});

// --- output ----------------------------------------------------------------
const arrow = process.argv.includes('--arrow');
const out = [];
out.push('<svg viewBox="0 0 640 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="research-art-title" focusable="false">');
out.push('  <title id="research-art-title">Three feature pairs from a reference population. One observation deviates from each expected relationship, and those three deviations become the weights of a three node network.</title>');

for (const p of panels) {
  out.push('  <g>');
  out.push(`    <line class="fit" x1="${p.fit[0][0]}" y1="${p.fit[0][1]}" x2="${p.fit[1][0]}" y2="${p.fit[1][1]}"/>`);
  out.push('    <path class="ref" d="' + p.refs.map(([x, y]) => `M${x - 1.6} ${y}a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0`).join('') + '"/>');
  out.push(`    <line class="dev" x1="${p.obs[0]}" y1="${p.obs[1]}" x2="${p.foot[0]}" y2="${p.foot[1]}"/>`);
  out.push(`    <circle class="obs" cx="${p.obs[0]}" cy="${p.obs[1]}" r="4"/>`);
  out.push('  </g>');
}

if (arrow) {
  out.push('  <path class="leader" d="M300 232L368 262M361 254L368 262L359 270"/>');
} else {
  // From the subject point itself to the midpoint of its edge. The largest
  // deviation's leader is in the accent, so the eye can follow one thread:
  // the outlying point, its deviation, its leader, its edge.
  leaders.forEach(([from, to], i) => {
    const cls = i === imax ? 'leader leader-max' : 'leader';
    out.push(`  <line class="${cls}" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"/>`);
  });
}

edges.forEach(([a, b], e) => {
  const pi = edgeOf.indexOf(e);
  const cls = pi === imax ? 'edge edge-max' : 'edge';
  out.push(`  <line class="${cls}" x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}" stroke-width="${width(panels[pi].sigma)}"/>`);
});
for (const [x, y] of nodes) out.push(`  <circle class="node" cx="${x}" cy="${y}" r="6"/>`);
out.push('</svg>');

process.stdout.write(out.join('\n') + '\n');
