// Motion follows visible wall time, including on a slow renderer. The arrival
// starts at its first ready frame so loading cannot consume the introduction.
export function createAtlasClock() {
  let previous: number | undefined;
  let environment = 0;
  let scene = 0;
  let painted = false;
  return {
    reset() {
      previous = undefined;
    },
    advance(now: number, reduced: boolean, ready: boolean) {
      const elapsed = previous === undefined ? 0 : Math.max(0, now - previous) / 1000;
      previous = now;
      if (!reduced) environment += elapsed;
      if (ready) {
        if (painted) scene += elapsed;
        painted = true;
      }
      return { environment, scene };
    },
  };
}
