import { useCallback, useRef } from 'react';

import { useToast } from '@/components/ui/toast-provider';

const UNDO_WINDOW_MS = 4000;

type PerformRemoveOptions = {
  /** Toast message shown while the undo window is open. */
  message: string;
  /** Removes the item from local state immediately — called synchronously,
   * before the toast even shows, so the UI reacts instantly. */
  optimisticRemove: () => void;
  /** The real deletion (network call, AsyncStorage write, etc.) — only runs
   * once the undo window closes without the user tapping Undo. Return value
   * is ignored, so any existing delete function can be passed as-is. */
  commitDelete: () => unknown;
  /** Puts the item back into local state — called only if Undo is tapped. */
  restore: () => void;
};

/**
 * Shared "optimistic delete with an Undo toast" pattern — the item leaves
 * the UI immediately, but the actual delete is delayed by UNDO_WINDOW_MS so
 * tapping Undo can cancel it before it ever touches storage/network. This
 * mirrors how Gmail's undo-send works: the destructive action is queued,
 * not executed, until the window closes.
 */
export function useUndoableRemove() {
  const { showToast } = useToast();
  const pendingRef = useRef<{ timer: ReturnType<typeof setTimeout>; commit: () => void } | null>(null);

  // If another delete starts while an earlier one is still pending undo,
  // commit the earlier one immediately rather than letting two overlap —
  // simpler to reason about, and avoids a stale commit racing a newer state.
  const flushPending = useCallback(() => {
    if (!pendingRef.current) return;
    clearTimeout(pendingRef.current.timer);
    pendingRef.current.commit();
    pendingRef.current = null;
  }, []);

  const performRemove = useCallback(
    (options: PerformRemoveOptions) => {
      flushPending();
      options.optimisticRemove();

      const commit = () => {
        pendingRef.current = null;
        void options.commitDelete();
      };
      const timer = setTimeout(commit, UNDO_WINDOW_MS);
      pendingRef.current = { timer, commit };

      showToast(options.message, 'success', {
        label: 'Undo',
        onPress: () => {
          if (pendingRef.current) {
            clearTimeout(pendingRef.current.timer);
            pendingRef.current = null;
          }
          options.restore();
        },
      });
    },
    [flushPending, showToast],
  );

  return { performRemove, flushPending };
}
