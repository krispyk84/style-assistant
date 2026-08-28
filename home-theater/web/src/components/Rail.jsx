import React from 'react';
import { Activity, Clapperboard, Home, Joystick, RefreshCw } from 'lucide-react';

function RailButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`ht-tap flex h-[52px] w-[52px] items-center justify-center rounded-2xl border ${
        active ? 'border-ht-sage' : 'border-transparent'
      }`}
      style={{ background: active ? 'rgba(147,180,139,0.16)' : 'transparent' }}
    >
      <Icon size={23} color={active ? '#93b48b' : '#64748b'} strokeWidth={1.9} />
    </button>
  );
}

/** Left rail. Every item here does something — no decorative nav. */
export default function Rail({ onRemote, onActivity, onRefresh, activityOpen, online }) {
  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center border-r border-line bg-card py-4">
      <div className="mb-5 flex h-[46px] w-[46px] items-center justify-center rounded-2xl border border-line bg-raised">
        <Clapperboard size={24} color="#93b48b" strokeWidth={1.8} />
      </div>

      <div className="flex flex-1 flex-col items-center gap-2">
        <RailButton icon={Home} label="Dashboard" active onClick={() => {}} />
        <RailButton icon={Joystick} label="Remote" onClick={onRemote} />
        <RailButton icon={Activity} label="Hub activity" active={activityOpen} onClick={onActivity} />
        <RailButton icon={RefreshCw} label="Refresh state" onClick={onRefresh} />
      </div>

      <span
        className="mb-1 h-2.5 w-2.5 rounded-full"
        title={online ? 'Hub online' : 'Hub unreachable'}
        style={{ background: online ? '#93b48b' : '#ef4444' }}
      />
    </div>
  );
}
