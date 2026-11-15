// Frames: the top of the hierarchy (Frame → Scenes → Sources). A frame owns the output size/aspect and its own scenes;
// every frame can be streamed at the same time. The studio preview shows the selected frame.
import { uid } from './scene'
export const FRAME_PRESETS = [['desktop', 'Desktop / YouTube', '1920x1080'], ['qhd', 'Desktop 1440p', '2560x1440'], ['hd', 'HD 720p', '1280x720'], ['phone', 'Phone / Shorts', '1080x1920'],
  ['story', 'Instagram story / Reels', '1080x1920'], ['insta', 'Instagram post 4:5', '1080x1350'], ['square', 'Square 1:1', '1080x1080'], ['tiktok', 'TikTok', '1080x1920'], ['wide', 'Ultrawide 21:9', '2560x1080'], ['classic', 'Classic 4:3', '1440x1080']]
export const newFrame = (name, size, preset = '') => ({ id: uid(), name, size, preset, scenes: [], sceneId: '' })
export const frameOf = (s, id = s.frameId) => s.frames?.find(f => f.id === id)

export function migrateFrames(n) { // older settings: one frame holding every scene at the old canvas size
  if (n.frames?.length) return n
  const [w, h] = n.canvas.split('x').map(Number)
  return { ...n, frames: [{ id: 'main', name: h > w ? 'Vertical' : 'Main', size: n.canvas, preset: '', scenes: n.scenes.map(x => x.id), sceneId: n.sceneId }], frameId: 'main' }
}
// Keeps frames consistent with the rest of the settings; returns the same object when nothing needs to change.
export function frameSync(n) {
  if (!n.frames?.length) return n
  const all = new Set(n.scenes.map(x => x.id))
  let ch = false, frameId = n.frameId, canvas = n.canvas
  let frames = n.frames.map(f => { const sc = f.scenes.filter(id => all.has(id)); if (sc.length === f.scenes.length) return f; ch = true; return { ...f, scenes: sc, sceneId: sc.includes(f.sceneId) ? f.sceneId : sc[0] || '' } })
  if (!frames.some(f => f.id === frameId)) { frameId = frames[0].id; canvas = frames[0].size; ch = true }
  const owner = frames.find(f => f.scenes.includes(n.sceneId)) // a scene from another frame was chosen (hotkey, automation): follow it
  if (owner && owner.id !== frameId) { frameId = owner.id; canvas = owner.size; ch = true }
  const owned = new Set(frames.flatMap(f => f.scenes)), orphans = n.scenes.filter(x => !owned.has(x.id)).map(x => x.id) // new scenes join the current frame
  frames = frames.map(f => {
    if (f.id !== frameId) return f
    const sceneId = f.scenes.includes(n.sceneId) || orphans.includes(n.sceneId) ? n.sceneId : f.sceneId
    if (!orphans.length && f.sceneId === sceneId && f.size === canvas) return f
    ch = true; return { ...f, scenes: [...f.scenes, ...orphans], sceneId, size: canvas }
  })
  const out = ch ? { ...n, frames, frameId, canvas } : n
  return linkSync(out)
}

// Linked frames: a child frame gets a copy of every source added to its parent frame. Each copy keeps its own position,
// size and look (OWN keys); what the source *is* (camera, file, text, settings…) follows the parent. Deleting the parent's source removes the copies.
const MAIN = new Set(['phone', 'ios', 'webcam', 'screen'])
const OWN = new Set(['id', 'link', 'x', 'y', 'w', 'h', 'rot', 'crop', 'radius', 'border', 'borderColor', 'shadow', 'opacity', 'flip', 'fit', 'fade', 'face', 'visible', 'bgOnly'])
const content = l => Object.fromEntries(Object.entries(l).filter(([k]) => !OWN.has(k)))
function linkSync(n) {
  const kids = n.frames.filter(f => f.parent && n.frames.some(p => p.id === f.parent))
  if (!kids.length) return n
  let scenes = n.scenes, frames = n.frames, ch = false
  const sceneMap = () => new Map(scenes.map(x => [x.id, x]))
  for (const kid of kids) {
    const map = sceneMap(), parent = frames.find(f => f.id === kid.parent)
    const pl = new Map(parent.scenes.flatMap(id => map.get(id)?.layers || []).filter(l => !l.link).map(l => [l.id, l]))
    // a scene that is new in the parent brings its own sources with it: those are not copied (only sources added later are)
    const known = new Set(kid.pscenes || parent.scenes), fresh = parent.scenes.filter(id => !known.has(id))
    const skip = fresh.flatMap(id => map.get(id)?.layers.map(l => l.id) || [])
    if (fresh.length || !kid.pscenes) { frames = frames.map(f => f.id === kid.id ? { ...f, pscenes: [...parent.scenes], linked: [...(f.linked || []), ...skip] } : f); ch = true }
    const seen = new Set([...(kid.linked || []), ...skip]), add = [...pl.values()].filter(l => !seen.has(l.id))
    // update or drop existing copies in the child's scenes
    scenes = scenes.map(sc => {
      if (!kid.scenes.includes(sc.id)) return sc
      let touched = false
      const layers = sc.layers.flatMap(l => {
        if (!l.link) return [l]
        const src = pl.get(l.link)
        if (!src) { touched = true; return [] }
        const c = content(src)
        if (JSON.stringify(c) === JSON.stringify(content(l))) return [l]
        touched = true; return [{ ...l, ...c }]
      })
      return touched ? (ch = true, { ...sc, layers }) : sc
    })
    if (add.length) { // new sources in the parent → copies in the child's current scene, same place in proportion
      const target = kid.sceneId || kid.scenes[0]
      if (target) {
        const [pw, ph] = parent.size.split('x').map(Number), [cw, chh] = kid.size.split('x').map(Number), k = cw / pw
        const copies = add.filter(l => !kid.onlyMain || MAIN.has(l.type)).map(l => ({ ...l, id: Math.random().toString(36).slice(2, 9), link: l.id, ...(pw / ph !== cw / chh && l.type !== 'sound' ? { w: l.w * pw * k / cw, h: l.h * ph * k / chh } : {}) }))
        scenes = scenes.map(sc => sc.id === target ? { ...sc, layers: [...sc.layers, ...copies] } : sc)
      }
      frames = frames.map(f => f.id === kid.id ? { ...f, linked: [...(f.linked || []), ...add.map(l => l.id)] } : f)
      ch = true
    }
  }
  return ch ? { ...n, scenes, frames } : n
}
