// Project = the editable state for one input folder, persisted as project.json
// in the output folder so progress is never lost.

import fs from "node:fs";
import path from "node:path";
import { DEFAULTS } from "../shared/draw.js";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"]);
const PROJECT_FILE = "project.json";

let idCounter = 0;
export function newId(prefix = "id") {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/** List image files (basenames) in a directory, sorted naturally. */
export function scanImages(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    throw new Error(`Cannot read input directory: ${dir} (${e.message})`);
  }
  return entries
    .filter((e) => e.isFile() && IMAGE_EXT.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function projectPath(outputDir) {
  return path.join(outputDir, PROJECT_FILE);
}

function freshScene(inputDir, outputDir) {
  return {
    version: 1,
    inputDir,
    outputDir,
    canvas: { ...DEFAULTS.canvas },
    fps: DEFAULTS.fps,
    duration: DEFAULTS.duration,
    loopPeriod: DEFAULTS.loopPeriod,
    fit: DEFAULTS.fit,
    background: { ...DEFAULTS.background },
    images: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Load existing project.json (if any) and reconcile it with the images
 * currently present on disk: keep annotations for surviving files, append new
 * files, drop vanished ones, preserve saved ordering.
 */
export function loadOrInitProject(inputDir, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const p = projectPath(outputDir);

  let scene;
  if (fs.existsSync(p)) {
    try {
      scene = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      scene = null;
    }
  }
  if (!scene) scene = freshScene(inputDir, outputDir);
  scene.inputDir = inputDir;
  scene.outputDir = outputDir;

  const filesOnDisk = scanImages(inputDir);
  const onDisk = new Set(filesOnDisk);
  const byFile = new Map((scene.images || []).map((im) => [im.file, im]));

  // keep existing (in saved order) that still exist
  const merged = (scene.images || [])
    .filter((im) => onDisk.has(im.file))
    .map((im) => ({ ...im, annotations: im.annotations || [] }));
  const present = new Set(merged.map((im) => im.file));

  // append newly-discovered files
  for (const f of filesOnDisk) {
    if (!present.has(f)) merged.push({ id: newId("img"), file: f, annotations: [] });
  }
  void byFile;
  scene.images = merged;
  return scene;
}

/** Persist the scene to project.json (atomic-ish via temp file). */
export function saveProject(scene) {
  scene.updatedAt = new Date().toISOString();
  fs.mkdirSync(scene.outputDir, { recursive: true });
  const p = projectPath(scene.outputDir);
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(scene, null, 2));
  fs.renameSync(tmp, p);
  return p;
}
