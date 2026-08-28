import React from 'react';
import { Pause, Popcorn, PowerOff } from 'lucide-react';

/**
 * The three buttons that actually get used from the couch. Kept on their own
 * sticky row so they never scroll away, and given the loud tile colours from
 * the rest of the palette so they read at arm's length.
 */
const MACROS = [
  {
    name: 'movie-start',
    label: 'Movie Start',
    detail: 'Lights down · sync on',
    icon: Popcorn,
    bg: '#b4735a',
    fg: '#1c0f0a',
  },
  {
    name: 'intermission',
    label: 'Intermission',
    detail: 'Lights up · sync parked',
    icon: Pause,
    bg: '#6f7a4f',
    fg: '#12160a',
  },
  {
    name: 'all-off',
    label: 'System All Off',
    detail: 'Everything down',
    icon: PowerOff,
    bg: '#0a0d12',
    fg: '#fca5a5',
    outline: '#7f1d1d',
  },
];

export default function MacroBar({ onRun, running, lastMacro }) {
  return (
    <div className="shrink-0 border-t border-line bg-ink px-4 py-2.5">
      <div className="grid grid-cols-3 gap-3">
        {MACROS.map((macro) => {
          const Icon = macro.icon;
          const isLast = lastMacro === macro.label;
          return (
            <button
              key={macro.name}
              type="button"
              disabled={running}
              onClick={() => onRun(macro.name)}
              className="ht-tap flex h-[64px] items-center gap-3 rounded-card border px-4 text-left disabled:opacity-60"
              style={{
                background: macro.bg,
                color: macro.fg,
                borderColor: macro.outline || 'transparent',
                boxShadow: isLast ? `0 0 0 2px ${macro.outline || macro.fg}` : 'none',
              }}
            >
              <Icon size={26} strokeWidth={2} />
              <span className="min-w-0">
                <span className="block truncate text-[17px] font-semibold leading-tight">
                  {macro.label}
                </span>
                <span className="block truncate text-[12px] leading-tight opacity-70">
                  {macro.detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
