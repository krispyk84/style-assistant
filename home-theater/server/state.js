/**
 * Canonical hub state.
 *
 * The hub is the single source of truth for what the room *should* look like.
 * Device drivers (server/devices.js) push these values out to the real gear;
 * every dashboard on the LAN reads them back from GET /api/state, so two iPads
 * pointed at the same hub never disagree.
 */

const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(Number(n) || 0)));

const SOURCES = ['appletv', 'shield'];
const SYNC_MODES = ['video', 'game', 'music'];

/** HDMI port each source is patched into on the Hue Sync Box. */
const SOURCE_INPUTS = {
  appletv: { hdmi: 'input1', label: 'Apple TV', tvInput: 'HDMI_1' },
  shield: { hdmi: 'input2', label: 'NVIDIA Shield', tvInput: 'HDMI_2' },
};

const state = {
  tv: { power: false, input: 'HDMI_1', model: 'LG OLED C3 65"' },
  source: 'appletv',
  audio: {
    device: 'Sonos Arc + Sub',
    volume: 28,
    muted: false,
    nightMode: false,
    speechEnhancement: false,
  },
  syncbox: {
    sync: false,
    mode: 'video',
    intensity: 70,
    hdmi: 'input1',
  },
  lights: {
    bias: { name: 'Hue Play Bias', level: 0, on: false },
    room: { name: 'Kasa Room Lights', level: 60, on: true },
  },
  lastMacro: null,
  lastMacroAt: null,
  updatedAt: new Date().toISOString(),
};

function touch() {
  state.updatedAt = new Date().toISOString();
  return state;
}

/** Deep-ish snapshot so callers can't mutate the store by accident. */
function snapshot() {
  return JSON.parse(JSON.stringify(state));
}

export { state, snapshot, touch, clamp, SOURCES, SYNC_MODES, SOURCE_INPUTS };
