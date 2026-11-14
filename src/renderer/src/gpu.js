// GPU effects for one layer: chroma key (green screen) and 3D LUT colour grading, done in a tiny WebGL pass.
const VS = 'attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }'
const FS = `precision mediump float; varying vec2 uv; uniform sampler2D t, lut; uniform vec3 key; uniform float sim, smo, keyOn, lutOn, n, amt;
vec2 cc(vec3 c) { return vec2(dot(c, vec3(-.169, -.331, .5)), dot(c, vec3(.5, -.419, -.081))); }
vec3 grade(vec3 c) { float b = c.b * (n - 1.), b0 = floor(b), b1 = min(b0 + 1., n - 1.); vec2 p = vec2((c.r * (n - 1.) + .5) / (n * n), (c.g * (n - 1.) + .5) / n);
  return mix(texture2D(lut, p + vec2(b0 / n, 0.)).rgb, texture2D(lut, p + vec2(b1 / n, 0.)).rgb, b - b0); }
void main() { vec4 c = texture2D(t, uv); float a = 1.;
  if (keyOn > .5) a = smoothstep(sim, sim + smo, distance(cc(c.rgb), cc(key)));
  vec3 o = c.rgb; if (lutOn > .5) o = mix(o, grade(clamp(o, 0., 1.)), amt);
  gl_FragColor = vec4(o * a, a); }`

const cache = {}, luts = {}
export function parseCube(text) {
  let n = 0; const v = []
  for (const line of text.split('\n')) { const s = line.trim(); if (s.startsWith('LUT_3D_SIZE')) n = +s.split(/\s+/)[1]; else if (/^[\d.\-]/.test(s)) v.push(s.split(/\s+/).map(Number)) }
  if (!n || v.length < n * n * n) throw new Error('Not a 3D .cube LUT')
  const px = new Uint8Array(n * n * n * 4)
  for (let i = 0; i < n * n * n; i++) { const r = i % n, g = Math.floor(i / n) % n, b = Math.floor(i / n / n), o = (g * n * n + b * n + r) * 4; px[o] = v[i][0] * 255; px[o + 1] = v[i][1] * 255; px[o + 2] = v[i][2] * 255; px[o + 3] = 255 }
  return { n, px }
}
export const setLut = (path, lut) => { luts[path] = lut }
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)

// → [canvas, w, h] with the effects applied, or the input if nothing to do
export function gpuFx(id, src, fx) {
  const lut = fx.lut && luts[fx.lut]
  if (!fx.keyOn && !lut) return src
  const [img, w, h] = src
  let c = cache[id]
  if (!c) {
    const cv = document.createElement('canvas'), gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true })
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o }
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const p = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0)
    const tex = u => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE); for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR); return t }
    c = cache[id] = { cv, gl, pr, t0: tex(0), t1: tex(1), u: n => gl.getUniformLocation(pr, n), lutPath: '' }
    gl.uniform1i(c.u('t'), 0); gl.uniform1i(c.u('lut'), 1)
  }
  const { cv, gl, u } = c
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h) }
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, c.t0)
  try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img) } catch { return src }
  if (lut && c.lutPath !== fx.lut) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, c.t1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lut.n * lut.n, lut.n, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut.px); c.lutPath = fx.lut }
  gl.uniform3fv(u('key'), hex(fx.keyColor || '#00ff00')); gl.uniform1f(u('sim'), fx.sim ?? 0.12); gl.uniform1f(u('smo'), fx.smooth ?? 0.08)
  gl.uniform1f(u('keyOn'), fx.keyOn ? 1 : 0); gl.uniform1f(u('lutOn'), lut ? 1 : 0); gl.uniform1f(u('n'), lut?.n || 2); gl.uniform1f(u('amt'), fx.lutAmt ?? 1)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  return [cv, w, h]
}
