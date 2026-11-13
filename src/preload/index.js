import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  invoke: (ch, ...a) => ipcRenderer.invoke(ch, ...a),
  send: (ch, ...a) => ipcRenderer.send(ch, ...a),
  on: (ch, fn) => {
    const h = (_, ...a) => fn(...a)
    ipcRenderer.on(ch, h)
    return () => ipcRenderer.off(ch, h)
  }
})
