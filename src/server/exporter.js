// Batch exporter: render each image's annotated, looping animation frame by
// frame with @napi-rs/canvas and pipe raw RGBA into ffmpeg to encode H.264 mp4.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { renderFrame, DEFAULTS } from "../shared/draw.js";
import { buildHandSVG } from "../shared/hand.js";

/** Pre-rasterise the recoloured hand sprite for every colour used in an image. */
async function loadHandImages(image) {
  const colours = new Set(
    (image.annotations || [])
      .filter((a) => a.type === "hand")
      .map((a) => a.fill ?? DEFAULTS.hand.fill)
  );
  const map = {};
  for (const c of colours) map[c] = await loadImage(Buffer.from(buildHandSVG(c)));
  return map;
}

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

function writeAsync(stream, buf) {
  return new Promise((resolve, reject) => {
    stream.write(buf, (err) => (err ? reject(err) : resolve()));
  });
}

/** Export a single image to mp4. Returns the output path. */
export async function exportImage(scene, image, { onFrame } = {}) {
  const { w, h } = scene.canvas;
  const fps = scene.fps || 30;
  const frames = Math.max(1, Math.round((scene.duration || 5) * fps));

  const baseImg = await loadImage(path.join(scene.inputDir, image.file));
  const handImages = await loadHandImages(image);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  const base = path.parse(image.file).name;
  const outPath = path.join(scene.outputDir, `${base}.mp4`);
  fs.mkdirSync(scene.outputDir, { recursive: true });

  const args = [
    "-y",
    "-f", "rawvideo",
    "-pixel_format", "rgba",
    "-video_size", `${w}x${h}`,
    "-framerate", String(fps),
    "-i", "pipe:0",
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-r", String(fps),
    "-preset", "medium",
    "-crf", "20",
    "-movflags", "+faststart",
    outPath,
  ];

  const ff = spawn(FFMPEG, args, { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  ff.stderr.on("data", (d) => (stderr += d.toString()));

  const done = new Promise((resolve, reject) => {
    ff.on("error", (e) =>
      reject(new Error(`Failed to launch ffmpeg (${FFMPEG}): ${e.message}`))
    );
    ff.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-2000)}`))
    );
  });

  try {
    for (let i = 0; i < frames; i++) {
      const t = i / fps;
      renderFrame(ctx, scene, image, baseImg, t, handImages);
      const { data } = ctx.getImageData(0, 0, w, h);
      const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      if (!ff.stdin.write(buf)) {
        await new Promise((r) => ff.stdin.once("drain", r));
      }
      if (onFrame) onFrame(i + 1, frames);
    }
    ff.stdin.end();
  } catch (e) {
    ff.kill("SIGKILL");
    throw e;
  }

  await done;
  return outPath;
}

/** Export every image. onProgress({index,total,file,phase,frame,frames,outPath}). */
export async function exportAll(scene, { onProgress } = {}) {
  const images = scene.images || [];
  const results = [];
  for (let idx = 0; idx < images.length; idx++) {
    const image = images[idx];
    onProgress?.({ index: idx, total: images.length, file: image.file, phase: "start" });
    const outPath = await exportImage(scene, image, {
      onFrame: (frame, frames) =>
        onProgress?.({ index: idx, total: images.length, file: image.file, phase: "frame", frame, frames }),
    });
    results.push({ file: image.file, outPath });
    onProgress?.({ index: idx, total: images.length, file: image.file, phase: "done", outPath });
  }
  return results;
}
