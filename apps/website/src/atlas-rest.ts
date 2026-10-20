const REST_DELAY = 8000;

// Loading, keyboard work and open dialogs must never disappear into scenery.
export function createAtlasRest(onChange: (resting: boolean) => void, canRest = () => true) {
  let enabled = false;
  let resting = false;
  let wakeUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const change = (value: boolean) => {
    if (resting === value) return;
    if (resting && !value) wakeUntil = Date.now() + 800;
    resting = value;
    onChange(value);
  };
  const schedule = () => {
    clearTimeout(timer);
    if (!enabled) return;
    timer = setTimeout(() => {
      if (canRest()) change(true);
      else schedule();
    }, REST_DELAY);
  };
  return {
    setEnabled(value: boolean) {
      enabled = value;
      change(false);
      schedule();
    },
    activity() {
      change(false);
      schedule();
    },
    // A mouse move can wake the UI immediately before the down event of the same
    // gesture. Keep hidden targets unavailable while the controls fade back in.
    shouldConsumePointer() {
      return resting || Date.now() < wakeUntil;
    },
    rest() {
      if (!enabled) return;
      clearTimeout(timer);
      change(true);
    },
    dispose() {
      enabled = false;
      clearTimeout(timer);
    },
  };
}
