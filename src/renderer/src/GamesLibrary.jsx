// Games library (bottom of the Scene tab): poster cards; click one to open its presets.
import { useEffect, useState } from 'react'
import { Gamepad2, ChevronRight } from 'lucide-react'
import { Section, cx } from './ui'
import { GAMES } from './scene'

const api = window.api, cache = {}
const ORDER = ['gta6', 'bgmi', 'ff', 'codm', 'gta', 'cs2', 'pubgpc', 'apex', 'genshin', 'mlbb', 'cyber', 'elden', 'dota', 'mcpe', 'asphalt', 'rust', 'cr', 'pogo']
const LIST = [...ORDER.map(id => GAMES.find(g => g.id === id)).filter(Boolean), ...GAMES.filter(g => !ORDER.includes(g.id))]

function Poster({ g, onClick }) {
  const [art, setArt] = useState(cache[g.id]), [bad, setBad] = useState(false)
  useEffect(() => { if (!cache[g.id]) api.invoke('game:art', { id: g.id, steam: g.steam, wiki: g.wiki, pkg: g.pkg }).then(a => { cache[g.id] = a; setArt(a) }).catch(() => {}) }, [])
  const img = !bad && (art?.poster || art?.bg)
  return <button onClick={onClick} title={g.name + ' presets'} className="group relative aspect-[817/1000] w-full overflow-hidden rounded-xl bg-[#2a2a2e] ring-1 ring-white/[0.07] transition-all duration-200 hover:-translate-y-0.5 hover:ring-white/40 hover:shadow-xl">
    {img ? <img src={img} onError={() => setBad(true)} draggable={false} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      : <span className="absolute inset-0" style={{ background: g.tile ? `linear-gradient(140deg,${g.tile.join(',')})` : 'linear-gradient(140deg,#3f3f46,#18181b)' }} />}
    {art === undefined && <span className="absolute inset-0 animate-pulse bg-white/[0.06]" />}
    {!art?.poster && <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />}
    {!art?.poster && <span className="absolute inset-x-1.5 bottom-1.5 flex flex-col items-center gap-1 text-center">
      {art?.icon && <img src={art.icon} draggable={false} className="size-8 rounded-lg shadow-lg ring-1 ring-white/20" />}
      <span className="text-[11px] font-extrabold uppercase leading-tight tracking-tight text-white drop-shadow">{g.name}</span></span>}
    <span className={cx('absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-md', g.console ? 'bg-black/60 text-pink-200' : g.pc ? 'bg-black/60 text-sky-200' : 'bg-black/60 text-emerald-200')}>{g.console ? 'Console' : g.pc ? 'PC' : 'Mobile'}</span>
  </button>
}

export default function GamesLibrary({ onGame, onAll }) {
  return <Section icon={Gamepad2} title="Games" right={<button onClick={onAll} className="flex items-center gap-0.5 text-[11px] text-zinc-400 hover:text-white">All presets<ChevronRight size={12} /></button>}>
    <div className="grid grid-cols-3 gap-2">{LIST.map(g => <Poster key={g.id} g={g} onClick={() => onGame(g)} />)}</div>
  </Section>
}
