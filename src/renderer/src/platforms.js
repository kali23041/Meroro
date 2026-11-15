// Streaming platforms: default ingest server and where to find the stream key. `ask` = the platform gives each account its own server URL.
export const PLATFORMS = [
  { id: 'youtube', site: 'youtube.com', name: 'YouTube', url: 'rtmps://a.rtmps.youtube.com:443/live2', help: 'https://www.youtube.com/live_dashboard', color: '#ff3b30' },
  { id: 'twitch', site: 'twitch.tv', name: 'Twitch', url: 'rtmps://live.twitch.tv:443/app', rtmp: 'rtmp://live.twitch.tv/app', help: 'https://dashboard.twitch.tv/settings/stream', color: '#9146ff' },
  { id: 'kick', site: 'kick.com', name: 'Kick', url: 'rtmps://fa723fc1b171.global-contribute.live-video.net:443/app', help: 'https://dashboard.kick.com/channel/stream', color: '#53fc18' },
  { id: 'facebook', site: 'facebook.com', name: 'Facebook Live', url: 'rtmps://live-api-s.facebook.com:443/rtmp', help: 'https://www.facebook.com/live/producer', color: '#1877f2' },
  { id: 'instagram', site: 'instagram.com', name: 'Instagram Live', url: 'rtmps://live-upload.instagram.com:443/rtmp', help: 'https://www.instagram.com/', color: '#e1306c', vertical: true },
  { id: 'tiktok', site: 'tiktok.com', name: 'TikTok Live', ask: true, help: 'https://livecenter.tiktok.com/producer', color: '#25f4ee', vertical: true },
  { id: 'x', site: 'x.com', name: 'X (Twitter)', ask: true, help: 'https://studio.x.com/producer', color: '#e7e9ea' },
  { id: 'trovo', name: 'Trovo', url: 'rtmp://livepush.trovo.live/live', help: 'https://studio.trovo.live/mychannel/stream', color: '#19d66b' },
  { id: 'rumble', site: 'rumble.com', name: 'Rumble', ask: true, help: 'https://rumble.com/account/livestreams', color: '#85c742' },
  { id: 'loco', site: 'loco.gg', name: 'Loco', ask: true, help: 'https://loco.gg/', color: '#ff6a3d' },
  { id: 'dlive', site: 'dlive.tv', name: 'DLive', url: 'rtmp://stream.dlive.tv/live', help: 'https://dlive.tv/s/dashboard#0', color: '#ffd300' },
  { id: 'linkedin', site: 'linkedin.com', name: 'LinkedIn Live', ask: true, help: 'https://www.linkedin.com/video/golive/now/', color: '#0a66c2' },
  { id: 'vimeo', site: 'vimeo.com', name: 'Vimeo', url: 'rtmps://rtmp-global.cloud.vimeo.com:443/live', help: 'https://vimeo.com/manage/events', color: '#1ab7ea' },
  { id: 'custom', name: 'Custom RTMP', ask: true, color: '#a1a1aa' }
]
export const platform = id => PLATFORMS.find(p => p.id === id) || PLATFORMS.at(-1)
export const destUrl = d => { const p = platform(d.platform); return ((p.ask ? d.url : d.url || p.url) || '').trim() }
// ffmpeg options for one stream destination
export const destOut = (d, s) => { const p = platform(d.platform); return { dest: p.id, url: destUrl(d), rtmp: !d.url && p.rtmp || '', key: (d.key || '').trim(), bitrate: +d.bitrate || +s.bitrate, fps: +d.fps || +s.fps, encoder: s.encoder, sceneId: d.frameId ? '' : d.sceneId || '', size: d.frameId ? '' : d.size || '', frameId: d.frameId || '' } }
export const OUT_SIZES = [['', 'Same as main'], ['1920x1080', 'Horizontal 1080p'], ['1280x720', 'Horizontal 720p'], ['1080x1920', 'Vertical 1080×1920'], ['720x1280', 'Vertical 720×1280'], ['1080x1350', 'Portrait 4:5'], ['1080x1080', 'Square']]
