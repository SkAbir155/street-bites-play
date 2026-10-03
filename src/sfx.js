// Sound effects made from scratch with the browser's audio engine: no sound
// files to download, so they work offline. Use game.sfx.play('coin').
// Browsers only allow sound after the first touch or key press.

const SOUNDS = {
  // a customer pays: two bright rising notes
  coin(s, t) { s.tone(988, t, 0.09, 'square', 0.1); s.tone(1319, t + 0.08, 0.28, 'square', 0.1); },
  // the waiter gets a tip: a little sparkle
  tip(s, t) { [1568, 2093, 2637].forEach((f, i) => s.tone(f, t + i * 0.05, 0.16, 'sine', 0.1)); },
  // orders sent to the kitchen: a service bell
  bell(s, t) { s.tone(1760, t, 0.7, 'sine', 0.22); s.tone(2640, t, 0.45, 'sine', 0.1); },
  // a dish is ready on the window: one soft ding
  ready(s, t) { s.tone(1397, t, 0.4, 'sine', 0.16); s.tone(2093, t + 0.02, 0.25, 'sine', 0.07); },
  // picking something up: a quick rising pop
  pickup(s, t) { s.tone(420, t, 0.09, 'sine', 0.2, 760); },
  // putting something down: a quick falling pop
  putdown(s, t) { s.tone(520, t, 0.09, 'sine', 0.18, 300); },
  // serving a customer: a happy three-note chime
  serve(s, t) { [784, 988, 1175].forEach((f, i) => s.tone(f, t + i * 0.07, 0.22, 'triangle', 0.16)); },
  // taking an order: two pencil ticks
  note(s, t) { s.noise(t, 0.04, 0.2, 3500); s.noise(t + 0.09, 0.05, 0.2, 3000); },
  // a customer walks in: a door chime
  door(s, t) { s.tone(1047, t, 0.22, 'sine', 0.12); s.tone(784, t + 0.18, 0.4, 'sine', 0.12); },
  // a customer leaves angry: a low falling buzz
  angry(s, t) { s.tone(220, t, 0.22, 'sawtooth', 0.12, 150); s.tone(165, t + 0.2, 0.35, 'sawtooth', 0.12, 95); },
  // food in the trash: a dull thud
  trash(s, t) { s.noise(t, 0.16, 0.35, 320); s.tone(110, t, 0.16, 'sine', 0.2, 60); },
  // clearing dirty plates: a few clinks
  clink(s, t) { [2600, 3100, 2300].forEach((f, i) => s.tone(f, t + i * 0.06, 0.09, 'triangle', 0.1)); },
  // dropping plates in the dish bin: a clatter
  clatter(s, t) {
    [2200, 2900, 1800, 2500].forEach((f, i) => s.tone(f, t + i * 0.05, 0.08, 'triangle', 0.09));
    s.noise(t, 0.22, 0.2, 1800);
  },
  // the chef starts cooking: a short sizzle
  sizzle(s, t) { s.noise(t, 0.7, 0.07, 5200); },
};

class Sfx {
  constructor(game) {
    this.game = game;
    this.on = true;
    try { this.on = localStorage.getItem('sound') !== 'off'; } catch (e) { /* storage blocked: keep sound on */ }
  }

  get ctx() {
    return this.game.sound && this.game.sound.context;
  }

  setOn(on) {
    this.on = on;
    try { localStorage.setItem('sound', on ? 'on' : 'off'); } catch (e) { /* not saved, still works */ }
  }

  play(name) {
    const ctx = this.ctx;
    if (!this.on || !ctx || ctx.state !== 'running') return;
    SOUNDS[name](this, ctx.currentTime);
  }

  // One note. `slideTo` bends the pitch to another frequency over the note.
  tone(freq, start, length, type, volume, slideTo) {
    const ctx = this.ctx, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + length);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  // A burst of hiss, filtered around `pitch` Hz (high = sizzle, low = thud).
  noise(start, length, volume, pitch) {
    const ctx = this.ctx;
    const frames = Math.ceil(ctx.sampleRate * length);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = pitch;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(start);
  }
}
