import React, { useState } from 'react';
import { api } from './api.js';
import { useHubState } from './useHubState.js';
import ActivityDrawer from './components/ActivityDrawer.jsx';
import AudioColumn from './components/AudioColumn.jsx';
import LightingColumn from './components/LightingColumn.jsx';
import MacroBar from './components/MacroBar.jsx';
import Rail from './components/Rail.jsx';
import RemoteModal from './components/RemoteModal.jsx';
import TopBar from './components/TopBar.jsx';
import VideoColumn from './components/VideoColumn.jsx';

const SOURCE_LABELS = { appletv: 'Apple TV', shield: 'NVIDIA Shield' };

export default function App() {
  const { state, bridges, error, busy, send, patch, reload } = useHubState();
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const runMacro = (name) => send(null, () => api.macro(name));

  return (
    <div className="flex h-full w-full overflow-hidden bg-ink">
      <Rail
        online={!error}
        activityOpen={activityOpen}
        onRemote={() => setRemoteOpen(true)}
        onActivity={() => setActivityOpen((v) => !v)}
        onRefresh={() => reload()}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar state={state} bridges={bridges} error={error} />

        {state ? (
          <main className="grid min-h-0 flex-1 grid-cols-3 gap-3 px-4">
            <VideoColumn
              state={state}
              send={send}
              api={api}
              onOpenRemote={() => setRemoteOpen(true)}
            />
            <AudioColumn state={state} send={send} patch={patch} api={api} />
            <LightingColumn state={state} send={send} patch={patch} api={api} />
          </main>
        ) : (
          <main className="flex min-h-0 flex-1 items-center justify-center px-4">
            <div className="text-[15px] text-slate-500">
              {error ? `Hub unreachable — ${error}` : 'Connecting to hub…'}
            </div>
          </main>
        )}

        <MacroBar onRun={runMacro} running={busy} lastMacro={state?.lastMacro} />
      </div>

      <RemoteModal
        open={remoteOpen}
        target={SOURCE_LABELS[state?.source] || 'the active source'}
        onClose={() => setRemoteOpen(false)}
        onKey={(key) => send(null, () => api.remote(key), { applyResponse: false })}
      />

      <ActivityDrawer open={activityOpen} onClose={() => setActivityOpen(false)} />
    </div>
  );
}
