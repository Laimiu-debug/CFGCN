import { useCallback, useEffect, useState } from 'react';

const key = 'cfgcn:website-motion:v1';
export function useMotionPreference(legacyReduced: boolean) {
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [choice, setChoice] = useState<boolean | null>(() => {
    const incoming = new URLSearchParams(location.search).get('motion');
    if (incoming === 'reduce' || incoming === 'full') return incoming === 'reduce';
    try {
      const value = localStorage.getItem(key);
      return value === 'reduce' ? true : value === 'full' ? false : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setSystemReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const choose = useCallback((reduced: boolean) => {
    setChoice(reduced);
    try {
      localStorage.setItem(key, reduced ? 'reduce' : 'full');
    } catch {
      // The current tab still honors the choice when storage is unavailable.
    }
  }, []);
  return [choice ?? (legacyReduced || systemReduced), choose] as const;
}
