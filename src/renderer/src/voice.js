import SignalsmithStretch from 'signalsmith-stretch'
// Voice changer: a real-time pitch shifter (AudioWorklet, two cross-faded grains) followed by formant/tone shaping,
// telephone band, ring-mod robot, distortion, chorus, echo and reverb. Runs on this computer, no account, no extra download.
export const PITCH_WORKLET = `class Pitch extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4 }] }
  constructor() { super(); this.N = 1 << 15; this.buf = new Float32Array(this.N); this.w = 0; this.ph = 0; this.S = 1600 }
  read(d) { const N = this.N, p = this.w - d - 1 + N * 2, i = Math.floor(p), f = p - i; return this.buf[i % N] * (1 - f) + this.buf[(i + 1) % N] * f }
  process(ins, outs, prm) {
    const inp = ins[0], out = outs[0]; if (!inp || !inp[0]) return true
    const x = inp[0], r = prm.ratio[0], S = this.S, step = (1 - r) / S
    for (let k = 0; k < x.length; k++) {
      this.buf[this.w] = inp.length > 1 ? (x[k] + inp[1][k]) * 0.5 : x[k]
      let y = x[k]
      if (r !== 1) {
        this.ph = ((this.ph + step) % 1 + 1) % 1
        const p2 = (this.ph + 0.5) % 1, w1 = Math.sin(Math.PI * this.ph) ** 2, w2 = Math.sin(Math.PI * p2) ** 2
        y = w1 * this.read(this.ph * S) + w2 * this.read(p2 * S)
      }
      for (const ch of out) ch[k] = y
      this.w = (this.w + 1) % this.N
    }
    return true
  }
}
registerProcessor('meroro-pitch', Pitch)`

export const V0 = { raw: false, pitch: 0, formant: 0, robot: 0, ringHz: 60, echo: 0, echoTime: 0.28, reverb: 0, room: 1.6, dist: 0, tel: 0, chorus: 0, low: 0, high: 0 }
const P = (cat, name, v) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), cat, name, v: { ...V0, ...v } })
export const VOICES = [
  P('Female', 'Soft female', { pitch: 5, formant: 0.55, high: 2 }), P('Female', 'Bright female', { pitch: 7, formant: 0.7, high: 3 }), P('Female', 'Deep female', { pitch: 3, formant: 0.4 }),
  P('Female', 'Young woman', { pitch: 6, formant: 0.6, high: 1 }), P('Female', 'Anime girl', { pitch: 9, formant: 0.9, high: 4 }), P('Female', 'Narrator (female)', { pitch: 4, formant: 0.5, reverb: 0.15, low: 2 }),
  P('Female', 'Old lady', { pitch: 4, formant: 0.3, chorus: 0.3, tel: 0.1 }), P('Female', 'Singer', { pitch: 5, formant: 0.5, reverb: 0.3, chorus: 0.15 }),
  P('Male', 'Deep male', { pitch: -4, formant: -0.4, low: 4 }), P('Male', 'Bass voice', { pitch: -7, formant: -0.6, low: 6 }), P('Male', 'Radio host', { pitch: -2, formant: -0.2, low: 3, high: 2, reverb: 0.1 }),
  P('Male', 'Young man', { pitch: -1, formant: -0.1 }), P('Male', 'Old man', { pitch: -3, formant: -0.3, chorus: 0.25 }), P('Male', 'Movie trailer', { pitch: -6, formant: -0.5, low: 6, reverb: 0.35, room: 2.4 }),
  P('Kids & fun', 'Child', { pitch: 8, formant: 0.8 }), P('Kids & fun', 'Chipmunk', { pitch: 12, formant: 1, raw: true }), P('Kids & fun', 'Helium', { pitch: 10, formant: 0.9, high: 3, raw: true }),
  P('Kids & fun', 'Cartoon', { pitch: 7, formant: 0.4, chorus: 0.3 }), P('Kids & fun', 'Elf', { pitch: 6, formant: 0.8, reverb: 0.25 }), P('Kids & fun', 'Baby', { pitch: 11, formant: 0.85, low: -4 }),
  P('Characters', 'Monster', { pitch: -9, formant: -0.9, dist: 0.3, reverb: 0.2 }), P('Characters', 'Demon', { pitch: -11, formant: -1, dist: 0.4, reverb: 0.4, echo: 0.2 }),
  P('Characters', 'Villain', { pitch: -5, formant: -0.5, reverb: 0.35, low: 4 }), P('Characters', 'Ghost', { pitch: 2, formant: 0.2, reverb: 0.7, chorus: 0.5, echo: 0.3 }),
  P('Characters', 'Zombie', { pitch: -6, formant: -0.6, dist: 0.5, chorus: 0.4 }), P('Characters', 'Orc', { pitch: -8, formant: -0.7, dist: 0.35 }), P('Characters', 'Giant', { pitch: -10, formant: -0.8, reverb: 0.3, low: 6 }),
  P('Characters', 'Hero', { pitch: -2, formant: -0.2, reverb: 0.2, low: 3 }),
  P('Robots & sci-fi', 'Robot', { robot: 0.9, ringHz: 60 }), P('Robots & sci-fi', 'Cyborg', { pitch: -3, formant: -0.2, robot: 0.5, ringHz: 90, dist: 0.15 }),
  P('Robots & sci-fi', 'Alien', { pitch: 5, formant: 0.6, robot: 0.6, ringHz: 220, chorus: 0.4 }), P('Robots & sci-fi', 'Android', { pitch: 2, formant: 0.1, robot: 0.4, ringHz: 30, tel: 0.2 }),
  P('Robots & sci-fi', 'Metal voice', { pitch: -1, robot: 0.8, ringHz: 35, dist: 0.2 }), P('Robots & sci-fi', 'AI assistant', { pitch: 1, formant: 0.2, chorus: 0.2, high: 2 }),
  P('Places & radio', 'Telephone', { tel: 1 }), P('Places & radio', 'Walkie-talkie', { tel: 0.9, dist: 0.4 }), P('Places & radio', 'Megaphone', { tel: 0.7, dist: 0.6 }),
  P('Places & radio', 'Stadium', { reverb: 0.6, echo: 0.35, room: 3 }), P('Places & radio', 'Cave', { pitch: -1, reverb: 0.7, echo: 0.5, room: 3.5 }), P('Places & radio', 'Bathroom', { reverb: 0.45, room: 0.9 }),
  P('Places & radio', 'Underwater', { pitch: -2, formant: -0.3, chorus: 0.8, low: 6, high: -10 }), P('Places & radio', 'Space', { echo: 0.6, reverb: 0.5, chorus: 0.3 })
]
export const VCATS = [...new Set(VOICES.map(v => v.cat))]

// Builds the effect chain between `input` and `output`. set(null) = straight through (no added delay).
export class VoiceChain {
  constructor(ac, input, output) { Object.assign(this, { ac, input, output }); input.connect(output); this.on = false }
  async build() {
    const ac = this.ac, n = () => ac.createGain(), f = (type, freq, q) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = freq; if (q) b.Q.value = q; return b }
    // natural pitch/formant shifting: Signalsmith Stretch (MIT) running as WebAssembly in an AudioWorklet
    const pitch = await SignalsmithStretch(ac, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] })
    pitch.configure({ blockMs: 70, splitComputation: true }); pitch.schedule({ active: true, semitones: 0, formantCompensation: true, formantBaseHz: 0 })
    const hp = f('highpass', 70), low = f('lowshelf', 220), mid = f('peaking', 1100, 0.9), high = f('highshelf', 2600), tHP = f('highpass', 10), tLP = f('lowpass', 20000)
    const inp = n(); inp.connect(hp).connect(pitch).connect(low).connect(mid).connect(high).connect(tHP).connect(tLP)
    // ring-mod robot
    const rDry = n(), rWet = n(), ring = n(), osc = ac.createOscillator(), rSum = n(); ring.gain.value = 0; osc.connect(ring.gain); osc.start()
    tLP.connect(rDry).connect(rSum); tLP.connect(ring).connect(rWet).connect(rSum)
    // distortion
    const ws = ac.createWaveShaper(), dDry = n(), dWet = n(), dSum = n(); rSum.connect(dDry).connect(dSum); rSum.connect(ws).connect(dWet).connect(dSum)
    // chorus
    const cd = ac.createDelay(0.1), lfo = ac.createOscillator(), depth = n(), cWet = n(), cSum = n(); cd.delayTime.value = 0.022; lfo.frequency.value = 1.4; lfo.connect(depth).connect(cd.delayTime); lfo.start()
    dSum.connect(cSum); dSum.connect(cd).connect(cWet).connect(cSum)
    // echo
    const ed = ac.createDelay(2), fb = n(), eWet = n(), eSum = n(); cSum.connect(eSum); cSum.connect(ed); ed.connect(fb).connect(ed); ed.connect(eWet).connect(eSum)
    // reverb
    const cv = ac.createConvolver(), vWet = n(), out = n(); eSum.connect(out); eSum.connect(cv).connect(vWet).connect(out)
    Object.assign(this, { inp, out, pitch, low, mid, high, tHP, tLP, osc, rDry, rWet, ws, dDry, dWet, depth, cWet, ed, fb, eWet, cv, vWet, room: 0 })
    out.connect(this.output)
  }
  impulse(sec) { // synthetic room: decaying stereo noise
    const ac = this.ac, len = Math.round(ac.sampleRate * sec), b = ac.createBuffer(2, len, ac.sampleRate)
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) }
    return b
  }
  async set(v) {
    const ac = this.ac, t = ac.currentTime, T = (p, x) => p.setTargetAtTime(x, t, 0.03)
    this.want = v
    if (!v) { if (this.on) { this.input.disconnect(); this.input.connect(this.output); this.on = false } return }
    if (!this.pitch) { this.building ??= this.build(); await this.building; if (this.want !== v) return }
    if (!this.on) { this.input.disconnect(); this.input.connect(this.inp); this.on = true }
    v = { ...V0, ...v }
    // pitch moves the notes; formants (the shape of the voice) are kept and then shifted on purpose, which is what makes it sound human
    this.pitch.schedule({ active: true, semitones: v.pitch, formantSemitones: v.raw ? 0 : v.formant * 5, formantCompensation: !v.raw, formantBaseHz: 0 })
    T(this.low.gain, v.low); T(this.mid.gain, 0); T(this.high.gain, v.high)
    T(this.tHP.frequency, 10 + v.tel * 390); T(this.tLP.frequency, 20000 - v.tel * 16600)
    this.osc.frequency.value = v.ringHz; T(this.rDry.gain, 1 - v.robot); T(this.rWet.gain, v.robot * 1.4)
    if (this.dist !== v.dist) { this.dist = v.dist; const k = v.dist * 120, c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)) } this.ws.curve = c }
    T(this.dDry.gain, 1 - v.dist); T(this.dWet.gain, v.dist * 0.6)
    T(this.depth.gain, v.chorus * 0.006); T(this.cWet.gain, v.chorus * 0.8)
    this.ed.delayTime.value = v.echoTime; T(this.fb.gain, v.echo * 0.55); T(this.eWet.gain, v.echo * 0.7)
    if (v.reverb && Math.abs(this.room - v.room) > 0.05) { this.room = v.room; this.cv.buffer = this.impulse(v.room) }
    T(this.vWet.gain, v.reverb * 0.9)
  }
  dispose() { this.want = null; try { this.input.disconnect() } catch {} try { this.out?.disconnect(); this.osc?.stop(); this.pitch?.stop(); this.pitch?.disconnect() } catch {} }
}
export const voiceOf = (s, key) => { const x = key === 'main' ? s.voice : s.mics?.find(m => m.id === key)?.voice; return !x ? null : typeof x === 'string' ? (VOICES.find(v => v.id === x) || s.customVoices?.find(v => v.id === x))?.v || null : x }
export const voiceName = (s, x) => !x ? 'Off' : typeof x === 'string' ? (VOICES.find(v => v.id === x) || s.customVoices?.find(v => v.id === x))?.name || 'Custom' : 'Custom'
