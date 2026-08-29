// Lets the root (app) layout keep the splash overlay up until the Home
// screen's own async work (hero + closet image carousels, weather) has
// actually settled, instead of hiding it the instant session hydration
// finishes and leaving Home to visibly pop pieces into place underneath.
// Home mounts and starts loading immediately either way — this only
// controls how long the splash visually covers that work.
type Listener = () => void;

let ready = false;
const listeners = new Set<Listener>();

export const homeReadiness = {
  getSnapshot(): boolean {
    return ready;
  },
  setReady(value: boolean) {
    if (ready === value) return;
    ready = value;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
