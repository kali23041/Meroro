// Live captions: offline speech-to-text with Vosk (WebAssembly, runs in a worker, so the studio stays smooth).
// The model (~40 MB) is downloaded once per language and cached by the browser engine; after that it works with no internet.
import { createModel } from 'vosk-browser'

const BASE = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-'
// [id, label, model, options]. `zip` models come from the Vosk site and are repacked by the main process (one time).
export const CAP_LANGS = [['en-in', 'English (India)', 'en-in-0.4'], ['hi', 'Hindi (हिन्दी)', 'hi-0.22', { zip: true }], ['hinglish', 'Hinglish (Hindi in English letters)', 'hi-0.22', { zip: true, roman: true }],
  ['en-us', 'English (US)', 'en-us-0.15'], ['gu', 'Gujarati', 'gu-0.42', { zip: true }], ['te', 'Telugu', 'te-0.42', { zip: true }], ['de', 'German', 'de-0.15'], ['pt', 'Portuguese', 'pt-0.3'], ['tr', 'Turkish', 'tr-0.3']]

// Devanagari → everyday Roman Hindi ("आज हम नया गेम खेलेंगे" → "aaj ham naya game khelenge")
const CONS = { क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n', ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n', प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm',
  य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh', ष: 'sh', स: 's', ह: 'h', ळ: 'l', क़: 'q', ख़: 'kh', ग़: 'g', ज़: 'z', ड़: 'r', ढ़: 'rh', फ़: 'f' }
const NUKTA = { क: 'q', ख: 'kh', ग: 'g', ज: 'z', ड: 'r', ढ: 'rh', फ: 'f' }
const VOW = { अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऑ: 'o', ऍ: 'e' }
const MATRA = { 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' }
const LOAN = { गेम: 'game', स्ट्रीम: 'stream', लाइव: 'live', सब्सक्राइब: 'subscribe', लाइक: 'like', शेयर: 'share', चैनल: 'channel', वीडियो: 'video', प्लीज: 'please', गाइज: 'guys', चैट: 'chat', फ्रेंड्स: 'friends',
  हेलो: 'hello', ओके: 'ok', सुपर: 'super', फोन: 'phone', मोबाइल: 'mobile', मैच: 'match', लेवल: 'level', टीम: 'team', स्क्वाड: 'squad', किल: 'kill', गन: 'gun', हेडशॉट: 'headshot', लॉबी: 'lobby', रैंक: 'rank', थैंक्स: 'thanks' }
export function roman(text) {
  return text.split(/\s+/).map(word => {
    if (LOAN[word]) return LOAN[word]
    const ch = [...word.normalize('NFC')]; let out = ''
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i], nx = ch[i + 1]
      if (CONS[c]) {
        let k = CONS[c], j = i + 1
        if (ch[j] === '़') { k = NUKTA[c] || k; j++ }
        out += k
        const m = ch[j]
        if (MATRA[m] != null) { out += MATRA[m]; j++ } else if (m === '्') j++
        else if (j < ch.length || ch.length === 1 || (ch.length === 2 && ch[1] === '़')) out += (ch[j] === 'ं' || ch[j] === 'ँ' || CONS[ch[j]] || VOW[ch[j]]) ? 'a' : ''
        i = j - 1
      } else if (VOW[c]) out += VOW[c]
      else if (MATRA[c] != null) out += MATRA[c]
      else if (c === 'ं' || c === 'ँ') out += /[पफबभम]/.test(nx || '') ? 'm' : 'n'
      else if (c === 'ः') out += 'h'
      else if (c !== '्' && c !== '़') out += c
    }
    return out
  }).join(' ')
}

export class Captions {
  constructor(eng) { this.eng = eng; this.state = 'off'; this.final = ''; this.partial = ''; this.t = 0; this.wt = 0; this.n = 0 }
  get text() { return (this.final + ' ' + this.partial).trim() }
  async start(lang) {
    if (this.lang === lang && this.state !== 'off' && this.state !== 'error') return
    this.stop(); this.lang = lang; this.state = 'loading'; this.onState?.()
    const run = this.run = {}
    try {
      const [, , name, opt = {}] = CAP_LANGS.find(l => l[0] === lang) || CAP_LANGS[0], fix = t => opt.roman ? roman(t) : t
      const url = opt.zip ? await window.api.invoke('captions:model', 'vosk-model-small-' + name) : BASE + name + '.tar.gz'
      const model = await createModel(url, -1)
      if (this.run !== run) return model.terminate()
      const ac = this.eng.ac, rec = new model.KaldiRecognizer(ac.sampleRate)
      const mark = () => { const n = this.text.split(' ').length; if (n !== this.n) { this.n = n; this.wt = performance.now() } }
      rec.on('result', m => { const t = fix(m.result.text || ''); if (t) { this.final = (this.final + ' ' + t).trim().split(' ').slice(-40).join(' '); this.t = performance.now() } this.partial = ''; mark() })
      rec.on('partialresult', m => { this.partial = fix(m.result.partial || ''); if (this.partial) this.t = performance.now(); mark() })
      const sp = ac.createScriptProcessor(4096, 1, 1), mute = ac.createGain(); mute.gain.value = 0
      sp.onaudioprocess = e => { if (!this.eng.s.micMute) try { rec.acceptWaveform(e.inputBuffer) } catch {} }
      this.eng.gate.connect(sp); sp.connect(mute); mute.connect(ac.destination)
      Object.assign(this, { model, rec, sp, mute, state: 'on' })
    } catch (e) { if (this.run === run) { this.state = 'error'; this.error = String(e?.message || e) } }
    this.onState?.()
  }
  stop() {
    this.run = null
    try { if (this.sp) this.eng.gate.disconnect(this.sp) } catch {} // with no argument, disconnect() would cut the mic off from everything
    this.sp?.disconnect(); this.mute?.disconnect(); this.rec?.remove(); this.model?.terminate()
    this.sp = this.mute = this.rec = this.model = null
    this.state = 'off'; this.final = this.partial = ''; this.onState?.()
  }
}
