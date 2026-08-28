/** Thin client for the hub. Every mutating call answers with fresh hub state. */

async function request(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ ok: false, error: 'bad response' }));
  if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export const api = {
  getState: () => request('/api/state'),
  macro: (name) => request(`/api/macro/${name}`, {}),

  tvPower: (power) => request('/api/tv/power', { power }),
  remote: (key) => request('/api/tv/remote', { key }),
  source: (source) => request('/api/source', { source }),

  volume: (volume) => request('/api/sonos/volume', { volume }),
  nudgeVolume: (delta) => request('/api/sonos/volume', { delta }),
  mute: (muted) => request('/api/sonos/mute', { muted }),
  nightMode: (on) => request('/api/sonos/toggle-nightmode', { on }),
  speech: (on) => request('/api/sonos/toggle-speech', { on }),

  syncbox: (patch) => request('/api/syncbox/state', patch),
  dim: (device, level) => request('/api/lights/dim', { device, level }),
};
