import { useCallback, useEffect, useState } from 'react';
import { browserStorage, detectLocale, readTraveler, writeTraveler } from '@cfgcn/shared';
import type { GameId, Traveler } from '@cfgcn/shared';

export function useTraveler() {
  const [traveler, setTraveler] = useState(() =>
    readTraveler(browserStorage(), detectLocale(navigator.languages)),
  );
  const [persisted, setPersisted] = useState(true);
  useEffect(() => {
    setPersisted(writeTraveler(browserStorage(), traveler));
  }, [traveler]);
  const update = useCallback(
    (patch: Partial<Pick<Traveler, 'name' | 'locale' | 'reducedMotion'>>) =>
      setTraveler((previous) => ({ ...previous, ...patch })),
    [],
  );
  const bookmark = useCallback(
    (id: GameId) =>
      setTraveler((previous) => ({
        ...previous,
        bookmarks: previous.bookmarks.includes(id)
          ? previous.bookmarks.filter((game) => game !== id)
          : [...previous.bookmarks, id],
      })),
    [],
  );
  const visit = useCallback(
    (id: GameId) =>
      setTraveler((previous) =>
        previous.visited.includes(id)
          ? previous
          : { ...previous, visited: [...previous.visited, id] },
      ),
    [],
  );
  return { traveler, persisted, update, bookmark, visit };
}
