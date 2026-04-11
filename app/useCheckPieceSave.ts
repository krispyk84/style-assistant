import { useState } from 'react';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCheckPieceSave() {
  const [closetModalVisible, setClosetModalVisible] = useState(false);

  return {
    closetModalVisible,
    openClosetModal: () => setClosetModalVisible(true),
    closeClosetModal: () => setClosetModalVisible(false),
  };
}
