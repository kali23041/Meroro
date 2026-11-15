// Sound effects made on the fly with WebAudio (no files, nothing to license): rendered once, then cached.
export const SFX = [['whoosh', 'Whoosh'], ['swoosh', 'Swoosh up'], ['pop', 'Pop'], ['ding', 'Ding'], ['coin', 'Coin'], ['levelup', 'Level up'], ['sparkle', 'Sparkle'], ['tada', 'Ta-da'],
  ['boom', 'Boom'], ['airhorn', 'Air horn'], ['laser', 'Laser'], ['bell', 'Bell'], ['notify', 'Notify'], ['glitch', 'Glitch'], ['heart', 'Love'], ['drum', 'Drum roll']]
export const SFX_FOR = { pop: 'pop', slide: 'whoosh', neon: 'sparkle', confetti: 'tada', coins: 'coin', hearts: 'heart', ribbon: 'swoosh', glitch: 'glitch', burst: 'levelup', ticket: 'ding' }
const LEN = { whoosh: 0.8, swoosh: 0.6, pop: 0.2, ding: 1.4, coin: 0.6, levelup: 0.7, sparkle: 1.2, tada: 1.4, boom: 1.6, airhorn: 1.1, laser: 0.4, bell: 2.2, notify: 0.5, glitch: 0.5, heart: 0.9, drum: 1.9 }

export async function renderSfx(name, sr = 48000) {
  const ac = new OfflineAudioContext(2, Math.round(sr * (LEN[name] || 1)), sr), out = ac.createGain(); out.gain.value = 0.8; out.connect(ac.destination)
  const tone = (f, t0, d, type = 'sine', vol = 0.4, f2) => {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d)
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t0 + d); o.connect(g).connect(out); o.start(t0); o.stop(t0 + d + 0.05)
  }
  const noise = (t0, d, type, f0, f1, vol = 0.5, q = 1) => {
    const b = ac.createBuffer(1, Math.round(sr * d), sr), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t0); fl.frequency.exponentialRampToValueAtTime(f1, t0 + d)
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + d * 0.35); g.gain.exponentialRampToValueAtTime(0.0008, t0 + d); s.connect(fl).connect(g).connect(out); s.start(t0)
  }
  const R = { // recipes
    whoosh: () => noise(0, 0.75, 'bandpass', 250, 3200, 0.9, 1.2),
    swoosh: () => { noise(0, 0.5, 'bandpass', 600, 6500, 0.7, 1.5); tone(300, 0, 0.45, 'sine', 0.15, 1400) },
    pop: () => { tone(600, 0, 0.12, 'sine', 0.7, 140); tone(900, 0, 0.08, 'triangle', 0.3, 180) },
    ding: () => { tone(1320, 0, 1.3, 'sine', 0.5); tone(2640, 0, 0.9, 'sine', 0.15) },
    coin: () => { tone(988, 0, 0.08, 'square', 0.18); tone(1319, 0.08, 0.45, 'square', 0.18) },
    levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, i === 3 ? 0.35 : 0.12, 'square', 0.16)),
    sparkle: () => { for (let i = 0; i < 9; i++) tone(2200 + Math.random() * 3000, i * 0.08, 0.35, 'sine', 0.18) },
    tada: () => { [392, 494, 587].forEach(f => tone(f, 0, 0.18, 'sawtooth', 0.12)); [523, 659, 784].forEach(f => tone(f, 0.2, 1.1, 'sawtooth', 0.12)) },
    boom: () => { tone(120, 0, 1.4, 'sine', 0.9, 35); noise(0, 1.2, 'lowpass', 900, 60, 0.7) },
    airhorn: () => [466, 470, 233].forEach(f => tone(f, 0, 1, 'sawtooth', 0.14)),
    laser: () => tone(1800, 0, 0.35, 'square', 0.2, 180),
    bell: () => [880, 1760, 2640, 3520].forEach((f, i) => tone(f, 0, 2 - i * 0.35, 'sine', 0.3 / (i + 1))),
    notify: () => { tone(880, 0, 0.12, 'sine', 0.4); tone(1175, 0.12, 0.3, 'sine', 0.4) },
    glitch: () => { for (let i = 0; i < 12; i++) tone(200 + Math.random() * 1800, i * 0.035, 0.04, 'square', 0.2) },
    heart: () => { tone(660, 0, 0.5, 'triangle', 0.35); tone(880, 0.15, 0.6, 'triangle', 0.3) },
    drum: () => { let t = 0, gap = 0.12; while (t < 1.45) { noise(t, 0.08, 'bandpass', 1800, 900, 0.6, 0.8); t += gap; gap = Math.max(0.035, gap * 0.9) } tone(110, 1.5, 0.35, 'sine', 0.8, 50); noise(1.5, 0.35, 'highpass', 4000, 9000, 0.5) }
  }
  ;(R[name] || R.pop)()
  const b = await ac.startRendering() // even loudness: every effect peaks at the same level
  let p = 0; for (let c = 0; c < b.numberOfChannels; c++) for (const x of b.getChannelData(c)) p = Math.max(p, Math.abs(x))
  if (p > 0) for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c), k = 0.7 / p; for (let i = 0; i < d.length; i++) d[i] *= k }
  return b
}
