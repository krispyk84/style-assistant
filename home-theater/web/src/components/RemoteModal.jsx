import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Home,
  Menu,
  Play,
  Undo2,
  X,
} from 'lucide-react';

const PAD = [
  [null, { key: 'up', icon: ChevronUp }, null],
  [{ key: 'left', icon: ChevronLeft }, { key: 'ok', label: 'OK' }, { key: 'right', icon: ChevronRight }],
  [null, { key: 'down', icon: ChevronDown }, null],
];

const EXTRAS = [
  { key: 'back', icon: Undo2, label: 'Back' },
  { key: 'home', icon: Home, label: 'Home' },
  { key: 'menu', icon: Menu, label: 'Menu' },
  { key: 'playpause', icon: Play, label: 'Play' },
];

/** D-pad popover. Keys go to the hub, which forwards them to whatever source
 *  is currently on screen. */
export default function RemoteModal({ open, onClose, onKey, target }) {
  const [lastKey, setLastKey] = useState(null);
  if (!open) return null;

  const press = (key) => {
    setLastKey(key);
    onKey(key);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-6"
      onClick={onClose}
    >
      <div
        className="w-[380px] rounded-card border border-line bg-raised p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[17px] font-semibold text-slate-100">Remote</div>
            <div className="text-[12px] text-slate-500">
              {lastKey ? `Sent “${lastKey}” to ${target}` : `Controlling ${target}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close remote"
            className="ht-tap flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-card"
          >
            <X size={22} color="#94a3b8" strokeWidth={2} />
          </button>
        </div>

        <div className="mx-auto grid w-[264px] grid-cols-3 gap-2">
          {PAD.flat().map((cell, i) =>
            cell === null ? (
              <span key={i} />
            ) : (
              <button
                key={cell.key}
                type="button"
                onClick={() => press(cell.key)}
                aria-label={cell.key}
                className={`flex h-[80px] items-center justify-center rounded-2xl border text-[16px] font-semibold ${
                  cell.label
                    ? 'border-ht-cyan text-ht-cyan'
                    : 'border-line bg-card text-slate-300'
                }`}
                style={cell.label ? { background: 'rgba(56,189,248,0.12)' } : undefined}
              >
                {cell.icon ? <cell.icon size={30} strokeWidth={2.2} /> : cell.label}
              </button>
            ),
          )}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {EXTRAS.map((extra) => (
            <button
              key={extra.key}
              type="button"
              onClick={() => press(extra.key)}
              aria-label={extra.label}
              className="ht-tap flex flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-card py-2 text-[11px] text-slate-400"
            >
              <extra.icon size={20} strokeWidth={1.9} color="#94a3b8" />
              {extra.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
