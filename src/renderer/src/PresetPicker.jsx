// Preset window: pick a phone game, PC game or studio scene, choose horizontal or vertical, then a layout.
import { useMemo, useState } from 'react'
import { Smartphone, Monitor, Clapperboard, RectangleHorizontal, RectangleVertical } from 'lucide-react'
import { Segmented, cx } from './ui'
import { Dialog } from './Dialogs'
import { useMeta, AppIcon } from './Library'
import { Preview } from './Pages'
import { GAMES, LAYOUTS, STUDIO, PRESETS, gamePreset, steamArt } from './scene'

const PHONE = GAMES.filter(g => !g.pc).map(g => ({ ...g, name: g.name }))
const PC = GAMES.filter(g => g.pc)

export default function PresetPicker({ onPick, onClose }) {
  const [tab, setTab] = useState('phone'), [ori, setOri] = useState('h'), [gid, setGid] = useState('bgmi')
  const meta = useMeta(PHONE)
  const list = tab === 'phone' ? PHONE : PC
  const g = list.find(x => x.id === gid) || list[0]
  const items = useMemo(() => tab === 'studio'
    ? STUDIO.map(n => ({ key: n, label: n.replace(/^Vertical · /, ''), p: PRESETS[n]() })).filter(x => (x.p.set?.canvas === '1080x1920') === (ori === 'v'))
    : LAYOUTS.filter(l => l.v === (ori === 'v')).map(l => ({ key: g.id + l.id, label: l.name, p: gamePreset(g, l) })), [tab, ori, g])

  return (
    <Dialog title="Choose a preset" onClose={onClose} className="w-[980px] h-[640px]">
      <div className="h-full flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="flex-1"><Segmented value={tab} onChange={t => { setTab(t); setGid((t === 'pc' ? PC : PHONE)[0].id) }} options={[['phone', 'Phone games', Smartphone], ['pc', 'PC games', Monitor], ['studio', 'Studio', Clapperboard]]} /></div>
          <div className="w-[260px]"><Segmented value={ori} onChange={setOri} options={[['h', 'Horizontal', RectangleHorizontal], ['v', 'Vertical', RectangleVertical]]} /></div>
        </div>
        <div className="flex-1 min-h-0 flex gap-3">
          {tab !== 'studio' && <div className="w-[230px] shrink-0 overflow-y-auto space-y-0.5 pr-1">
            {list.map(x => (
              <button key={x.id} onClick={() => setGid(x.id)} className={cx('w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors', x.id === g.id ? 'bg-black' : 'hover:bg-white/[0.06]')}>
                {x.pc ? <img src={steamArt(x.steam)} className="w-[64px] h-[30px] shrink-0 rounded-md object-cover bg-zinc-800" draggable={false} />
                  : <AppIcon app={{ pkg: x.pkg, name: x.name }} meta={meta} size={34} />}
                <span className="min-w-0"><span className="block truncate text-[13px] font-medium text-zinc-100">{x.name}</span>
                  <span className="block text-[11px] text-zinc-500">{x.pc ? 'PC · screen capture' : x.portrait ? 'Phone · portrait' : 'Phone game'}</span></span>
              </button>
            ))}
          </div>}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className={cx('grid gap-2.5', ori === 'v' ? 'grid-cols-[repeat(auto-fill,minmax(170px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]')}>
              {items.map(x => (
                <button key={x.key} onClick={() => { onPick(x.p); onClose() }} className="group text-left rounded-xl bg-[#242427] border border-transparent hover:border-white/25 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                  <div className={cx('relative bg-black/40', ori === 'v' ? 'h-[260px]' : 'h-[150px]')}><Preview name={x.key} preset={x.p} className="absolute inset-0 m-auto max-w-[calc(100%-20px)] max-h-[calc(100%-20px)]" /></div>
                  <div className="px-3 py-2 text-[12px] font-medium text-zinc-100 truncate">{x.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
