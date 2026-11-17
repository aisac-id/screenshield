// ScreenShield UI sounds — soft marimba-like sines, no assets.
"use strict";

let ctx = null;
let enabled = true;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, dur, gain = 0.06, when = 0) {
  if (!enabled) return;
  try {
    const c = ac();
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* audio unavailable */ }
}

export const sfx = {
  ui:     () => tone(880, 0.06, 0.03),
  ok:     () => { tone(523, 0.1); tone(784, 0.14, 0.05, 0.08); },
  hit:    () => { tone(660, 0.09, 0.05); tone(494, 0.12, 0.05, 0.08); },
  alert:  () => { tone(392, 0.16, 0.06); tone(311, 0.22, 0.06, 0.14); },
  shield: () => { tone(659, 0.08, 0.05); tone(880, 0.1, 0.05, 0.06); tone(1047, 0.16, 0.05, 0.12); },
  error:  () => tone(233, 0.25, 0.05),
};

export function setSound(on) { enabled = on; }