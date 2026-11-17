// ScreenShield app — local OCR scan loop, redaction mirror, findings UI.
"use strict";

import { CATEGORIES, detectLines } from "./detectors.js";
import { initOCR, recognize } from "./ocr.js";
import { SourceManager } from "./sources.js";
import { sfx, setSound } from "./audio.js";

const $ = (id) => document.getElementById(id);
const TUNE_KEY = "ss-tuning-v1";
const KW_KEY = "ss-keywords-v1";
const DEFAULT_TUNE = { interval: 1500, pixel: 14, minConf: 55, labels: true, alerts: true, sound: true, shield: true };

let tune = { ...DEFAULT_TUNE };
let keywords = [];
let catEnabled = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, true]));
let paused = false;
let panic = false;
let clean = false;
let ocrReady = false;
let scans = 0;
let lastOcrMs = 0;
let findings = [];           // active tracks: {cat, masked, x0,y0,x1,y1, confidence, seen, key}
let events = [];
let status = "SCANNING";
let lastAlert = 0;
let scanTimer = null;
let scanning = false;
const bootTime = performance.now();

const src = new SourceManager(onStatus);

// full-resolution source canvas + downscaled OCR canvas + pixelation temp
const srcCanvas = document.createElement("canvas");
const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
const ocrCanvas = document.createElement("canvas");
const ocrCtx = ocrCanvas.getContext("2d");
const tmpCanvas = document.createElement("canvas");
const tmpCtx = tmpCanvas.getContext("2d");
const mirrorC = $("mirrorCanvas");
const mirrorX = mirrorC.getContext("2d");

/* ── persistence ── */
function saveState() {
  try {
    chrome.storage?.local.set({ [TUNE_KEY]: tune, [KW_KEY]: keywords });
  } catch {
    localStorage.setItem(TUNE_KEY, JSON.stringify(tune));
    localStorage.setItem(KW_KEY, JSON.stringify(keywords));
  }
}
async function restoreState() {
  try {
    const d = await chrome.storage?.local.get([TUNE_KEY, KW_KEY]);
    if (d?.[TUNE_KEY]) tune = { ...DEFAULT_TUNE, ...d[TUNE_KEY] };
    if (d?.[KW_KEY]) keywords = d[KW_KEY];
  } catch {
    try {
      tune = { ...DEFAULT_TUNE, ...JSON.parse(localStorage.getItem(TUNE_KEY) || "{}") };
      keywords = JSON.parse(localStorage.getItem(KW_KEY) || "[]");
    } catch {}
  }
}

function refreshTuneUI() {
  $("intRange").value = tune.interval;
  $("intVal").textContent = `${tune.interval} ms`;
  $("pixRange").value = tune.pixel;
  $("pixVal").textContent = tune.pixel;
  $("confRange").value = tune.minConf;
  $("confVal").textContent = tune.minConf;
  $("labelsTgl").checked = tune.labels;
  $("alertTgl").checked = tune.alerts;
  $("shieldTgl").checked = tune.shield;
  $("soundBtn").classList.toggle("off", !tune.sound);
  setSound(tune.sound);
}

/* ── toasts / log ── */
function toast(msg, cls = "", ms = 3200) {
  const el = document.createElement("div");
  el.className = `toast ${cls}`;
  el.textContent = msg;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function logEvent(cls, text) {
  events.push({ t: new Date().toISOString(), cls, text });
  if (events.length > 100) events.shift();
  const list = $("logList");
  const div = document.createElement("div");
  div.className = `log-item ${cls}`;
  const time = document.createElement("time");
  time.textContent = events[events.length - 1].t.slice(11, 19);
  div.append(time, document.createTextNode(text));
  list.prepend(div);
  while (list.children.length > 60) list.lastChild.remove();
  $("logEmpty").hidden = true;
}

/* ── categories UI ── */
function buildCats() {
  const list = $("catList");
  for (const key in CATEGORIES) {
    const row = document.createElement("div");
    row.className = "cat-row";
    const dot = document.createElement("span");
    dot.className = "cat-dot";
    dot.style.background = CATEGORIES[key].color;
    const name = document.createElement("span");
    name.className = "cat-name";
    name.textContent = CATEGORIES[key].label;
    const n = document.createElement("span");
    n.className = "cat-n";
    n.id = `catN-${key}`;
    n.textContent = "0";
    const tgl = document.createElement("label");
    tgl.className = "tgl";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.addEventListener("change", () => { catEnabled[key] = cb.checked; sfx.ui(); renderAll(); });
    const i = document.createElement("i");
    tgl.append(cb, i);
    row.append(dot, name, n, tgl);
    list.appendChild(row);
  }
}

/* ── keywords UI ── */
function renderKeywords() {
  const wrap = $("kwChips");
  wrap.innerHTML = "";
  keywords.forEach((k, idx) => {
    const chip = document.createElement("span");
    chip.className = "kw-chip";
    chip.append(document.createTextNode(k));
    const x = document.createElement("button");
    x.textContent = "×";
    x.title = "Remove";
    x.addEventListener("click", () => { keywords.splice(idx, 1); saveState(); renderKeywords(); sfx.ui(); });
    chip.appendChild(x);
    wrap.appendChild(chip);
  });
}

function addKeyword() {
  const v = $("kwInput").value.trim();
  if (!v) return;
  if (!keywords.includes(v)) {
    keywords.push(v);
    saveState();
    renderKeywords();
    logEvent("shield", `keyword added: “${v}”`);
    sfx.ok();
  }
  $("kwInput").value = "";
}

/* ── source status ── */
function onStatus(s) {
  const st = $("srcStatus");
  st.classList.remove("err");
  const gate = $("srcGate");
  if (s === "demo") {
    st.textContent = "demo dashboard · all values fictional";
    gate.hidden = true;
    $("srcChip").textContent = "DEMO DASHBOARD";
    resetScan();
  } else if (s === "screen") {
    st.textContent = "screen / tab capture live";
    gate.hidden = true;
    $("srcChip").textContent = "SCREEN / TAB";
    resetScan();
  } else if (s === "share-ended") {
    st.textContent = "share ended";
    $("gateMsg").textContent = "Share ended. Share again or switch back to the demo.";
    gate.hidden = false;
    logEvent("alert", "share ended");
  }
}

function resetScan() {
  findings = [];
  scans = 0;
  setStatus("SCANNING", "Looking for sensitive text…");
  renderAll();
}

async function switchSource(kind) {
  $("captureBtn").hidden = kind !== "screen";
  try {
    if (kind === "demo") await src.useDemo();
    else {
      src.stop();
      $("gateMsg").textContent = "Share the screen or tab you want to protect.";
      $("srcGate").hidden = false;
      $("srcStatus").textContent = "waiting for share…";
    }
  } catch (err) {
    $("srcStatus").textContent = `error: ${err.message || err.name}`;
    $("srcStatus").classList.add("err");
    toast(`Source failed: ${err.message || err.name}`, "err");
    sfx.error();
  }
}

/* ── OCR scan loop (timer-driven; draws frames itself → background-safe) ── */
function scheduleScan() {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(scanOnce, tune.interval);
}

async function scanOnce() {
  if (paused || !ocrReady || !src.ready() || scanning) { scheduleScan(); return; }
  scanning = true;
  try {
    // draw current frame at native size
    if (srcCanvas.width !== src.w || srcCanvas.height !== src.h) {
      srcCanvas.width = src.w;
      srcCanvas.height = src.h;
      mirrorC.width = src.w;
      mirrorC.height = src.h;
    }
    src.draw(srcCtx);

    // downscale for OCR speed only if larger than 1600 (smaller hurts accuracy)
    const scale = Math.min(1, 1600 / src.w);
    ocrCanvas.width = Math.round(src.w * scale);
    ocrCanvas.height = Math.round(src.h * scale);
    ocrCtx.drawImage(srcCanvas, 0, 0, ocrCanvas.width, ocrCanvas.height);

    const { lines, ms } = await recognize(ocrCanvas);
    lastOcrMs = ms;
    scans++;
    $("ocrMsPill").textContent = `${Math.round(ms)} ms`;
    $("scanPill").textContent = `SCANS ${scans}`;

    const raw = detectLines(lines, keywords)
      .filter((f) => f.confidence >= tune.minConf)
      .map((f) => ({
        ...f,
        x0: f.x0 / scale, y0: f.y0 / scale, x1: f.x1 / scale, y1: f.y1 / scale,
      }));
    mergeFindings(raw);
    updateStatus();
    renderAll();
  } catch (err) {
    console.error("scan failed", err);
  }
  scanning = false;
  scheduleScan();
}

// associate detections with existing tracks by IoU / category
function mergeFindings(raw) {
  const now = performance.now();
  const ttl = Math.max(3000, tune.interval * 2.2);
  const used = new Set();
  for (const f of raw) {
    let best = null, bestIoU = 0.25;
    for (const t of findings) {
      if (t.cat !== f.cat || used.has(t)) continue;
      const ix = Math.max(0, Math.min(t.x1, f.x1) - Math.max(t.x0, f.x0));
      const iy = Math.max(0, Math.min(t.y1, f.y1) - Math.max(t.y0, f.y0));
      const inter = ix * iy;
      const union = (t.x1 - t.x0) * (t.y1 - t.y0) + (f.x1 - f.x0) * (f.y1 - f.y0) - inter;
      const iou = union > 0 ? inter / union : 0;
      if (iou > bestIoU) { best = t; bestIoU = iou; }
    }
    if (best) {
      used.add(best);
      best.x0 = best.x0 * 0.5 + f.x0 * 0.5;
      best.y0 = best.y0 * 0.5 + f.y0 * 0.5;
      best.x1 = best.x1 * 0.5 + f.x1 * 0.5;
      best.y1 = best.y1 * 0.5 + f.y1 * 0.5;
      best.confidence = f.confidence;
      best.masked = f.masked;
      best.seen = now;
    } else {
      findings.push({ ...f, seen: now, key: `${f.cat}-${now}-${Math.random()}` });
      logEvent("hit", `${CATEGORIES[f.cat].label} detected: ${f.masked}`);
      if (tune.alerts && now - lastAlert > 4000) {
        lastAlert = now;
        sfx.hit();
        toast(`${CATEGORIES[f.cat].label} masked: ${f.masked}`, "warn", 2400);
      }
    }
  }
  findings = findings.filter((t) => now - t.seen < ttl);
}

function activeFindings() {
  return findings.filter((f) => catEnabled[f.cat]);
}

function updateStatus() {
  const act = activeFindings();
  if (!act.length) {
    setStatus("CLEAR", scans ? "No sensitive text in view. Keep the shield on anyway." : "Looking for sensitive text…");
  } else if (tune.shield || panic) {
    setStatus("SHIELDED", `${act.length} sensitive item${act.length > 1 ? "s" : ""} pixelated in the mirror.`);
  } else {
    setStatus("EXPOSED", `${act.length} sensitive item${act.length > 1 ? "s" : ""} VISIBLE — turn the shield on!`);
    if (tune.alerts && performance.now() - lastAlert > 4000) {
      lastAlert = performance.now();
      sfx.alert();
    }
  }
}

function setStatus(s, sub) {
  if (s !== status) {
    if (s === "SHIELDED") sfx.shield();
    logEvent(s === "EXPOSED" ? "alert" : "shield", `status → ${s}`);
  }
  status = s;
  $("statusBanner").dataset.s = s;
  $("statusWord").textContent = s;
  $("statusSub").textContent = sub;
  $("statusIcon").textContent = s === "CLEAR" ? "✓" : s === "SHIELDED" ? "▣" : s === "EXPOSED" ? "⚠" : "◌";
}

/* ── rendering ── */
function renderAll() {
  const act = activeFindings();
  // counts per category
  const counts = {};
  for (const f of findings) counts[f.cat] = (counts[f.cat] || 0) + 1;
  for (const key in CATEGORIES) $(`catN-${key}`).textContent = counts[key] || 0;
  // status count chips
  const sc = $("statusCounts");
  sc.innerHTML = "";
  for (const key in counts) {
    if (!catEnabled[key]) continue;
    const chip = document.createElement("span");
    chip.className = "cat-count";
    chip.style.borderColor = CATEGORIES[key].color;
    chip.style.color = CATEGORIES[key].color;
    chip.textContent = `${CATEGORIES[key].label} ${counts[key]}`;
    sc.appendChild(chip);
  }
  // findings list
  const list = $("findList");
  list.innerHTML = "";
  for (const f of act) {
    const item = document.createElement("div");
    item.className = "find-item";
    item.style.borderLeftColor = CATEGORIES[f.cat].color;
    const cat = document.createElement("span");
    cat.className = "f-cat";
    cat.style.color = CATEGORIES[f.cat].color;
    cat.style.background = `${CATEGORIES[f.cat].color}18`;
    cat.textContent = f.cat;
    const val = document.createElement("span");
    val.className = "f-val";
    val.textContent = f.masked;
    const conf = document.createElement("span");
    conf.className = "f-conf";
    conf.textContent = `${Math.round(f.confidence)}%`;
    item.append(cat, val, conf);
    list.appendChild(item);
  }
  $("findCount").textContent = act.length;
  $("findEmpty").hidden = act.length > 0;
  $("cleanCount").textContent = act.length;
}

function pixelate(x, y, w, h) {
  const size = tune.pixel;
  const tw = Math.max(1, Math.floor(w / size));
  const th = Math.max(1, Math.floor(h / size));
  tmpCanvas.width = tw;
  tmpCanvas.height = th;
  tmpCtx.drawImage(mirrorC, x, y, w, h, 0, 0, tw, th);
  mirrorX.imageSmoothingEnabled = false;
  mirrorX.drawImage(tmpCanvas, 0, 0, tw, th, x, y, w, h);
  mirrorX.imageSmoothingEnabled = true;
}

function draw() {
  requestAnimationFrame(draw);
  const el = Math.floor((performance.now() - bootTime) / 1000);
  $("clockChip").textContent = `${String(Math.floor(el / 60)).padStart(2, "0")}:${String(el % 60).padStart(2, "0")}`;
  if (!src.ready() || !srcCanvas.width) return;

  // mirror = fresh source frame (drawn here too, so the mirror is always live)
  src.draw(srcCtx);
  mirrorX.drawImage(srcCanvas, 0, 0);

  if (panic) {
    pixelate(0, 0, mirrorC.width, mirrorC.height);
    return;
  }
  if (!tune.shield) return;

  const pad = 6;
  for (const f of activeFindings()) {
    const x = Math.max(0, f.x0 - pad), y = Math.max(0, f.y0 - pad);
    const w = Math.min(mirrorC.width - x, f.x1 - f.x0 + pad * 2);
    const h = Math.min(mirrorC.height - y, f.y1 - f.y0 + pad * 2);
    if (w <= 0 || h <= 0) continue;
    pixelate(x, y, w, h);
    const color = CATEGORIES[f.cat].color;
    mirrorX.strokeStyle = color;
    mirrorX.lineWidth = 2;
    mirrorX.strokeRect(x, y, w, h);
    if (tune.labels && !clean) {
      mirrorX.font = "600 13px Sora, sans-serif";
      const label = f.cat;
      const tw = mirrorX.measureText(label).width + 12;
      const ly = y > 22 ? y - 20 : y + h + 2;
      mirrorX.fillStyle = "rgba(6,13,10,0.85)";
      mirrorX.fillRect(x, ly, tw, 18);
      mirrorX.fillStyle = color;
      mirrorX.fillText(label, x + 6, ly + 13);
    }
  }
}

/* ── modes ── */
function setPaused(p) {
  paused = p;
  $("pauseVeil").hidden = !p;
  $("pauseBtn").textContent = p ? "▶" : "⏸";
  $("pauseBtn").classList.toggle("active", p);
  sfx.ui();
}

function setPanic(p) {
  panic = p;
  $("panicBtn").classList.toggle("on", p);
  $("panicBtn").textContent = p ? "UNBLUR" : "BLUR ALL";
  logEvent("shield", p ? "panic blur ON — whole frame pixelated" : "panic blur off");
  updateStatus();
  sfx.ui();
}

function setClean(c) {
  clean = c;
  document.body.classList.toggle("clean", c);
  $("cleanChip").hidden = !c;
  if (c) { toast("Share-safe mirror — share THIS tab in your meeting. Esc to exit.", "ok", 4200); sfx.shield(); }
}

/* ── report ── */
function exportReport() {
  const report = {
    tool: "ScreenShield 1.0.0",
    generated: new Date().toISOString(),
    source: src.kind,
    status,
    scans,
    ocrMs: Math.round(lastOcrMs),
    findings: activeFindings().map((f) => ({
      cat: f.cat, masked: f.masked, confidence: Math.round(f.confidence),
      box: { x: Math.round(f.x0), y: Math.round(f.y0), w: Math.round(f.x1 - f.x0), h: Math.round(f.y1 - f.y0) },
    })),
    categoriesEnabled: catEnabled,
    keywords,
    tuning: tune,
    events,
    privacy: "Masked previews only. Raw OCR text is never stored or exported.",
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `screenshield-report-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Report downloaded (masked values only)", "ok");
  sfx.ok();
}

/* ── wiring ── */
function wire() {
  $("sourceSel").addEventListener("change", (e) => { sfx.ui(); switchSource(e.target.value); });
  $("captureBtn").addEventListener("click", async () => {
    try { await src.useScreen(); } catch { $("srcStatus").textContent = "share cancelled"; toast("Share cancelled", "warn"); }
  });
  $("gateBtn").addEventListener("click", () => $("captureBtn").click());
  $("shieldTgl").addEventListener("change", (e) => {
    tune.shield = e.target.checked;
    saveState();
    logEvent("shield", `shield ${tune.shield ? "ON" : "OFF"}`);
    updateStatus();
    sfx.ui();
  });
  $("panicBtn").addEventListener("click", () => setPanic(!panic));
  $("cleanBtn").addEventListener("click", () => setClean(true));
  $("soundBtn").addEventListener("click", () => { tune.sound = !tune.sound; refreshTuneUI(); saveState(); });
  $("pauseBtn").addEventListener("click", () => setPaused(!paused));
  $("helpBtn").addEventListener("click", () => { $("helpModal").hidden = false; sfx.ui(); });
  $("helpClose").addEventListener("click", () => { $("helpModal").hidden = true; });
  $("helpModal").addEventListener("click", (e) => { if (e.target === $("helpModal")) $("helpModal").hidden = true; });
  $("reportBtn").addEventListener("click", exportReport);
  $("clearLogBtn").addEventListener("click", () => { events = []; $("logList").innerHTML = ""; $("logEmpty").hidden = false; sfx.ui(); });
  $("kwAddBtn").addEventListener("click", addKeyword);
  $("kwInput").addEventListener("keydown", (e) => { if (e.key === "Enter") addKeyword(); });

  $("intRange").addEventListener("input", (e) => {
    tune.interval = +e.target.value;
    $("intVal").textContent = `${tune.interval} ms`;
    saveState(); scheduleScan();
  });
  $("pixRange").addEventListener("input", (e) => { tune.pixel = +e.target.value; $("pixVal").textContent = tune.pixel; saveState(); });
  $("confRange").addEventListener("input", (e) => { tune.minConf = +e.target.value; $("confVal").textContent = tune.minConf; saveState(); });
  $("labelsTgl").addEventListener("change", (e) => { tune.labels = e.target.checked; saveState(); });
  $("alertTgl").addEventListener("change", (e) => { tune.alerts = e.target.checked; saveState(); });
  $("resetTuneBtn").addEventListener("click", () => {
    tune = { ...DEFAULT_TUNE };
    refreshTuneUI(); saveState(); scheduleScan();
    toast("Tuning reset", "ok");
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.code === "Space") { e.preventDefault(); setPaused(!paused); }
    else if (e.key === "f" || e.key === "F") setClean(!clean);
    else if (e.key === "b" || e.key === "B") setPanic(!panic);
    else if (e.key === "s" || e.key === "S") $("soundBtn").click();
    else if (e.key === "?") $("helpModal").hidden = !$("helpModal").hidden;
    else if (e.key === "Escape") { if (clean) setClean(false); $("helpModal").hidden = true; }
  });
}

/* ── boot ── */
(async function boot() {
  await restoreState();
  refreshTuneUI();
  buildCats();
  renderKeywords();
  wire();
  requestAnimationFrame(draw);
  await switchSource("demo");
  try {
    await initOCR((s) => {
      $("enginePill").textContent = s === "ready" ? "OCR · LOCAL WASM" : "OCR · LOADING";
      $("enginePill").classList.toggle("ok", s === "ready");
    });
    ocrReady = true;
    logEvent("shield", "local OCR engine ready");
    scheduleScan();
  } catch (err) {
    $("enginePill").textContent = "OCR · FAILED";
    toast(`OCR failed to load: ${err.message || err}`, "err", 8000);
    sfx.error();
  }
})();

// debug/test hook
window.__ss = {
  get findings() { return findings; },
  get active() { return activeFindings(); },
  get status() { return status; },
  get scans() { return scans; },
  get ocrReady() { return ocrReady; },
  get tune() { return tune; },
  get keywords() { return keywords; },
  src,
};