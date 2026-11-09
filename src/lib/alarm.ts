"use client";

/**
 * Speaker warning played by the browser on the customer's computer:
 * a short two-tone siren (Web Audio) + a spoken sentence (speech synthesis, if the browser has a voice).
 * Browsers only allow sound after the person clicked on the page once — `unlockAudio()` is called from that click.
 */
let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    // a silent utterance unlocks speech on some browsers
    if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
    return ctx.state !== "closed";
  } catch {
    return false;
  }
}

export const audioReady = () => !!ctx && ctx.state === "running";

function siren(seconds = 2.4) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "square";
  const t0 = ctx.currentTime;
  for (let i = 0; i < seconds * 2; i++) o.frequency.setValueAtTime(i % 2 ? 660 : 880, t0 + i * 0.5);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.05);
  g.gain.setValueAtTime(0.35, t0 + seconds - 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + seconds);
}

const LANG: Record<string, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

/** Siren, then the phrase. Returns false if the browser blocked sound (no click on the page yet). */
export function playAlarm(phrases: Record<string, string>, locale: string): boolean {
  if (!ctx) unlockAudio();
  if (!ctx || ctx.state !== "running") return false;
  siren();
  try {
    if ("speechSynthesis" in window) {
      const voices = window.speechSynthesis.getVoices();
      const want = LANG[locale] ?? "ru-RU";
      // Uzbek voices are rare: fall back to Russian, then any voice
      const v = voices.find((x) => x.lang === want) ?? voices.find((x) => x.lang.startsWith(want.slice(0, 2))) ?? voices.find((x) => x.lang.startsWith("ru"));
      // speak in the voice's language (an Uzbek sentence read by a Russian voice is unclear)
      const vl = (v?.lang ?? want).slice(0, 2);
      const u = new SpeechSynthesisUtterance(phrases[vl] ?? phrases[locale] ?? Object.values(phrases)[0]);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      }
      u.volume = 1;
      u.rate = 0.95;
      setTimeout(() => window.speechSynthesis.speak(u), 2500);
    }
  } catch {}
  return true;
}
