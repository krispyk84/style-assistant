// Lets Home's own header logo know when the root layout's splash-to-Home
// shrink-transition overlay is animating on top of it, so it can stay
// invisible until the overlay finishes — otherwise both logos are visible
// on screen at once for the whole ~900ms transition (the overlay animating
// in from the splash position while Home's own static logo already sits at
// its final position underneath).
type Listener = () => void;

let active = false;
const listeners = new Set<Listener>();

export const splashShrinkOverlay = {
  getSnapshot(): boolean {
    return active;
  },
  setActive(value: boolean) {
    if (active === value) return;
    active = value;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
