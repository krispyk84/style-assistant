import React from 'react';
import { Clapperboard, Gamepad2, Lightbulb, Music, PanelTop, Sparkles, Sun, SunDim } from 'lucide-react';
import { Card, CardHead, PillGroup, SectionLabel, Slider, Switch } from './ui.jsx';
import { useThrottled } from '../useHubState.js';

const SYNC_MODES = [
  { value: 'video', label: 'Video', icon: Clapperboard },
  { value: 'game', label: 'Game', icon: Gamepad2 },
  { value: 'music', label: 'Music', icon: Music },
];

const INTENSITY_WORDS = [
  [25, 'Subtle'],
  [50, 'Moderate'],
  [75, 'High'],
  [101, 'Intense'],
];

const intensityWord = (v) => INTENSITY_WORDS.find(([max]) => v < max)?.[1] ?? 'Intense';

export default function LightingColumn({ state, send, patch, api }) {
  const { syncbox, lights } = state;

  const pushSync = useThrottled(
    (intensity) => send(null, () => api.syncbox({ intensity }), { applyResponse: false }),
    140,
  );

  const setIntensity = (v) => {
    patch((prev) => ({ ...prev, syncbox: { ...prev.syncbox, intensity: v } }));
    pushSync(v);
  };

  const pushDim = useThrottled(
    (device, level) => send(null, () => api.dim(device, level), { applyResponse: false }),
    140,
  );

  const setDim = (device, level) => {
    patch((prev) => ({
      ...prev,
      lights: { ...prev.lights, [device]: { ...prev.lights[device], level, on: level > 0 } },
    }));
    pushDim(device, level);
  };

  const jumpDim = (device, level) =>
    send(
      (prev) => ({
        ...prev,
        lights: { ...prev.lights, [device]: { ...prev.lights[device], level, on: level > 0 } },
      }),
      () => api.dim(device, level),
    );

  return (
    <div className="ht-scroll flex flex-col gap-2 pb-1">
      <SectionLabel>Lighting &amp; Sync</SectionLabel>

      <Card compact>
        <CardHead
          icon={Sparkles}
          tone="amber"
          active={syncbox.sync}
          title="Hue Sync Box"
          subtitle={
            syncbox.sync
              ? `Syncing · ${intensityWord(syncbox.intensity)}`
              : 'Passthrough'
          }
          right={
            <Switch
              on={syncbox.sync}
              label="Sync active"
              tone="amber"
              onChange={(on) =>
                send(
                  (prev) => ({
                    ...prev,
                    syncbox: { ...prev.syncbox, sync: on },
                    tv: on ? { ...prev.tv, power: true } : prev.tv,
                  }),
                  () => api.syncbox({ sync: on }),
                )
              }
            />
          }
        />

        <div className="mt-2">
          <PillGroup
            options={SYNC_MODES}
            value={syncbox.mode}
            tone="amber"
            onChange={(mode) =>
              send(
                (prev) => ({ ...prev, syncbox: { ...prev.syncbox, mode } }),
                () => api.syncbox({ mode }),
              )
            }
          />
        </div>

        <div>
          <Slider
            value={syncbox.intensity}
            onInput={setIntensity}
            tone="amber"
            disabled={!syncbox.sync}
            label="Intensity"
            readout={`${syncbox.intensity}% · ${intensityWord(syncbox.intensity)}`}
          />
        </div>
      </Card>

      <Card compact>
        <CardHead
          icon={PanelTop}
          tone="amber"
          active={lights.bias.on}
          title="Bias Light"
          subtitle="Hue Play · behind panel"
          right={
            <Switch
              on={lights.bias.on}
              tone="amber"
              label="Bias light"
              onChange={(on) => jumpDim('bias', on ? 30 : 0)}
            />
          }
        />
        <Slider
          value={lights.bias.level}
          onInput={(v) => setDim('bias', v)}
          tone="amber"
          label="Brightness"
          readout={`${lights.bias.level}%`}
        />
      </Card>

      <Card compact>
        <CardHead
          icon={Lightbulb}
          tone="amber"
          active={lights.room.on}
          title="Room Lights"
          subtitle="Kasa · ceiling cans"
          right={
            <Switch
              on={lights.room.on}
              tone="amber"
              label="Room lights"
              onChange={(on) => jumpDim('room', on ? 60 : 0)}
            />
          }
        />
        <Slider
          value={lights.room.level}
          onInput={(v) => setDim('room', v)}
          tone="amber"
          label="Master dimmer"
          readout={`${lights.room.level}%`}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => jumpDim('room', 0)}
            className="ht-tap flex items-center justify-center gap-2 rounded-2xl border border-line bg-card text-[14px] font-medium text-slate-300"
          >
            <SunDim size={18} strokeWidth={1.9} /> 0%
          </button>
          <button
            type="button"
            onClick={() => jumpDim('room', 100)}
            className="ht-tap flex items-center justify-center gap-2 rounded-2xl border border-line bg-card text-[14px] font-medium text-slate-300"
          >
            <Sun size={18} strokeWidth={1.9} /> 100%
          </button>
        </div>
      </Card>
    </div>
  );
}
