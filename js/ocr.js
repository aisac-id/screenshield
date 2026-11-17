// ScreenShield OCR engine — fully local tesseract.js (WASM, SIMD).
"use strict";

let worker = null;

export async function initOCR(onStatus) {
  onStatus?.("loading");
  worker = await Tesseract.createWorker("eng", 1, {
    workerPath: "vendor/worker.min.js",
    corePath: "vendor/tesseract-core-simd.wasm.js",
    langPath: "vendor",
    gzip: true,
    workerBlobURL: false,
    // logger: (m) => console.log(m),
  });
  await worker.setParameters({
    tessedit_pageseg_mode: "3", // auto segmentation — handles multi-column UIs
    preserve_interword_spaces: "1",
  });
  onStatus?.("ready");
  return worker;
}

// Returns { lines, ms } — lines carry word bboxes in source-canvas pixels.
export async function recognize(canvas) {
  if (!worker) return { lines: [], ms: 0 };
  const t0 = performance.now();
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  const lines = [];
  for (const b of data.blocks || [])
    for (const p of b.paragraphs || [])
      for (const l of p.lines || [])
        lines.push(l);
  return { lines, ms: performance.now() - t0 };
}

export async function terminateOCR() {
  if (worker) { await worker.terminate(); worker = null; }
}