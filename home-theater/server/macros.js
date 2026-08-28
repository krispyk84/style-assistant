/**
 * Composite scenes.
 *
 * A macro mutates hub state and returns the ordered command envelopes needed to
 * get the room there. Ordering matters: lights come down before the sync box
 * takes over, and the TV is the last thing to power off so the room isn't dark
 * and silent while the panel is still fading.
 */

import { state, touch, SOURCE_INPUTS } from './state.js';

function applySource(source) {
  const patch = SOURCE_INPUTS[source] || SOURCE_INPUTS.appletv;
  state.source = source;
  state.tv.input = patch.tvInput;
  state.syncbox.hdmi = patch.hdmi;
  return patch;
}

const MACROS = {
  /** Lights down, sync on, TV on the current source, listening volume. */
  'movie-start': () => {
    const patch = applySource(state.source);
    state.tv.power = true;
    state.audio.muted = false;
    state.audio.volume = 32;
    state.audio.nightMode = false;
    state.audio.speechEnhancement = false;
    state.syncbox.sync = true;
    state.syncbox.mode = 'video';
    state.syncbox.intensity = 80;
    state.lights.bias = { ...state.lights.bias, level: 20, on: true };
    state.lights.room = { ...state.lights.room, level: 0, on: false };

    return {
      label: 'Movie Start',
      commands: [
        { device: 'lights', command: 'dim', payload: { device: 'room', level: 0 } },
        { device: 'lights', command: 'dim', payload: { device: 'bias', level: 20 } },
        { device: 'tv', command: 'power', payload: { power: 'on' } },
        { device: 'tv', command: 'input', payload: { input: patch.tvInput } },
        { device: 'syncbox', command: 'state', payload: { sync: true, mode: 'video', intensity: 80, hdmi: patch.hdmi } },
        { device: 'sonos', command: 'volume', payload: { volume: 32 } },
        { device: 'sonos', command: 'mute', payload: { muted: false } },
      ],
    };
  },

  /** House lights half up, sync parked, volume backed off for conversation. */
  intermission: () => {
    state.syncbox.sync = false;
    state.audio.volume = 14;
    state.lights.bias = { ...state.lights.bias, level: 45, on: true };
    state.lights.room = { ...state.lights.room, level: 55, on: true };

    return {
      label: 'Intermission',
      commands: [
        { device: 'syncbox', command: 'state', payload: { sync: false } },
        { device: 'sonos', command: 'volume', payload: { volume: 14 } },
        { device: 'lights', command: 'dim', payload: { device: 'bias', level: 45 } },
        { device: 'lights', command: 'dim', payload: { device: 'room', level: 55 } },
      ],
    };
  },

  /** Everything down. Room lights are left off — this is the "leaving" scene. */
  'all-off': () => {
    state.syncbox.sync = false;
    state.audio.muted = true;
    state.audio.nightMode = false;
    state.audio.speechEnhancement = false;
    state.lights.bias = { ...state.lights.bias, level: 0, on: false };
    state.lights.room = { ...state.lights.room, level: 0, on: false };
    state.tv.power = false;

    return {
      label: 'System All Off',
      commands: [
        { device: 'syncbox', command: 'state', payload: { sync: false } },
        { device: 'sonos', command: 'mute', payload: { muted: true } },
        { device: 'lights', command: 'dim', payload: { device: 'bias', level: 0 } },
        { device: 'lights', command: 'dim', payload: { device: 'room', level: 0 } },
        { device: 'tv', command: 'power', payload: { power: 'off' } },
      ],
    };
  },
};

/** Runs the macro against hub state and returns `{ label, commands }`. */
function runMacro(name) {
  const macro = MACROS[name];
  if (!macro) return null;
  const result = macro();
  state.lastMacro = result.label;
  state.lastMacroAt = new Date().toISOString();
  touch();
  return result;
}

const macroNames = () => Object.keys(MACROS);

export { runMacro, macroNames, applySource };
