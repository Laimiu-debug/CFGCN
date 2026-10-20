import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createAtlasRest } from './atlas-rest';

export function useAtlasRest(root: RefObject<HTMLElement | null>, enabled: boolean) {
  const [resting, setResting] = useState(false);
  const controller = useRef<ReturnType<typeof createAtlasRest> | null>(null);
  useEffect(() => {
    const element = root.current!;
    const header = document.querySelector<HTMLElement>('.site-header');
    const previousInert = header?.inert ?? false;
    const previousAriaHidden = header?.getAttribute('aria-hidden') ?? null;
    let quiet = false;
    let swallowClick = false;
    let pointerX: number | undefined;
    let pointerY: number | undefined;
    const activePointers = new Set<number>();
    const change = (value: boolean) => {
      quiet = value;
      if (value && document.activeElement instanceof HTMLElement) document.activeElement.blur();
      // Apply immediately before Tab's default focus action, then reconcile React.
      element.dataset.resting = String(value);
      if (header) {
        header.inert = value || previousInert;
        header.setAttribute('aria-hidden', String(value || previousAriaHidden === 'true'));
      }
      setResting(value);
    };
    change(false);
    const rest = createAtlasRest(change, () => {
      const focus = document.activeElement;
      return (
        !document.hidden &&
        activePointers.size === 0 &&
        !element.querySelector('.living-fallback') &&
        !document.querySelector('dialog[open], [aria-modal="true"]') &&
        !(
          focus instanceof HTMLElement &&
          focus.matches(
            'button:focus-visible, input:focus-visible, select:focus-visible, a:focus-visible',
          )
        )
      );
    });
    controller.current = rest;
    const activity = () => rest.activity();
    const move = (event: PointerEvent) => {
      if (
        pointerX === undefined ||
        Math.hypot(event.clientX - pointerX, event.clientY - pointerY!) > 2
      ) {
        pointerX = event.clientX;
        pointerY = event.clientY;
        rest.activity();
      }
    };
    const down = (event: PointerEvent) => {
      activePointers.add(event.pointerId);
      const waking = rest.shouldConsumePointer() || (swallowClick && !event.isPrimary);
      swallowClick = waking;
      if (waking) {
        // The first tap wakes the interface, without entering a hidden town.
        event.preventDefault();
        event.stopPropagation();
      }
      rest.activity();
    };
    const release = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      rest.activity();
    };
    const blur = () => activePointers.clear();
    const click = (event: MouseEvent) => {
      if (swallowClick) {
        event.preventDefault();
        event.stopPropagation();
        swallowClick = false;
      }
    };
    const key = (event: KeyboardEvent) => {
      if (quiet && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        event.stopPropagation();
      }
      rest.activity();
    };
    const visibility = () => {
      activePointers.clear();
      rest.setEnabled(enabled && !document.hidden);
    };
    rest.setEnabled(enabled && !document.hidden);
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('wheel', activity, { passive: true });
    document.addEventListener('focusin', activity);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    return () => {
      rest.dispose();
      controller.current = null;
      if (header) {
        header.inert = previousInert;
        if (previousAriaHidden === null) header.removeAttribute('aria-hidden');
        else header.setAttribute('aria-hidden', previousAriaHidden);
      }
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', release, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('wheel', activity);
      document.removeEventListener('focusin', activity);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
    };
  }, [root, enabled]);
  return { resting, rest: () => controller.current?.rest() };
}
