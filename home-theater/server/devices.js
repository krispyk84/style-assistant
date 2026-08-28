/**
 * Device drivers.
 *
 * The hub never talks a vendor protocol itself — it normalises every dashboard
 * action into a `{ device, command, payload }` envelope and hands it to a
 * driver. A driver either:
 *
 *   1. forwards the envelope to a configured local bridge over HTTP, or
 *   2. runs in mock mode (no bridge configured) and just records the call.
 *
 * Either way the hub's own state (server/state.js) is already updated by the
 * route before the driver runs, so the UI stays responsive even when a device
 * is unreachable — an unreachable device shows up as a `failed` entry in the
 * command log rather than a broken dashboard.
 *
 * Point a driver at real gear with env vars, e.g.
 *   TV_BRIDGE_URL=http://192.168.1.20:8080/lg
 *   SONOS_BRIDGE_URL=http://192.168.1.21:5005/theater
 *   SYNCBOX_BRIDGE_URL=http://192.168.1.22/api/v1
 *   LIGHTS_BRIDGE_URL=http://192.168.1.23:9000/kasa
 * A bridge receives POST <url>/<command> with the payload as a JSON body.
 */

const BRIDGES = {
  tv: process.env.TV_BRIDGE_URL || null,
  sonos: process.env.SONOS_BRIDGE_URL || null,
  syncbox: process.env.SYNCBOX_BRIDGE_URL || null,
  lights: process.env.LIGHTS_BRIDGE_URL || null,
};

const BRIDGE_TIMEOUT_MS = Number(process.env.BRIDGE_TIMEOUT_MS || 2500);
const LOG_LIMIT = 50;

/** Rolling log of everything the hub has dispatched, newest first. */
const commandLog = [];

function record(entry) {
  commandLog.unshift({ ...entry, at: new Date().toISOString() });
  commandLog.length = Math.min(commandLog.length, LOG_LIMIT);
  return entry;
}

async function forward(device, command, payload) {
  const base = BRIDGES[device];
  if (!base) {
    return record({ device, command, payload, transport: 'mock', status: 'ok' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/${command}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal,
    });
    return record({
      device,
      command,
      payload,
      transport: 'bridge',
      status: res.ok ? 'ok' : 'failed',
      detail: res.ok ? undefined : `HTTP ${res.status}`,
    });
  } catch (err) {
    return record({
      device,
      command,
      payload,
      transport: 'bridge',
      status: 'failed',
      detail: err.name === 'AbortError' ? 'timeout' : err.message,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispatch a list of `{ device, command, payload }` envelopes in order.
 * Macros rely on the ordering — bias light comes up before the TV goes dark.
 */
async function dispatch(commands) {
  const results = [];
  for (const cmd of commands) {
    results.push(await forward(cmd.device, cmd.command, cmd.payload));
  }
  return results;
}

const bridgeStatus = () =>
  Object.fromEntries(Object.entries(BRIDGES).map(([k, v]) => [k, v ? 'bridged' : 'mock']));

export { dispatch, forward, commandLog, bridgeStatus };
