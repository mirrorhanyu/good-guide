import { drawBase, drawAnnotations, DEFAULTS, HAND_BASE_HEIGHT } from "/shared/draw.js";
import { HAND_VIEWBOX, HAND_ANCHOR } from "/shared/hand.js";

// ---------- state ----------
let scene = null;
let selImageId = null;
let selAnnId = null;
const baseImages = new Map(); // file -> HTMLImageElement (loaded)
let bgCanvas = document.createElement("canvas");
let bgCtx = bgCanvas.getContext("2d");
let bgKey = ""; // invalidation key for the cached background
let startTime = performance.now();

const stage = document.getElementById("stage");
const ctx = stage.getContext("2d");
const $ = (id) => document.getElementById(id);

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "a" + Math.random().toString(36).slice(2));

const curImage = () => (scene?.images || []).find((im) => im.id === selImageId) || null;
const curAnn = () => (curImage()?.annotations || []).find((a) => a.id === selAnnId) || null;

// ---------- boot ----------
init();
async function init() {
  scene = await (await fetch("/api/project")).json();
  buildList();
  if (scene.images.length) selectImage(scene.images[0].id);
  syncGlobals();
  requestAnimationFrame(loop);
  window.addEventListener("resize", fitStage);
}

// ---------- left: image list + reorder ----------
function buildList() {
  const ul = $("imageList");
  ul.innerHTML = "";
  $("imgCount").textContent = `(${scene.images.length})`;
  scene.images.forEach((im, i) => {
    const li = document.createElement("li");
    li.className = "img-item" + (im.id === selImageId ? " active" : "");
    li.draggable = true;
    li.dataset.id = im.id;
    li.innerHTML = `<span class="idx">${i + 1}</span>
      <img src="/api/image?file=${encodeURIComponent(im.file)}" alt="" />
      <span class="meta"><div class="name">${im.file}</div>
      <div class="sub">${im.annotations.length} 个标注</div></span>`;
    li.addEventListener("click", () => selectImage(im.id));
    addDnd(li);
    ul.appendChild(li);
  });
}

let dragId = null;
function addDnd(li) {
  li.addEventListener("dragstart", () => { dragId = li.dataset.id; li.classList.add("dragging"); });
  li.addEventListener("dragend", () => { dragId = null; li.classList.remove("dragging"); document.querySelectorAll(".dragover").forEach((e) => e.classList.remove("dragover")); });
  li.addEventListener("dragover", (e) => { e.preventDefault(); li.classList.add("dragover"); });
  li.addEventListener("dragleave", () => li.classList.remove("dragover"));
  li.addEventListener("drop", (e) => {
    e.preventDefault();
    li.classList.remove("dragover");
    const from = scene.images.findIndex((x) => x.id === dragId);
    const to = scene.images.findIndex((x) => x.id === li.dataset.id);
    if (from < 0 || to < 0 || from === to) return;
    const [m] = scene.images.splice(from, 1);
    scene.images.splice(to, 0, m);
    buildList();
    markDirty();
  });
}

function selectImage(id) {
  selImageId = id;
  selAnnId = null;
  buildList();
  $("stageEmpty").classList.add("hidden");
  refreshInspector();
  loadBase(curImage().file).then(() => { invalidateBg(); fitStage(); });
}

function loadBase(file) {
  if (baseImages.has(file)) return Promise.resolve(baseImages.get(file));
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { baseImages.set(file, img); resolve(img); };
    img.onerror = () => resolve(null);
    img.src = `/api/image?file=${encodeURIComponent(file)}`;
  });
}

// ---------- stage sizing ----------
function fitStage() {
  stage.width = scene.canvas.w;
  stage.height = scene.canvas.h;
  const wrap = $("stageWrap");
  const maxW = wrap.clientWidth - 36;
  const maxH = wrap.clientHeight - 36;
  const s = Math.min(maxW / scene.canvas.w, maxH / scene.canvas.h);
  stage.style.width = scene.canvas.w * s + "px";
  stage.style.height = scene.canvas.h * s + "px";
}

function invalidateBg() { bgKey = ""; }

function rebuildBgIfNeeded() {
  const im = curImage();
  if (!im) return;
  const baseImg = baseImages.get(im.file);
  const key = JSON.stringify([im.file, scene.canvas, scene.fit, scene.background, !!baseImg]);
  if (key === bgKey) return;
  bgCanvas.width = scene.canvas.w;
  bgCanvas.height = scene.canvas.h;
  drawBase(bgCtx, baseImg, scene);
  bgKey = key;
}

// ---------- render loop ----------
function loop() {
  requestAnimationFrame(loop);
  const im = curImage();
  if (!im) return;
  rebuildBgIfNeeded();
  const t = (performance.now() - startTime) / 1000;
  ctx.clearRect(0, 0, stage.width, stage.height);
  ctx.drawImage(bgCanvas, 0, 0);
  drawAnnotations(ctx, im.annotations, t, scene.loopPeriod ?? DEFAULTS.loopPeriod);
  drawSelection();
}

// ---------- annotation geometry ----------
function localBox(a) {
  if (a.type === "box") return { minx: -a.w / 2, miny: -a.h / 2, maxx: a.w / 2, maxy: a.h / 2 };
  const s = (a.scale ?? 1) * (HAND_BASE_HEIGHT / HAND_VIEWBOX.h);
  const ax = HAND_ANCHOR.x * HAND_VIEWBOX.w, ay = HAND_ANCHOR.y * HAND_VIEWBOX.h;
  return { minx: (14 - ax) * s, maxx: (108 - ax) * s, miny: (6 - ay) * s, maxy: (168 - ay) * s };
}
function toLocal(a, px, py) {
  const dx = px - a.x, dy = py - a.y, c = Math.cos(rad(a.rotation || 0)), s = Math.sin(rad(a.rotation || 0));
  return { lx: dx * c + dy * s, ly: -dx * s + dy * c };
}
function toWorld(a, lx, ly) {
  const c = Math.cos(rad(a.rotation || 0)), s = Math.sin(rad(a.rotation || 0));
  return { x: a.x + lx * c - ly * s, y: a.y + lx * s + ly * c };
}
function handlesOf(a) {
  const b = localBox(a);
  const cx = (b.minx + b.maxx) / 2;
  const k = canvasPerScreen();
  return {
    nw: toWorld(a, b.minx, b.miny), ne: toWorld(a, b.maxx, b.miny),
    se: toWorld(a, b.maxx, b.maxy), sw: toWorld(a, b.minx, b.maxy),
    rot: toWorld(a, cx, b.miny - 34 * k),
    box: b,
  };
}
function canvasPerScreen() {
  const r = stage.getBoundingClientRect();
  return r.width ? scene.canvas.w / r.width : 1;
}

// ---------- selection overlay ----------
function drawSelection() {
  const a = curAnn();
  if (!a) return;
  const h = handlesOf(a);
  const k = canvasPerScreen();
  ctx.save();
  ctx.strokeStyle = "#4c8dff";
  ctx.lineWidth = 1.5 * k;
  ctx.setLineDash([6 * k, 4 * k]);
  ctx.beginPath();
  ctx.moveTo(h.nw.x, h.nw.y); ctx.lineTo(h.ne.x, h.ne.y);
  ctx.lineTo(h.se.x, h.se.y); ctx.lineTo(h.sw.x, h.sw.y); ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  // rotate stem
  const top = toWorld(a, (h.box.minx + h.box.maxx) / 2, h.box.miny);
  ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(h.rot.x, h.rot.y); ctx.stroke();
  // dots
  const r = 7 * k;
  const dot = (p, fill) => { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5 * k; ctx.stroke(); };
  [h.nw, h.ne, h.se, h.sw].forEach((p) => dot(p, "#4c8dff"));
  dot(h.rot, "#22c55e");
  ctx.restore();
}

// ---------- pointer interaction ----------
let drag = null;
stage.addEventListener("pointerdown", (e) => {
  const p = toCanvas(e);
  const a = curAnn();
  if (a) {
    const h = handlesOf(a), k = canvasPerScreen(), hit = 12 * k;
    if (near(p, h.rot, hit)) return startDrag(e, { mode: "rotate", a, startAngle: Math.atan2(p.y - a.y, p.x - a.x), startRot: a.rotation || 0 });
    for (const c of ["nw", "ne", "se", "sw"]) {
      if (near(p, h[c], hit)) {
        const d0 = Math.hypot(p.x - a.x, p.y - a.y) || 1;
        return startDrag(e, { mode: "scale", a, d0, startScale: a.scale, startW: a.w, startH: a.h });
      }
    }
  }
  // body hit: topmost first
  const im = curImage();
  for (let i = im.annotations.length - 1; i >= 0; i--) {
    const an = im.annotations[i];
    const lb = localBox(an), L = toLocal(an, p.x, p.y);
    if (L.lx >= lb.minx && L.lx <= lb.maxx && L.ly >= lb.miny && L.ly <= lb.maxy) {
      selAnnId = an.id; refreshInspector();
      return startDrag(e, { mode: "move", a: an, gx: p.x - an.x, gy: p.y - an.y });
    }
  }
  selAnnId = null; refreshInspector();
});

function startDrag(e, d) { drag = d; stage.setPointerCapture(e.pointerId); }
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = toCanvas(e), a = drag.a;
  if (drag.mode === "move") { a.x = p.x - drag.gx; a.y = p.y - drag.gy; }
  else if (drag.mode === "rotate") {
    let r = drag.startRot + deg(Math.atan2(p.y - a.y, p.x - a.x) - drag.startAngle);
    r = ((r + 180) % 360 + 360) % 360 - 180;
    a.rotation = Math.round(r);
  } else if (drag.mode === "scale") {
    const f = clamp(Math.hypot(p.x - a.x, p.y - a.y) / drag.d0, 0.05, 12);
    if (a.type === "hand") a.scale = clamp(drag.startScale * f, 0.2, 4);
    else { a.w = clamp(Math.round(drag.startW * f), 20, scene.canvas.w * 2); a.h = clamp(Math.round(drag.startH * f), 20, scene.canvas.h * 2); }
  }
  refreshInspector(true);
});
const endDrag = () => { if (drag) { drag = null; markDirty(); } };
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

function toCanvas(e) {
  const r = stage.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (scene.canvas.w / r.width), y: (e.clientY - r.top) * (scene.canvas.h / r.height) };
}
function near(p, q, d) { return Math.hypot(p.x - q.x, p.y - q.y) <= d; }

// ---------- add / delete ----------
$("addHand").addEventListener("click", () => addAnn({
  id: uid(), type: "hand", x: scene.canvas.w / 2, y: scene.canvas.h / 2,
  rotation: 0, scale: 1, fill: DEFAULTS.hand.fill, outline: DEFAULTS.hand.outline, pokeDistance: DEFAULTS.hand.pokeDistance,
}));
$("addBox").addEventListener("click", () => addAnn({
  id: uid(), type: "box", x: scene.canvas.w / 2, y: scene.canvas.h / 2,
  w: 460, h: 260, rotation: 0, stroke: DEFAULTS.box.stroke, lineWidth: DEFAULTS.box.lineWidth, radius: DEFAULTS.box.radius, pulse: DEFAULTS.box.pulse,
}));
function addAnn(a) {
  const im = curImage(); if (!im) return;
  im.annotations.push(a);
  selAnnId = a.id;
  buildList(); refreshInspector(); markDirty();
}
$("deleteAnn").addEventListener("click", () => {
  const im = curImage(); if (!im) return;
  im.annotations = im.annotations.filter((x) => x.id !== selAnnId);
  selAnnId = null; buildList(); refreshInspector(); markDirty();
});

// ---------- inspector binding ----------
function refreshInspector(valuesOnly) {
  const a = curAnn();
  const box = $("annProps");
  if (!a) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  $("annKind").textContent = a.type === "hand" ? "小手" : "框框";
  box.querySelectorAll("[data-only]").forEach((el) => el.classList.toggle("hidden", el.dataset.only !== a.type));

  setVal("annColor", a.type === "hand" ? a.fill : a.stroke);
  setRange("annRot", "rotVal", a.rotation || 0, "°");
  if (a.type === "hand") {
    setRange("annScale", "scaleVal", a.scale, "x", 2);
    setRange("annPoke", "pokeVal", a.pokeDistance, "");
  } else {
    setRange("annW", "wVal", a.w, "");
    setRange("annH", "hVal", a.h, "");
    setRange("annLW", "lwVal", a.lineWidth, "");
    setRange("annRad", "radVal", a.radius, "");
    setRange("annPulse", "pulseVal", a.pulse, "", 3);
  }
  if (!valuesOnly) { /* list sub-count refresh */ if (a) buildSubCount(); }
}
function buildSubCount() {
  const im = curImage(); if (!im) return;
  document.querySelectorAll(`.img-item[data-id="${im.id}"] .sub`).forEach((el) => el.textContent = `${im.annotations.length} 个标注`);
}
function setVal(id, v) { $(id).value = v; }
function setRange(id, labelId, v, unit, dp = 0) { $(id).value = v; if (labelId) $(labelId).textContent = (dp ? Number(v).toFixed(dp) : Math.round(v)) + (unit || ""); }

function bindAnn(id, labelId, prop, unit, dp) {
  $(id).addEventListener("input", (e) => {
    const a = curAnn(); if (!a) return;
    const v = e.target.type === "color" ? e.target.value : parseFloat(e.target.value);
    a[prop] = v;
    if (labelId) $(labelId).textContent = (dp ? Number(v).toFixed(dp) : Math.round(v)) + (unit || "");
    markDirty();
  });
}
$("annColor").addEventListener("input", (e) => { const a = curAnn(); if (!a) return; if (a.type === "hand") a.fill = e.target.value; else a.stroke = e.target.value; markDirty(); });
bindAnn("annRot", "rotVal", "rotation", "°");
bindAnn("annScale", "scaleVal", "scale", "x", 2);
bindAnn("annPoke", "pokeVal", "pokeDistance", "");
bindAnn("annW", "wVal", "w", "");
bindAnn("annH", "hVal", "h", "");
bindAnn("annLW", "lwVal", "lineWidth", "");
bindAnn("annRad", "radVal", "radius", "");
bindAnn("annPulse", "pulseVal", "pulse", "", 3);

// ---------- global settings ----------
function syncGlobals() {
  setRange("gDur", "durVal", scene.duration, "");
  $("gFps").value = String(scene.fps);
  setRange("gLoop", "loopVal", scene.loopPeriod, "", 1);
  $("gFit").value = scene.fit;
  $("gBgMode").value = scene.background.mode;
  $("gBgColor").value = scene.background.color;
  setRange("gBlur", "blurVal", scene.background.blur, "");
  updateBgRows();
}
function updateBgRows() {
  document.querySelectorAll("[data-bg]").forEach((el) => el.classList.toggle("hidden", el.dataset.bg !== scene.background.mode));
}
$("gDur").addEventListener("input", (e) => { scene.duration = parseFloat(e.target.value); $("durVal").textContent = scene.duration; markDirty(); });
$("gFps").addEventListener("change", (e) => { scene.fps = parseInt(e.target.value, 10); markDirty(); });
$("gLoop").addEventListener("input", (e) => { scene.loopPeriod = parseFloat(e.target.value); $("loopVal").textContent = scene.loopPeriod.toFixed(1); markDirty(); });
$("gFit").addEventListener("change", (e) => { scene.fit = e.target.value; invalidateBg(); markDirty(); });
$("gBgMode").addEventListener("change", (e) => { scene.background.mode = e.target.value; updateBgRows(); invalidateBg(); markDirty(); });
$("gBgColor").addEventListener("input", (e) => { scene.background.color = e.target.value; invalidateBg(); markDirty(); });
$("gBlur").addEventListener("input", (e) => { scene.background.blur = parseInt(e.target.value, 10); $("blurVal").textContent = scene.background.blur; invalidateBg(); markDirty(); });

// ---------- autosave ----------
let saveTimer = null;
function markDirty() {
  $("saveStatus").textContent = "未保存…";
  $("saveStatus").classList.add("dirty");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}
async function save() {
  try {
    await fetch("/api/project", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scene) });
    $("saveStatus").textContent = "已保存";
    $("saveStatus").classList.remove("dirty");
  } catch {
    $("saveStatus").textContent = "保存失败";
  }
}

// ---------- export ----------
$("exportBtn").addEventListener("click", async () => {
  await save();
  const overlay = $("exportOverlay"), log = $("exportLog"), closeBtn = $("exportClose");
  overlay.classList.remove("hidden");
  closeBtn.classList.add("hidden");
  log.innerHTML = "";
  const line = (html, cls) => { const d = document.createElement("div"); if (cls) d.className = cls; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };

  const es = new EventSource("/api/export");
  let statusLine = line("准备中…");
  es.addEventListener("progress", (ev) => {
    const p = JSON.parse(ev.data);
    if (p.phase === "start") statusLine = line(`▶ ${p.file} (${p.index + 1}/${p.total})`);
    else if (p.phase === "frame") statusLine.textContent = `▶ ${p.file} (${p.index + 1}/${p.total}) — ${p.frame}/${p.frames} 帧`;
    else if (p.phase === "done") statusLine.outerHTML = `<div class="ok">✓ ${p.file}</div>`;
  });
  es.addEventListener("done", (ev) => {
    const d = JSON.parse(ev.data);
    line(`<br>全部完成 — ${d.results.length} 个 mp4`, "ok");
    line(`输出目录: ${d.outputDir}`);
    es.close(); closeBtn.classList.remove("hidden");
  });
  es.addEventListener("error", (ev) => {
    let msg = "连接中断";
    try { msg = JSON.parse(ev.data).message; } catch {}
    line("✗ " + msg, "err");
    es.close(); closeBtn.classList.remove("hidden");
  });
});
$("exportClose").addEventListener("click", () => $("exportOverlay").classList.add("hidden"));
