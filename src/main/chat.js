// YouTube live chat reader without an API key: it polls the same endpoint the watch page uses.
// (Unofficial — if YouTube changes the page format this is the file to update.)
const H = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept-language': 'en' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = t => (t?.runs || []).map(r => r.text || r.emoji?.shortcuts?.[0] || '').join('') || t?.simpleText || ''

function parse(it) {
  const t = it.liveChatTextMessageRenderer, p = it.liveChatPaidMessageRenderer || it.liveChatPaidStickerRenderer, m = it.liveChatMembershipItemRenderer
  const r = t || p || m
  if (!r) return null
  return { id: r.id, author: text(r.authorName), text: text(r.message) || text(r.headerSubtext), type: t ? 'chat' : m ? 'member' : 'superchat', amount: text(r.purchaseAmountText) }
}

export class Chat {
  constructor(emit) { this.emit = emit }

  async start(input) {
    this.stop()
    let url = input.trim()
    if (/^[\w-]{11}$/.test(url)) url = 'https://www.youtube.com/watch?v=' + url
    else if (url.startsWith('@')) url = `https://www.youtube.com/${url}/live`
    else if (!/^https?:/.test(url)) url = 'https://' + url
    const html = await (await fetch(url, { headers: H })).text()
    const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1], ver = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1]
    let cont = html.match(/"liveChatRenderer":\{"continuations":\[\{"reloadContinuationData":\{"continuation":"([^"]+)"/)?.[1]
    if (!key || !cont) throw new Error('No live chat found. Paste the link of a stream that is live right now.')
    this.info = { key, ver, vid: html.match(/"videoId":"([\w-]{11})"/)?.[1] || url.match(/v=([\w-]{11})/)?.[1] }
    const token = this.token = {}
    ;(async () => {
      for (let first = true; this.token === token; first = false) {
        const r = await fetch(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${key}&prettyPrint=false`, {
          method: 'POST', headers: { ...H, 'content-type': 'application/json' },
          body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: ver } }, continuation: cont })
        }).then(r => r.json()).catch(() => null)
        const lc = r?.continuationContents?.liveChatContinuation
        if (!lc) { await sleep(3000); continue }
        const c = lc.continuations?.[0], d = c?.invalidationContinuationData || c?.timedContinuationData || c?.reloadContinuationData
        if (d?.continuation) cont = d.continuation
        for (const a of lc.actions || []) {
          const m = a.addChatItemAction?.item && parse(a.addChatItemAction.item)
          if (m && this.token === token) this.emit({ ...m, old: first }) // the first batch is history: shown, but never triggers automations
        }
        await sleep(Math.min(Math.max(d?.timeoutMs || 2000, 1000), 5000))
      }
    })()
    return { title: (html.match(/<title>([^<]*)<\/title>/)?.[1] || 'Live chat').replace(/ - YouTube$/, '') }
  }

  stop() { this.token = null }
}
