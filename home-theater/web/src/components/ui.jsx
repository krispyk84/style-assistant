import React from 'react';

/** Accent tones. Amber = light output, cyan = signal path, sage = plain on/off. */
export const TONES = {
  sage: { fill: '#93b48b', text: 'text-ht-sage', ring: 'border-ht-sage', soft: 'rgba(147,180,139,0.14)' },
  amber: { fill: '#f59e0b', text: 'text-ht-amber', ring: 'border-ht-amber', soft: 'rgba(245,158,11,0.14)' },
  cyan: { fill: '#38bdf8', text: 'text-ht-cyan', ring: 'border-ht-cyan', soft: 'rgba(56,189,248,0.14)' },
};

export function SectionLabel({ children, right }) {
  return (
    <div className="mb-1 flex items-center justify-between">
      <h2 className="text-[17px] font-semibold tracking-tight text-slate-100">{children}</h2>
      {right}
    </div>
  );
}

export function Card({ children, className = '', muted = false, compact = false }) {
  return (
    <div
      className={`rounded-card border border-line ${muted ? 'bg-card' : 'bg-raised'} ${
        compact ? 'px-4 py-3' : 'p-4'
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHead({ icon: Icon, title, subtitle, tone = 'sage', active = false, right }) {
  const t = TONES[tone];
  return (
    <div className="flex items-center gap-3">
      {Icon ? (
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line"
          style={{ background: active ? t.soft : '#0a0d12' }}
        >
          <Icon size={22} color={active ? t.fill : '#64748b'} strokeWidth={1.8} />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold text-slate-100">{title}</div>
        {subtitle ? <div className="truncate text-[12px] text-slate-500">{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}

/** Pill switch. The whole 48px block is the tap target, not just the pill. */
export function Switch({ on, onChange, tone = 'sage', label = 'toggle', disabled = false }) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="ht-tap -mr-2 flex items-center justify-end pl-2 pr-2 disabled:opacity-40"
    >
      <span
        className="flex h-[34px] w-[60px] items-center rounded-full border border-line px-[3px]"
        style={{ background: on ? t.fill : '#1e293b' }}
      >
        <span
          className="h-[26px] w-[26px] rounded-full bg-white"
          style={{
            transform: `translateX(${on ? 26 : 0}px)`,
            transition: 'transform 120ms linear',
          }}
        />
      </span>
    </button>
  );
}

/** Segmented pills — source selection, sync modes. */
export function PillGroup({ options, value, onChange, tone = 'cyan', columns }) {
  const t = TONES[tone];
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns || options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`ht-tap flex flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-1 text-[13px] font-medium ${
              active ? 'text-slate-50' : 'border-line text-slate-400'
            }`}
            style={active ? { background: t.soft, borderColor: t.fill } : { background: '#0a0d12' }}
          >
            {Icon ? <Icon size={20} color={active ? t.fill : '#64748b'} strokeWidth={1.8} /> : null}
            <span className="truncate leading-tight">{opt.label}</span>
            {opt.sublabel ? (
              <span className="text-[10px] font-normal text-slate-500">{opt.sublabel}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Labelled horizontal slider with a live readout.
 * `onInput` fires on every frame of the drag; `onCommit` on release.
 */
export function Slider({
  value,
  onInput,
  onCommit,
  tone = 'amber',
  label,
  readout,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  leading,
  trailing,
}) {
  const t = TONES[tone];
  const pct = ((value - min) / (max - min)) * 100;
  const fill = disabled ? '#334155' : t.fill;

  return (
    <div className={disabled ? 'opacity-45' : undefined}>
      {label || readout ? (
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-slate-400">{label}</span>
          <span className="text-[15px] font-semibold tabular-nums text-slate-100">{readout}</span>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        {leading}
        <input
          type="range"
          className="ht-range flex-1"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onInput(Number(e.target.value))}
          onPointerUp={onCommit ? () => onCommit() : undefined}
          style={{ '--ht-track': `linear-gradient(to right, ${fill} ${pct}%, #1e293b ${pct}%)` }}
        />
        {trailing}
      </div>
    </div>
  );
}

/** Square icon button sized for a thumb. */
export function IconButton({ icon: Icon, onClick, label, tone, active = false, className = '' }) {
  const t = TONES[tone || 'sage'];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`ht-tap flex h-12 w-12 items-center justify-center rounded-2xl border ${
        active ? '' : 'border-line'
      } ${className}`}
      style={
        active
          ? { background: t.soft, borderColor: t.fill }
          : { background: '#0a0d12' }
      }
    >
      <Icon size={22} color={active ? t.fill : '#94a3b8'} strokeWidth={1.9} />
    </button>
  );
}

/** Toggle in pill form: a wide, wrapping target for two-word feature names. */
export function TogglePill({ icon: Icon, label, sublabel, on, onChange, tone = 'sage' }) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`ht-tap flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-center ${
        on ? 'text-slate-50' : 'border-line text-slate-400'
      }`}
      style={on ? { background: t.soft, borderColor: t.fill } : { background: '#0a0d12' }}
    >
      <Icon size={22} color={on ? t.fill : '#64748b'} strokeWidth={1.8} />
      <span className="text-[13px] font-medium leading-tight">{label}</span>
      <span className="text-[10px] uppercase tracking-wide" style={{ color: on ? t.fill : '#475569' }}>
        {on ? 'On' : sublabel || 'Off'}
      </span>
    </button>
  );
}
