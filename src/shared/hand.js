// Shared hand-sprite drawing. Uses only native Canvas2D path commands so it
// renders identically in the browser (preview) and in Node via @napi-rs/canvas
// (export).
//
// A "pointing up" hand: index finger extended, the other fingers folded into a
// fist, thumb tucked on the side. Drawn as one continuous silhouette (fill +
// outline) plus a few interior crease lines, so it reads as a real hand rather
// than a blob. The fingertip sits at the top so callers use it as the anchor /
// rotation pivot, and the poke animation slides the hand along its local "up".

export const HAND_VIEWBOX = { w: 200, h: 300 };

// Fingertip apex inside the viewBox (anchor / pivot), as a ratio of the viewBox.
export const HAND_ANCHOR = { x: 80 / HAND_VIEWBOX.w, y: 12 / HAND_VIEWBOX.h };

// Actual drawn extents in viewBox units (used for selection bounds / hit-test).
export const HAND_BBOX = { minx: 10, miny: 12, maxx: 172, maxy: 282 };

const STROKE_W = 6;

function handOutline(ctx) {
  // start at the web between thumb and index
  ctx.moveTo(62, 150);
  // up the left side of the index finger
  ctx.lineTo(62, 44);
  // round the fingertip
  ctx.quadraticCurveTo(62, 12, 80, 12);
  ctx.quadraticCurveTo(98, 12, 98, 44);
  // down the right side of the index to the knuckle
  ctx.lineTo(98, 132);
  // over the folded-finger knuckles (back of hand)
  ctx.bezierCurveTo(112, 118, 150, 120, 166, 152);
  // right side of the fist
  ctx.bezierCurveTo(174, 178, 172, 214, 160, 240);
  // bottom-right down to the wrist
  ctx.quadraticCurveTo(150, 264, 122, 274);
  // wrist / cuff bottom edge
  ctx.quadraticCurveTo(86, 286, 56, 270);
  // up the left side of the palm toward the thumb
  ctx.bezierCurveTo(46, 254, 42, 226, 41, 206);
  // thumb: bulge out and up to the tip
  ctx.bezierCurveTo(30, 198, 14, 188, 12, 168);
  ctx.bezierCurveTo(11, 152, 24, 150, 38, 158);
  // back up to the thumb/index web
  ctx.bezierCurveTo(48, 150, 54, 150, 62, 150);
  ctx.closePath();
}

function creases(ctx, outline) {
  ctx.save();
  ctx.strokeStyle = outline;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  // folded-finger seams on the back of the hand
  ctx.moveTo(112, 126); ctx.quadraticCurveTo(120, 150, 118, 178);
  ctx.moveTo(134, 124); ctx.quadraticCurveTo(144, 150, 142, 182);
  ctx.moveTo(154, 132); ctx.quadraticCurveTo(164, 156, 162, 186);
  // thumb crease
  ctx.moveTo(44, 168); ctx.quadraticCurveTo(58, 176, 64, 192);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw the hand in viewBox coordinates (0..200 x, 0..300 y). The caller sets
 * translate/rotate/scale and anchor placement. Colours are configurable.
 */
export function drawHandShape(ctx, { fill = "#ffce9e", outline = "#6b4226" } = {}) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  handOutline(ctx);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = STROKE_W;
  ctx.strokeStyle = outline;
  ctx.stroke();
  creases(ctx, outline);
  ctx.restore();
}
