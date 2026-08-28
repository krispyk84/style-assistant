import React from 'react';
import { CircleAlert, MapPin, Sparkles, Tv, Volume2, VolumeX } from 'lucide-react';

const SYNC_LABELS = { video: 'Video', game: 'Game', music: 'Music' };

const clock = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

function Stat({ icon: Icon, value, label, tone }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-3 py-2">
      <Icon size={18} color={tone} strokeWidth={1.9} />
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold text-slate-100">{value}</span>
        <span className="block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      </span>
    </div>
  );
}

export default function TopBar({ state, bridges, error }) {
  const bridged = bridges ? Object.values(bridges).some((v) => v === 'bridged') : false;
  const allMock = bridges ? Object.values(bridges).every((v) => v === 'mock') : true;

  return (
    <div className="flex shrink-0 items-center gap-4 px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-semibold leading-none tracking-tight text-slate-50">
            Theater Room
          </h1>
          <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {allMock ? 'Mock hub' : bridged ? 'Live bridges' : 'Hub'}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[12px] text-slate-500">
          <MapPin size={12} strokeWidth={2} />
          <span className="truncate">Basement · 7.1.4 Atmos · updated {clock(state?.updatedAt)}</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-ht-red/50 bg-ht-red/10 px-3 py-2 text-[12px] text-ht-red">
            <CircleAlert size={16} strokeWidth={2} />
            <span className="max-w-[180px] truncate">{error}</span>
          </div>
        ) : null}

        {state ? (
          <>
            <Stat
              icon={Tv}
              tone={state.tv.power ? '#38bdf8' : '#475569'}
              value={state.tv.power ? 'On' : 'Standby'}
              label="Display"
            />
            <Stat
              icon={state.audio.muted ? VolumeX : Volume2}
              tone={state.audio.muted ? '#f59e0b' : '#38bdf8'}
              value={state.audio.muted ? 'Muted' : `${state.audio.volume}%`}
              label="Sonos"
            />
            <Stat
              icon={Sparkles}
              tone={state.syncbox.sync ? '#f59e0b' : '#475569'}
              value={state.syncbox.sync ? SYNC_LABELS[state.syncbox.mode] : 'Off'}
              label="Sync"
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
