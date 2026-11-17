// ScreenShield detectors — find sensitive strings in OCR lines and map the
// matches back to word bounding boxes. Raw values never leave this module;
// findings carry masked previews only.
"use strict";

export const CATEGORIES = {
  EMAIL:    { label: "Email",       color: "#38bdf8" },
  PHONE:    { label: "Phone",       color: "#a78bfa" },
  CARD:     { label: "Card",        color: "#f59e0b" },
  SECRET:   { label: "API secret",  color: "#ff4d5e" },
  PASSWORD: { label: "Password",    color: "#fb7185" },
  KEYWORD:  { label: "Keyword",     color: "#fbbf24" },
};

function luhn(digits) {
  let s = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = +digits[digits.length - 1 - i];
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    s += d;
  }
  return s % 10 === 0;
}

const SECRET_RES = [
  /ghp_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  // OCR frequently reads "l" as "1" — accept both in sk-live keys
  /sk-(?:[l1]ive|test)-[A-Za-z0-9]{16,}/g,
  /sk-[A-Za-z0-9]{24,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
];

function maskValue(cat, raw) {
  switch (cat) {
    case "EMAIL": {
      const [user, dom] = raw.split("@");
      return `${user[0]}•••@${dom}`;
    }
    case "CARD": {
      const d = raw.replace(/\D/g, "");
      return `•••• •••• •••• ${d.slice(-4)}`;
    }
    case "PHONE": {
      const d = raw.replace(/\D/g, "");
      return `••••••${d.slice(-2)}`;
    }
    case "SECRET": {
      const m = raw.match(/^(ghp_|github_pat_|sk-[l1]ive-|sk-test-|sk-|AKIA|xox[baprs]-|AIza)/);
      return `${m ? m[1].replace("1ive", "live") : ""}••••••••`;
    }
    default:
      return "•".repeat(Math.min(10, raw.length));
  }
}

// Map a character range in the joined line text back to word bboxes.
function rangeBox(words, offsets, start, end) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, conf = 0, n = 0;
  for (let i = 0; i < words.length; i++) {
    const a = offsets[i], b = a + words[i].text.length;
    if (b <= start || a >= end) continue;
    const bb = words[i].bbox;
    x0 = Math.min(x0, bb.x0); y0 = Math.min(y0, bb.y0);
    x1 = Math.max(x1, bb.x1); y1 = Math.max(y1, bb.y1);
    conf += words[i].confidence; n++;
  }
  if (!n) return null;
  return { x0, y0, x1, y1, confidence: conf / n };
}

function joinLine(words) {
  let text = "", offsets = [];
  for (let i = 0; i < words.length; i++) {
    if (i) {
      // wide horizontal gap = different UI column → separate with 3 spaces so
      // patterns never bridge across columns
      const gap = words[i].bbox.x0 - words[i - 1].bbox.x1;
      const lh = words[i - 1].bbox.y1 - words[i - 1].bbox.y0;
      text += gap > 3 * Math.max(8, lh) ? "   " : " ";
    }
    offsets.push(text.length);
    text += words[i].text;
  }
  return { text, offsets };
}

// lines: [{ words: [{text, confidence, bbox}] }]
export function detectLines(lines, keywords = []) {
  const findings = [];
  const kw = keywords.map((k) => k.trim()).filter(Boolean);
  const usedWords = new Set();      // words already covered by a finding
  const allWords = [];              // {w, lineBox} for the password pass
  const passwordLabels = [];        // {w, lineBox}

  for (const line of lines) {
    const words = (line.words || []).filter((w) => w.text && w.text.trim());
    if (!words.length) continue;
    const { text, offsets } = joinLine(words);
    const lineBox = words.reduce((b, w) => ({
      x0: Math.min(b.x0, w.bbox.x0), y0: Math.min(b.y0, w.bbox.y0),
      x1: Math.max(b.x1, w.bbox.x1), y1: Math.max(b.y1, w.bbox.y1),
    }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    for (const w of words) {
      allWords.push({ w, lineBox });
      if (/^(password|passcode|passwd)[:.]?$/i.test(w.text.trim())) passwordLabels.push({ w, lineBox });
    }
    const claimed = new Array(text.length).fill(false);
    const claim = (s, e) => { for (let i = s; i < e; i++) claimed[i] = true; };
    const free = (s, e) => { for (let i = s; i < e; i++) if (claimed[i]) return false; return true; };

    const add = (cat, s, e, raw) => {
      const box = rangeBox(words, offsets, s, e);
      if (!box) return;
      // random-looking secret tokens get near-zero per-char OCR confidence;
      // the prefix pattern is the strong signal, so trust the line confidence
      const confidence = cat === "SECRET" ? Math.max(box.confidence, line.confidence || 0) : box.confidence;
      findings.push({ cat, masked: maskValue(cat, raw), ...box, confidence });
      claim(s, e);
      for (let i = 0; i < words.length; i++) {
        const a = offsets[i], b = a + words[i].text.length;
        if (b > s && a < e) usedWords.add(words[i]);
      }
    };

    // CARD first (so phone doesn't eat it). Explicit card groupings only —
    // a loose digit-run pattern would bridge phone+card into one invalid match.
    const CARD_RES = [
      /\b(?:\d{4} ){3}\d{4}\b/g,        // 4539 1488 0343 6467
      /\b(?:\d{4}-){3}\d{4}\b/g,        // 4539-1488-0343-6467
      /\b\d{4} \d{6} \d{5}\b/g,         // Amex 4-6-5
      /\b\d{13,19}\b/g,                 // unseparated
    ];
    for (const re of CARD_RES) {
      for (const m of text.matchAll(re)) {
        const digits = m[0].replace(/\D/g, "");
        if (digits.length >= 13 && digits.length <= 19 && luhn(digits) && free(m.index, m.index + m[0].length))
          add("CARD", m.index, m.index + m[0].length, m[0]);
      }
    }
    for (const re of SECRET_RES) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        if (free(m.index, m.index + m[0].length)) add("SECRET", m.index, m.index + m[0].length, m[0]);
      }
    }
    // generic high-entropy token: 32+ chars mixing upper, lower and digits
    for (const m of text.matchAll(/\b[A-Za-z0-9_-]{32,}\b/g)) {
      const t = m[0];
      if (/[a-z]/.test(t) && /[A-Z]/.test(t) && /\d/.test(t) && free(m.index, m.index + t.length))
        add("SECRET", m.index, m.index + t.length, t);
    }
    for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
      if (free(m.index, m.index + m[0].length)) add("EMAIL", m.index, m.index + m[0].length, m[0]);
    }
    // phone: digits/punct, single spaces allowed but never the 3-space column gap
    for (const m of text.matchAll(/\+?\d(?:[\d().-]| (?! )){6,}\d/g)) {
      const digits = m[0].replace(/\D/g, "");
      if (digits.length >= 8 && digits.length <= 15 && free(m.index, m.index + m[0].length))
        add("PHONE", m.index, m.index + m[0].length, m[0]);
    }
    // password label handled geometrically after the loop
    for (const k of kw) {
      const lower = text.toLowerCase(), kl = k.toLowerCase();
      let idx = 0;
      while ((idx = lower.indexOf(kl, idx)) !== -1) {
        if (free(idx, idx + k.length)) add("KEYWORD", idx, idx + k.length, text.slice(idx, idx + k.length));
        idx += k.length;
      }
    }
  }

  // PASSWORD pass: find a value token beside or below a "password" label.
  // Works regardless of how the OCR groups columns into lines.
  for (const { w: label, lineBox } of passwordLabels) {
    const lb = label.bbox, lh = lb.y1 - lb.y0;
    let best = null, bestDist = Infinity;
    for (const { w } of allWords) {
      if (usedWords.has(w) || w === label) continue;
      const t = w.text.trim();
      if (t.length < 6 || t.length > 40) continue;
      if (!/[A-Za-z]/.test(t) || !/[\d!@#$%^&*?._-]/.test(t)) continue; // letters + digit/symbol
      if (/@|\.(com|io|co|net|org)\b/i.test(t)) continue;              // emails/urls
      const b = w.bbox;
      const sameRow = Math.min(b.y1, lb.y1) - Math.max(b.y0, lb.y0) > 0.5 * Math.min(b.y1 - b.y0, lh);
      const right = sameRow && b.x0 >= lb.x1 - 4 && b.x0 - lb.x1 < 14 * lh;
      const below = b.y0 >= lb.y1 - 4 && b.y0 - lb.y1 < 2.5 * lh &&
        b.x1 > lineBox.x0 - 10 && b.x0 < lb.x1 + 2 * lh;
      if (!right && !below) continue;
      const dist = Math.hypot(b.x0 - lb.x1, b.y0 - lb.y1);
      if (dist < bestDist) { best = w; bestDist = dist; }
    }
    if (best) {
      usedWords.add(best);
      const b = best.bbox;
      findings.push({
        cat: "PASSWORD", masked: maskValue("PASSWORD", best.text),
        x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, confidence: best.confidence,
      });
    }
  }
  return findings;
}