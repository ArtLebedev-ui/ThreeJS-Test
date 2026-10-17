import * as THREE from 'three';
import opentype from 'three/examples/jsm/libs/opentype.module.js';

export async function loadFont(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const font = opentype.parse(buf);
  const cap = font.tables.os2?.sCapHeight || font.charToGlyph('H').getBoundingBox().y2;
  return { font, cap, upm: font.unitsPerEm };
}

function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Glyph outline to THREE shapes. Holes are found by containment depth rather than winding,
 * so TrueType and CFF fonts (opposite winding conventions) both work.
 */
export function glyphShapes({ font, upm }, char, s) {
  const cmds = font.charToGlyph(char).getPath(0, 0, upm).commands;
  const contours = [];
  let cur = null;
  const P = (x, y) => [x * s, -y * s];
  for (const c of cmds) {
    if (c.type === 'M') {
      cur = new THREE.Shape();
      cur.moveTo(...P(c.x, c.y));
      contours.push(cur);
    } else if (c.type === 'L') cur.lineTo(...P(c.x, c.y));
    else if (c.type === 'Q') cur.quadraticCurveTo(...P(c.x1, c.y1), ...P(c.x, c.y));
    else if (c.type === 'C') cur.bezierCurveTo(...P(c.x1, c.y1), ...P(c.x2, c.y2), ...P(c.x, c.y));
    else if (c.type === 'Z') cur.closePath();
  }
  const info = contours.map((path) => {
    const pts = path.getPoints(6);
    return { path, pts, area: Math.abs(THREE.ShapeUtils.area(pts)) };
  });
  for (const c of info) {
    c.parents = info.filter((o) => o !== c && o.area > c.area && pointInPoly(c.pts[0], o.pts));
    c.depth = c.parents.length;
  }
  const shapes = [];
  for (const c of info.filter((c) => c.depth % 2 === 0)) {
    shapes.push(c.path);
    c.path.holes = [];
  }
  for (const c of info.filter((c) => c.depth % 2 === 1)) {
    const parent = c.parents.filter((p) => p.depth === c.depth - 1).sort((a, b) => a.area - b.area)[0];
    parent?.path.holes.push(c.path);
  }
  return shapes;
}

export function glyphGeometry(f, char, s, { depth = 0.24, bevel = 0.022, curveSegments = 10 } = {}) {
  const g = new THREE.ExtrudeGeometry(glyphShapes(f, char, s), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel * 1.3,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  g.computeBoundingBox();
  return g;
}

export const advance = ({ font }, char, s) => font.charToGlyph(char).advanceWidth * s;
export const kerning = ({ font }, a, b, s) => font.getKerningValue(font.charToGlyph(a), font.charToGlyph(b)) * s;
