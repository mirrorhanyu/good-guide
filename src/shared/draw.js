// Shared scene drawing. Pure Canvas2D — runs against a browser CanvasRendering
// context (preview) and an @napi-rs/canvas context (export) with identical
// output. No runtime-specific APIs here; pre-loaded image objects are passed in.

import { HAND_VIEWBOX, HAND_ANCHOR, drawHandShape } from "./hand.js";
import { phaseOf, pokeCurve, pulseScale } from "./anim.js";

// Sprite base height (canvas px) at scale 1. Width follows the viewBox ratio.
export const HAND_BASE_HEIGHT = 420;
export const HAND_BASE_WIDTH = HAND_BASE_HEIGHT * (HAND_VIEWBOX.w / HAND_VIEWBOX.h);

export const DEFAULTS = {
  canvas: { w: 1080, h: 1920 },
  fps: 30,
  duration: 5, // seconds
  loopPeriod: 1.3, // seconds per poke/pulse cycle
  background: { mode: "blur", color: "#101014", blur: 40, scrim: 0.35 },
  fit: "contain",
  hand: { rotation: 0, scale: 1, fill: "#ffd9b3", outline: "#5a3b22", pokeDistance: 70 },
  box: { rotation: 0, stroke: "#ff3b30", lineWidth: 10, radius: 24, pulse: 0.06 },
};

const deg2rad = (d) => (d * Math.PI) / 180;

/** Compute contain-fit rectangle for an image inside the canvas. */
export function containRect(imgW, imgH, canvasW, canvasH) {
  const s = Math.min(canvasW / imgW, canvasH / imgH);
  const w = imgW * s;
  const h = imgH * s;
  return { x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h, scale: s };
}

/** Compute cover-fit rectangle (fills canvas, may overflow). */
export function coverRect(imgW, imgH, canvasW, canvasH) {
  const s = Math.max(canvasW / imgW, canvasH / imgH);
  const w = imgW * s;
  const h = imgH * s;
  return { x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h, scale: s };
}

/** Draw the 9:16 background + the base image (contain or cover). */
export function drawBase(ctx, baseImg, scene) {
  const { w: cw, h: ch } = scene.canvas;
  const bg = scene.background || DEFAULTS.background;

  ctx.save();
  ctx.clearRect(0, 0, cw, ch);

  if (bg.mode === "color" || !baseImg) {
    ctx.fillStyle = bg.color || "#101014";
    ctx.fillRect(0, 0, cw, ch);
  } else {
    // Blurred cover image as the fill behind the contained image.
    const cover = coverRect(baseImg.width, baseImg.height, cw, ch);
    if (ctx.filter !== undefined) ctx.filter = `blur(${bg.blur ?? 40}px)`;
    ctx.drawImage(baseImg, cover.x, cover.y, cover.w, cover.h);
    if (ctx.filter !== undefined) ctx.filter = "none";
    // Darkening scrim so foreground pops.
    ctx.fillStyle = `rgba(0,0,0,${bg.scrim ?? 0.35})`;
    ctx.fillRect(0, 0, cw, ch);
  }

  if (baseImg) {
    const fit = scene.fit === "cover" ? coverRect : containRect;
    const r = fit(baseImg.width, baseImg.height, cw, ch);
    if (scene.fit === "cover") {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, cw, ch);
      ctx.clip();
      ctx.drawImage(baseImg, r.x, r.y, r.w, r.h);
      ctx.restore();
    } else {
      ctx.drawImage(baseImg, r.x, r.y, r.w, r.h);
    }
  }
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Draw one box annotation (optionally animated). */
export function drawBox(ctx, a, t, loopPeriod) {
  const ph = phaseOf(t, loopPeriod);
  const ps = a.pulse ? pulseScale(ph, a.pulse) : 1;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(deg2rad(a.rotation || 0));
  ctx.scale(ps, ps);
  ctx.lineWidth = a.lineWidth ?? DEFAULTS.box.lineWidth;
  ctx.strokeStyle = a.stroke ?? DEFAULTS.box.stroke;
  ctx.lineJoin = "round";
  roundRectPath(ctx, -a.w / 2, -a.h / 2, a.w, a.h, a.radius ?? DEFAULTS.box.radius);
  ctx.stroke();
  ctx.restore();
}

/** Draw one hand annotation (optionally animated), using native path drawing. */
export function drawHand(ctx, a, t, loopPeriod) {
  const ph = phaseOf(t, loopPeriod);
  const scale = a.scale ?? 1;
  const poke = (a.pokeDistance ?? DEFAULTS.hand.pokeDistance) * scale * pokeCurve(ph);
  const s = scale * (HAND_BASE_HEIGHT / HAND_VIEWBOX.h); // viewBox -> canvas px

  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(deg2rad(a.rotation || 0));
  ctx.translate(0, -poke); // poke along local "up" (finger direction)
  ctx.scale(s, s);
  // place so the fingertip anchor lands at the origin
  ctx.translate(-HAND_ANCHOR.x * HAND_VIEWBOX.w, -HAND_ANCHOR.y * HAND_VIEWBOX.h);
  drawHandShape(ctx, { fill: a.fill ?? DEFAULTS.hand.fill, outline: a.outline ?? DEFAULTS.hand.outline });
  ctx.restore();
}

/** Draw all annotations for an image at time t. */
export function drawAnnotations(ctx, annotations, t, loopPeriod) {
  for (const a of annotations || []) {
    if (a.type === "box") drawBox(ctx, a, t, loopPeriod);
    else if (a.type === "hand") drawHand(ctx, a, t, loopPeriod);
  }
}

/** Full frame: base + annotations at time t. */
export function renderFrame(ctx, scene, image, baseImg, t) {
  drawBase(ctx, baseImg, scene);
  drawAnnotations(ctx, image.annotations, t, scene.loopPeriod ?? DEFAULTS.loopPeriod);
}
