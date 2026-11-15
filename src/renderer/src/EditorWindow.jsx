// The recording editor's own window: frameless, edge to edge; notes show as a pill at the top.
import { useEffect, useState } from 'react'
import { Info, FolderOpen, X } from 'lucide-react'
import Editor from './Editor'
import { cx } from './ui'

const api = window.api
export default function EditorWindow() {
  const [start, setStart] = useState(null), [note, setNote] = useState(null)
  useEffect(() => {
    document.title = 'Meroro Editor'
    api.invoke('editor:start').then(s => s && setStart(s))
    const a = api.on('editor:start', setStart)
    const b = api.on('out:end', (id, r) => id === 'export' && dispatchEvent(new CustomEvent('export-end', { detail: r })))
    return () => { a(); b() }
  }, [])
  useEffect(() => { if (!note || note.bad) return; const t = setTimeout(() => setNote(null), 5000); return () => clearTimeout(t) }, [note])
  return <div className="h-screen flex bg-black text-zinc-200">
    <Editor start={start} onNote={setNote} windowed />
    {note && <div className={cx('pop fixed left-1/2 -translate-x-1/2 top-16 z-50 flex items-center gap-2 rounded-full bg-black/80 backdrop-blur-md pl-3.5 pr-1.5 h-9 text-[12px] shadow-xl ring-1 ring-white/10', note.bad ? 'text-red-300' : 'text-zinc-100')}>
      <Info size={13} />{note.text}
      {note.file && <button onClick={() => api.send('reveal', note.file)} className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 h-6 hover:bg-white/20"><FolderOpen size={12} />Show</button>}
      <button onClick={() => setNote(null)} className="size-6 grid place-items-center rounded-full hover:bg-white/10"><X size={12} /></button>
    </div>}
  </div>
}
