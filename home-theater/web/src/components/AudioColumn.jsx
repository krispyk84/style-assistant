import React from 'react';
import { Minus, Moon, Plus, Speaker, Speech, Volume2, VolumeX } from 'lucide-react';
import { Card, CardHead, Slider, SectionLabel, IconButton, TogglePill } from './ui.jsx';
import { useThrottled } from '../useHubState.js';

/** Levels worth one tap — the volumes this room actually gets set to. */
const PRESETS = [
  { label: 'Quiet', level: 15 },
  { label: 'Movie', level: 32 },
  { label: 'Loud', level: 45 },
];

export default function AudioColumn({ state, send, patch, api }) {
  const { audio } = state;

  // Every drag frame paints locally; the hub hears about it on a trailing tick.
  const pushVolume = useThrottled(
    (v) => send(null, () => api.volume(v), { applyResponse: false }),
    140,
  );

  const setVolume = (v) => {
    patch((prev) => ({ ...prev, audio: { ...prev.audio, volume: v, muted: v > 0 ? false : prev.audio.muted } }));
    pushVolume(v);
  };

  const nudge = (delta) => {
    const next = Math.min(100, Math.max(0, audio.volume + delta));
    send(
      (prev) => ({ ...prev, audio: { ...prev.audio, volume: next, muted: false } }),
      () => api.volume(next),
    );
  };

  const jump = (level) =>
    send(
      (prev) => ({ ...prev, audio: { ...prev.audio, volume: level, muted: false } }),
      () => api.volume(level),
    );

  const toggleMute = () =>
    send(
      (prev) => ({ ...prev, audio: { ...prev.audio, muted: !prev.audio.muted } }),
      () => api.mute(!audio.muted),
    );

  return (
    <div className="ht-scroll flex flex-col gap-2 pb-1">
      <SectionLabel>Sonos Audio</SectionLabel>

      <Card>
        <CardHead
          icon={Speaker}
          tone="cyan"
          active={!audio.muted}
          title={audio.device}
          subtitle={audio.muted ? 'Muted' : 'Playing to theater group'}
          right={
            <IconButton
              icon={audio.muted ? VolumeX : Volume2}
              label={audio.muted ? 'Unmute' : 'Mute'}
              onClick={toggleMute}
              tone="amber"
              active={audio.muted}
            />
          }
        />

        <div className="mt-5 flex items-end gap-2">
          <span className="text-[64px] font-light leading-none tabular-nums text-slate-50">
            {audio.volume}
          </span>
          <span className="pb-2 text-[18px] text-slate-500">%</span>
          <span className="flex-1 pb-2 text-right text-[12px] uppercase tracking-widest text-slate-600">
            {audio.muted ? 'muted' : 'volume'}
          </span>
        </div>

        <Slider
          value={audio.volume}
          onInput={setVolume}
          tone="cyan"
          disabled={audio.muted}
          label={null}
          readout={null}
          leading={
            <IconButton icon={Minus} label="Volume down 1 percent" onClick={() => nudge(-1)} />
          }
          trailing={<IconButton icon={Plus} label="Volume up 1 percent" onClick={() => nudge(1)} />}
        />

        <div className="mt-1 grid grid-cols-3 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.level}
              type="button"
              onClick={() => jump(preset.level)}
              className={`ht-tap flex flex-col items-center justify-center rounded-2xl border text-[13px] font-medium ${
                audio.volume === preset.level && !audio.muted
                  ? 'border-ht-cyan text-slate-50'
                  : 'border-line bg-card text-slate-300'
              }`}
              style={
                audio.volume === preset.level && !audio.muted
                  ? { background: 'rgba(56,189,248,0.12)' }
                  : undefined
              }
            >
              {preset.label}
              <span className="text-[11px] tabular-nums text-slate-500">{preset.level}%</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-2 text-[13px] font-medium text-slate-300">Sound profile</div>
        <div className="grid grid-cols-2 gap-2">
          <TogglePill
            icon={Moon}
            label="Night Mode"
            sublabel="Off"
            on={audio.nightMode}
            onChange={(on) =>
              send(
                (prev) => ({ ...prev, audio: { ...prev.audio, nightMode: on } }),
                () => api.nightMode(on),
              )
            }
          />
          <TogglePill
            icon={Speech}
            label="Speech Enhancement"
            sublabel="Off"
            on={audio.speechEnhancement}
            onChange={(on) =>
              send(
                (prev) => ({ ...prev, audio: { ...prev.audio, speechEnhancement: on } }),
                () => api.speech(on),
              )
            }
          />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-600">
          Night Mode softens loud scenes; Speech Enhancement lifts dialogue out of the mix.
        </p>
      </Card>

    </div>
  );
}
