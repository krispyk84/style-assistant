import * as Haptics from 'expo-haptics';

// A small, named vocabulary of haptic "flavors" — distinct enough per
// gesture that the thumb can tell them apart without looking at the screen
// (a swipe-like feels different from a swipe-discard; a thumbs up feels
// different from a delete). Fire-and-forget everywhere: haptics are cosmetic
// polish, never something a flow should wait on or fail over.

function fire(promise: Promise<unknown>) {
  void promise.catch(() => undefined);
}

/** Haircut deck / any swipe-right "keep, like, favourite" gesture. */
export function hapticSwipeLike() {
  fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Haircut deck / any swipe-left "discard, skip, pass" gesture. */
export function hapticSwipeDiscard() {
  fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Setting a thumbs-up bias (trend/colour feedback). */
export function hapticThumbsUp() {
  fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Setting a thumbs-down bias — distinct from thumbs-up, not alarming. */
export function hapticThumbsDown() {
  fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Clearing an already-set thumb back to neutral. */
export function hapticThumbsClear() {
  fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** A save/confirm action completing successfully. */
export function hapticSaveSuccess() {
  fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** A destructive action (delete, remove, unsave) taking effect. */
export function hapticDelete() {
  fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Tapping Undo to reverse a pending destructive action. */
export function hapticUndo() {
  fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
