// Lets the Home screen report where its own logo actually renders on screen
// (measured in window coordinates), so the root (app) layout's splash-to-Home
// transition can animate the splash logo shrinking into that exact spot
// instead of guessing fixed coordinates. Mirrors the home-readiness store.
export type LogoRect = { x: number; y: number; width: number; height: number };

type Listener = () => void;

let rect: LogoRect | null = null;
const listeners = new Set<Listener>();

export const homeLogoPosition = {
  getSnapshot(): LogoRect | null {
    return rect;
  },
  setRect(value: LogoRect) {
    rect = value;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
