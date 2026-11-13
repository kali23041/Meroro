// Permissions & screens manager: OS media permissions, phone authorization, and screen/window sources.
import { useEffect, useState } from 'react'
import { X, Camera, Mic, Monitor, Smartphone, RefreshCw, Plus, Check, AlertTriangle } from 'lucide-react'
import { Button, cx } from './ui'

const api = window.api
const mac = api.platform === 'darwin'
const LABEL = { granted: 'Allowed', denied: 'Blocked', restricted: 'Restricted', 'not-determined': 'Not asked yet', unknown: 'Unknown' }

function Chip({ ok, children }) {
  return <span className={cx('inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium', ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>
    {ok ? <Check size={11} /> : <AlertTriangle size={11} />}{children}</span>
}

function Item({ icon: Icon, title, desc, ok, status, children }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <div className="size-9 rounded-lg bg-white/[0.06] grid place-items-center shrink-0"><Icon size={16} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2"><span className="font-medium">{title}</span><Chip ok={ok}>{status}</Chip></div>
        <div className="text-[11px] text-zinc-500 mt-0.5">{desc}</div>
      </div>
      <div className="flex gap-1.5 shrink-0">{children}</div>
    </div>
  )
}

export default function Permissions({ onClose, devices, addScreen }) {
  const [st, setSt] = useState({}), [screens, setScreens] = useState(null), [added, setAdded] = useState({})
  const status = () => api.invoke('perm:status').then(setSt).catch(() => {})
  const loadScreens = () => { setScreens(null); api.invoke('screen:thumbs').then(setScreens).catch(() => setScreens([])) }
  useEffect(() => { status(); const t = setInterval(status, 1500); return () => clearInterval(t) }, [])
  useEffect(() => { if (st.screen === 'granted' && screens === null) loadScreens() }, [st.screen])
  const ask = async k => { await api.invoke('perm:ask', k); status() }
  const row = (k, icon, title, desc) => {
    const v = st[k] || 'unknown', ok = v === 'granted'
    return (
      <Item icon={icon} title={title} desc={desc} ok={ok} status={LABEL[v] || v}>
        {!ok && (k === 'screen' || v === 'not-determined') && <Button variant="primary" onClick={() => ask(k)}>Allow</Button>}
        {!ok && <Button onClick={() => api.invoke('perm:open', k)}>Open Settings</Button>}
      </Item>
    )
  }
  const phoneOk = devices.some(d => d.state === 'device')

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center" onPointerDown={e => e.target === e.currentTarget && onClose()}>
      <div className="w-[720px] max-h-[86vh] flex flex-col rounded-xl bg-zinc-900 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-2 px-4 h-12 border-b border-white/[0.06]">
          <span className="font-semibold flex-1">Permissions & screens</span>
          <button onClick={onClose} className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"><X size={15} /></button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Access</h3>
            {row('camera', Camera, 'Camera', 'Webcam / facecam sources')}
            {row('microphone', Mic, 'Microphone', 'Your voice in the stream')}
            {row('screen', Monitor, 'Screen recording', mac ? 'Screen and window sources. After allowing it in System Settings, restart Meroro.' : 'Screen and window sources')}
            {mac && st.screen !== 'granted' && <div className="flex justify-end"><Button onClick={() => api.invoke('app:relaunch')}><RefreshCw size={12} />Restart Meroro</Button></div>}
            <Item icon={Smartphone} title="Android phone" ok={phoneOk}
              status={phoneOk ? 'Authorized' : devices.some(d => d.state === 'unauthorized') ? 'Tap Allow on phone' : 'Not connected'}
              desc={phoneOk ? devices.filter(d => d.state === 'device').map(d => d.model).join(', ') : 'Settings → Developer options → USB debugging, then plug in and tap Allow'} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center">
              <h3 className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Screens & windows</h3>
              <Button variant="ghost" disabled={st.screen !== 'granted'} onClick={loadScreens}><RefreshCw size={12} />Refresh</Button>
            </div>
            {st.screen !== 'granted' ? <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-[12px] text-zinc-500">Allow screen recording above to add screens and windows.</div>
              : screens === null ? <div className="p-4 text-center text-[12px] text-zinc-500">Looking for screens…</div>
              : <div className="grid grid-cols-3 gap-2">
                {screens.map(x => (
                  <div key={x.id} className="rounded-lg bg-black/30 border border-white/[0.06] overflow-hidden">
                    <img src={x.thumb} className="w-full aspect-video object-contain bg-black" />
                    <div className="flex items-center gap-1 p-1.5">
                      <span className="flex-1 truncate text-[11px]">{x.name}</span>
                      <Button variant={added[x.id] ? 'default' : 'primary'} className="h-6 px-2" onClick={() => { addScreen(x); setAdded(a => ({ ...a, [x.id]: true })) }}>
                        {added[x.id] ? <Check size={12} /> : <Plus size={12} />}{added[x.id] ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>}
          </div>
        </div>
      </div>
    </div>
  )
}
