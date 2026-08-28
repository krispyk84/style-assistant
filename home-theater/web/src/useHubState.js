import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const POLL_MS = 4000;
/** How long a local edit outranks a poll response, so a drag never snaps back. */
const LOCAL_EDIT_GRACE_MS = 1500;

/**
 * Owns the dashboard's view of hub state.
 *
 * Reads are a slow poll (a second iPad or a physical remote can change the room
 * out from under us). Writes are optimistic: the local patch paints instantly,
 * the hub's authoritative answer lands a moment later.
 */
export function useHubState() {
  const [state, setState] = useState(null);
  const [bridges, setBridges] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const lastEditAt = useRef(0);
  const inFlight = useRef(0);

  const load = useCallback(async ({ fromPoll = false } = {}) => {
    try {
      const res = await api.getState();
      const stale = fromPoll && (inFlight.current > 0 || Date.now() - lastEditAt.current < LOCAL_EDIT_GRACE_MS);
      if (!stale) setState(res.state);
      setBridges(res.bridges);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load({ fromPoll: true }), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  /** Local-only paint. Used by sliders so a drag renders at screen rate. */
  const patch = useCallback((fn) => {
    lastEditAt.current = Date.now();
    setState((prev) => (prev ? fn(prev) : prev));
  }, []);

  /**
   * Paint `optimistic` immediately, then run `call`. If the hub rejects it we
   * fall back to whatever the hub actually thinks is true.
   *
   * `applyResponse: false` keeps the hub's echo from overwriting the screen —
   * used for the rapid-fire writes behind a slider drag, where a late reply
   * carrying an older value would yank the handle backwards. The poll
   * reconciles those a few seconds later.
   */
  const send = useCallback(
    async (optimistic, call, { applyResponse = true } = {}) => {
      lastEditAt.current = Date.now();
      if (optimistic) setState((prev) => (prev ? optimistic(prev) : prev));

      inFlight.current += 1;
      setBusy(true);
      try {
        const res = await call();
        if (res?.state && applyResponse) setState(res.state);
        setError(null);
        return res;
      } catch (err) {
        setError(err.message);
        load();
        return null;
      } finally {
        inFlight.current -= 1;
        lastEditAt.current = Date.now();
        if (inFlight.current === 0) setBusy(false);
      }
    },
    [load],
  );

  return { state, bridges, error, busy, send, patch, reload: load };
}

/**
 * Sliders fire far faster than the hub needs to hear about it. Paint every
 * frame locally, but only push to the network on a trailing interval.
 */
export function useThrottled(fn, ms = 140) {
  const timer = useRef(null);
  const pending = useRef(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback(
    (...args) => {
      pending.current = args;
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        const args2 = pending.current;
        pending.current = null;
        if (args2) fnRef.current(...args2);
      }, ms);
    },
    [ms],
  );
}
