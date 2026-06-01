// Shared hand-sprite drawing. Uses only native Canvas2D path commands so it
// renders identically in the browser (preview) and in Node via @napi-rs/canvas
// (export) — no SVG decoding or Path2D constructor differences to worry about.
//
// The sprite is a stylised "pointing up" hand drawn in its own coordinate space
// (the viewBox). The fingertip sits at the top centre so callers can use it as
// the anchor / rotation pivot: drag the fingertip onto the target, and the poke
// animation slides the hand along its local "up" axis and back.

export const HAND_VIEWBOX = { w: 120, h: 178 };

// Fingertip location inside the viewBox, as a ratio of the viewBox.
export const HAND_ANCHOR = {
  x: 60 / HAND_VIEWBOX.w,
  y: 6 / HAND_VIEWBOX.h,
};

const STROKE_W = 5; // in viewBox units

function fingerPath(ctx) {
  ctx.moveTo(48, 78);
  ctx.lineTo(48, 28);
  ctx.quadraticCurveTo(48, 6, 60, 6);
  ctx.quadraticCurveTo(72, 6, 72, 28);
  ctx.lineTo(72, 78);
  ctx.closePath();
}

function fistPath(ctx) {
  ctx.moveTo(34, 86);
  ctx.quadraticCurveTo(34, 70, 50, 70);
  ctx.lineTo(92, 70);
  ctx.quadraticCurveTo(108, 70, 108, 90);
  ctx.lineTo(108, 140);
  ctx.quadraticCurveTo(108, 168, 80, 168);
  ctx.lineTo(58, 168);
  ctx.quadraticCurveTo(34, 168, 30, 144);
  ctx.lineTo(24, 112);
  ctx.quadraticCurveTo(20, 90, 38, 88);
  ctx.quadraticCurveTo(34, 96, 40, 104);
  ctx.closePath();
}

function thumbPath(ctx) {
  ctx.moveTo(34, 92);
  ctx.quadraticCurveTo(14, 96, 16, 116);
  ctx.quadraticCurveTo(18, 130, 36, 128);
  ctx.quadraticCurveTo(30, 110, 40, 102);
  ctx.closePath();
}

function fillStroke(ctx, drawPath, fill, outline) {
  ctx.beginPath();
  drawPath(ctx);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = STROKE_W;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Draw the hand into the current ctx transform, in viewBox coordinates
 * (0..120 x, 0..178 y). Caller is responsible for translate/rotate/scale and
 * for placing the anchor. Colours are configurable.
 */
export function drawHandShape(ctx, { fill = "#ffd9b3", outline = "#5a3b22" } = {}) {
  fillStroke(ctx, thumbPath, fill, outline);
  fillStroke(ctx, fistPath, fill, outline);
  fillStroke(ctx, fingerPath, fill, outline);

  // folded-finger seams
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(62, 78);
  ctx.lineTo(62, 71);
  ctx.moveTo(80, 78);
  ctx.lineTo(80, 71);
  ctx.stroke();
  ctx.restore();
}
