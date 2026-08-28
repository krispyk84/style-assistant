import React from 'react';
import { Tv, MonitorPlay, Gamepad2, Joystick, Speaker, Sparkles } from 'lucide-react';
import { Card, CardHead, PillGroup, SectionLabel, Switch } from './ui.jsx';

const SOURCES = [
  { value: 'appletv', label: 'Apple TV', sublabel: 'HDMI 1', icon: MonitorPlay },
  { value: 'shield', label: 'NVIDIA Shield', sublabel: 'HDMI 2', icon: Gamepad2 },
];

/** One node in the signal chain — reads straight off hub state, nothing faked. */
function PathStep({ icon: Icon, label, detail, active, tone = 'cyan' }) {
  const color = active ? (tone === 'amber' ? '#f59e0b' : '#38bdf8') : '#475569';
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line"
        style={{ background: '#0a0d12' }}
      >
        <Icon size={16} color={color} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-200">{label}</span>
      <span className="shrink-0 text-[11px] uppercase tracking-wide" style={{ color }}>
        {detail}
      </span>
    </div>
  );
}

const PathLink = () => <div className="ml-4 h-3 w-px bg-line" />;

export default function VideoColumn({ state, send, api, onOpenRemote }) {
  const { tv, source, syncbox, audio } = state;
  const activeSource = SOURCES.find((s) => s.value === source);
  const sourceLabel = activeSource?.label ?? '—';
  const sourceHdmi = activeSource?.sublabel ?? '—';
  const sourceIcon = activeSource?.icon ?? MonitorPlay;

  const setPower = (power) =>
    send(
      (prev) => ({
        ...prev,
        tv: { ...prev.tv, power },
        syncbox: power ? prev.syncbox : { ...prev.syncbox, sync: false },
      }),
      () => api.tvPower(power),
    );

  const setSource = (next) =>
    send(
      (prev) => ({
        ...prev,
        source: next,
        tv: { ...prev.tv, power: true, input: next === 'appletv' ? 'HDMI_1' : 'HDMI_2' },
        syncbox: { ...prev.syncbox, hdmi: next === 'appletv' ? 'input1' : 'input2' },
      }),
      () => api.source(next),
    );

  return (
    <div className="ht-scroll flex flex-col gap-3 pb-1">
      <SectionLabel>Video &amp; Display</SectionLabel>

      <Card>
        <CardHead
          icon={Tv}
          tone="cyan"
          active={tv.power}
          title={tv.model}
          subtitle={tv.power ? `On · ${tv.input.replace('_', ' ')}` : 'Standby'}
          right={<Switch on={tv.power} onChange={setPower} label="TV power" />}
        />
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-medium text-slate-300">Source</span>
          <span className="text-[12px] text-slate-500">routes TV + Sync Box</span>
        </div>
        <PillGroup options={SOURCES} value={source} onChange={setSource} tone="cyan" />
      </Card>

      <Card>
        <div className="mb-3 text-[13px] font-medium text-slate-300">Signal path</div>
        <PathStep icon={sourceIcon} label={sourceLabel} detail={sourceHdmi} active={tv.power} />
        <PathLink />
        <PathStep
          icon={Sparkles}
          label="Hue Sync Box"
          detail={syncbox.sync ? `Syncing · ${syncbox.mode}` : 'Passthrough'}
          active={syncbox.sync}
          tone="amber"
        />
        <PathLink />
        <PathStep
          icon={Tv}
          label="LG OLED"
          detail={tv.power ? tv.input.replace('_', ' ') : 'Standby'}
          active={tv.power}
        />
        <PathLink />
        <PathStep
          icon={Speaker}
          label="Sonos Arc"
          detail={audio.muted ? 'Muted' : `eARC · ${audio.volume}%`}
          active={!audio.muted}
        />
      </Card>

      <button
        type="button"
        onClick={onOpenRemote}
        className="ht-tap flex items-center gap-3 rounded-card border border-line bg-raised p-4 text-left"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-card">
          <Joystick size={22} color="#94a3b8" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold text-slate-100">Remote</div>
          <div className="truncate text-[12px] text-slate-500">D-pad for {sourceLabel}</div>
        </div>
        <span className="text-[22px] leading-none text-slate-600">›</span>
      </button>
    </div>
  );
}
