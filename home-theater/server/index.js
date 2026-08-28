/**
 * Home theater hub.
 *
 * One Express process on the LAN that owns room state, fans commands out to
 * device bridges, and serves the built dashboard. The iPad talks only to this.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';

import { state, snapshot, touch, clamp, SOURCES, SYNC_MODES } from './state.js';
import { dispatch, commandLog, bridgeStatus } from './devices.js';
import { runMacro, macroNames, applySource } from './macros.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4100);

const app = express();
app.use(cors());
app.use(express.json());

/** Every mutating route ends the same way: dispatch, then hand back fresh state. */
async function commit(res, commands, extra = {}) {
  const dispatched = await dispatch(commands);
  touch();
  res.json({ ok: true, state: snapshot(), dispatched, ...extra });
}

const bad = (res, message) => res.status(400).json({ ok: false, error: message });

// ---------------------------------------------------------------- state ----

app.get('/api/state', (_req, res) => {
  res.json({
    ok: true,
    state: snapshot(),
    bridges: bridgeStatus(),
    macros: macroNames(),
  });
});

app.get('/api/log', (_req, res) => res.json({ ok: true, log: commandLog }));

// ------------------------------------------------------------------ tv ----

app.post('/api/tv/power', (req, res) => {
  const power =
    typeof req.body?.power === 'boolean' ? req.body.power : !state.tv.power;
  state.tv.power = power;
  // Killing the panel leaves the sync box chasing a dead signal.
  if (!power) state.syncbox.sync = false;
  return commit(res, [{ device: 'tv', command: 'power', payload: { power: power ? 'on' : 'off' } }]);
});

app.post('/api/tv/remote', (req, res) => {
  const key = String(req.body?.key || '').toLowerCase();
  const allowed = ['up', 'down', 'left', 'right', 'ok', 'back', 'home', 'menu', 'playpause'];
  if (!allowed.includes(key)) return bad(res, `unknown remote key: ${req.body?.key}`);
  // The remote follows whichever source is on screen — Apple TV and Shield
  // take the same key names, so the bridge decides where it lands.
  return commit(res, [{ device: 'tv', command: 'remote', payload: { key, target: state.source } }], { key });
});

/**
 * Source switch. One press has to move both the TV input and the sync box HDMI
 * patch, otherwise the sync box lights up against the wrong picture.
 */
app.post('/api/source', (req, res) => {
  const source = String(req.body?.source || '');
  if (!SOURCES.includes(source)) return bad(res, `source must be one of ${SOURCES.join(', ')}`);
  const patch = applySource(source);
  if (!state.tv.power) state.tv.power = true;
  return commit(res, [
    { device: 'tv', command: 'power', payload: { power: 'on' } },
    { device: 'tv', command: 'input', payload: { input: patch.tvInput } },
    { device: 'syncbox', command: 'state', payload: { hdmi: patch.hdmi } },
  ]);
});

// --------------------------------------------------------------- sonos ----

app.post('/api/sonos/volume', (req, res) => {
  const { volume, delta } = req.body ?? {};
  if (volume === undefined && delta === undefined) return bad(res, 'volume or delta required');
  const next = clamp(volume === undefined ? state.audio.volume + Number(delta) : volume);
  state.audio.volume = next;
  // Any deliberate volume move implies you want to hear it.
  if (next > 0 && state.audio.muted) state.audio.muted = false;
  return commit(res, [
    { device: 'sonos', command: 'volume', payload: { volume: next } },
    ...(state.audio.muted ? [] : [{ device: 'sonos', command: 'mute', payload: { muted: false } }]),
  ]);
});

app.post('/api/sonos/mute', (req, res) => {
  const muted = typeof req.body?.muted === 'boolean' ? req.body.muted : !state.audio.muted;
  state.audio.muted = muted;
  return commit(res, [{ device: 'sonos', command: 'mute', payload: { muted } }]);
});

app.post('/api/sonos/toggle-nightmode', (req, res) => {
  const on = typeof req.body?.on === 'boolean' ? req.body.on : !state.audio.nightMode;
  state.audio.nightMode = on;
  return commit(res, [{ device: 'sonos', command: 'nightmode', payload: { on } }]);
});

app.post('/api/sonos/toggle-speech', (req, res) => {
  const on = typeof req.body?.on === 'boolean' ? req.body.on : !state.audio.speechEnhancement;
  state.audio.speechEnhancement = on;
  return commit(res, [{ device: 'sonos', command: 'speech', payload: { on } }]);
});

// ------------------------------------------------------------- syncbox ----

/** Partial update — send only the fields you're changing. */
app.post('/api/syncbox/state', (req, res) => {
  const { sync, mode, intensity, source } = req.body ?? {};
  const payload = {};

  if (sync !== undefined) {
    state.syncbox.sync = Boolean(sync);
    // Sync with no picture is a no-op, so bring the panel up with it.
    if (state.syncbox.sync && !state.tv.power) state.tv.power = true;
    payload.sync = state.syncbox.sync;
  }
  if (mode !== undefined) {
    if (!SYNC_MODES.includes(mode)) return bad(res, `mode must be one of ${SYNC_MODES.join(', ')}`);
    state.syncbox.mode = mode;
    payload.mode = mode;
  }
  if (intensity !== undefined) {
    state.syncbox.intensity = clamp(intensity);
    payload.intensity = state.syncbox.intensity;
  }
  if (source !== undefined) {
    if (!SOURCES.includes(source)) return bad(res, `source must be one of ${SOURCES.join(', ')}`);
    payload.hdmi = applySource(source).hdmi;
  }
  if (Object.keys(payload).length === 0) return bad(res, 'nothing to change');

  return commit(res, [{ device: 'syncbox', command: 'state', payload }]);
});

// -------------------------------------------------------------- lights ----

app.post('/api/lights/dim', (req, res) => {
  const device = String(req.body?.device || '');
  if (!['bias', 'room'].includes(device)) return bad(res, 'device must be "bias" or "room"');
  if (req.body?.level === undefined) return bad(res, 'level required');
  const level = clamp(req.body.level);
  state.lights[device] = { ...state.lights[device], level, on: level > 0 };
  return commit(res, [{ device: 'lights', command: 'dim', payload: { device, level } }]);
});

// -------------------------------------------------------------- macros ----

app.post('/api/macro/:name', async (req, res) => {
  const result = runMacro(req.params.name);
  if (!result) return res.status(404).json({ ok: false, error: `unknown macro: ${req.params.name}` });
  return commit(res, result.commands, { macro: result.label });
});

// --------------------------------------------------------------- static ---

const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error('[hub] unhandled', err);
  res.status(500).json({ ok: false, error: 'internal error' });
});

app.listen(PORT, '0.0.0.0', () => {
  const bridges = bridgeStatus();
  console.log(`[hub] listening on http://0.0.0.0:${PORT}`);
  console.log(`[hub] bridges: ${Object.entries(bridges).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  if (!fs.existsSync(dist)) console.log('[hub] no dist/ yet — run `npm run build`, or use `npm run dev` for the Vite dev server');
});

export default app;
