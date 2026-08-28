import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/** What the hub has actually dispatched — the proof that a tap on the glass
 *  turned into a command on the wire. */
export default function ActivityDrawer({ open, onClose }) {
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    const load = () =>
      fetch('/api/log')
        .then((r) => r.json())
        .then((json) => alive && setLog(json.log || []))
        .catch(() => {});
    load();
    const id = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/70" onClick={onClose}>
      <div
        className="flex h-full w-[380px] flex-col border-l border-line bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="text-[16px] font-semibold text-slate-100">Hub activity</div>
            <div className="text-[12px] text-slate-500">Last {log.length} dispatched commands</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity"
            className="ht-tap flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-raised"
          >
            <X size={20} color="#94a3b8" strokeWidth={2} />
          </button>
        </div>

        <div className="ht-scroll flex-1 p-3">
          {log.length === 0 ? (
            <div className="px-1 py-6 text-center text-[13px] text-slate-600">
              Nothing dispatched yet.
            </div>
          ) : (
            log.map((entry, i) => (
              <div key={`${entry.at}-${i}`} className="mb-2 rounded-2xl border border-line bg-raised p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-slate-200">
                    {entry.device}.{entry.command}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: entry.status === 'ok' ? '#93b48b' : '#ef4444' }}
                  >
                    {entry.transport}
                    {entry.status === 'ok' ? '' : ` · ${entry.detail || 'failed'}`}
                  </span>
                </div>
                <div className="mt-1 truncate font-mono text-[11px] text-slate-500">
                  {JSON.stringify(entry.payload)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
