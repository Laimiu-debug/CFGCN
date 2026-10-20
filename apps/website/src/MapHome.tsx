import type { GameId, Locale } from '@cfgcn/shared';
import { useRef, useState } from 'react';
import { Button } from '@cfgcn/ui';
import { ScrollAtlas } from './ScrollAtlas';
import { atlasCopy } from './atlas-copy';
import { useAtlasRest } from './useAtlasRest';
import './atlas.css';

const order: GameId[] = ['xiyou', 'sanguo', 'shuihu', 'honglou'];
export function MapHome({
  locale,
  selected,
  onSelect,
  onEnter,
  departing,
  reducedMotion,
  onMotionChange,
}: {
  locale: Locale;
  selected: GameId;
  onSelect: (id: GameId) => void;
  onEnter: (id: GameId, direct?: boolean) => void;
  departing: boolean;
  reducedMotion: boolean;
  onMotionChange: (value: boolean) => void;
}) {
  const text = atlasCopy[locale];
  const root = useRef<HTMLElement>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [viewRequest, setViewRequest] = useState<{ id: GameId; sequence: number }>();
  const { resting, rest } = useAtlasRest(root, sceneReady && !departing);
  return (
    <section
      ref={root}
      id="worlds"
      className="atlas-live"
      aria-label={text.title}
      aria-describedby="atlas-rest-instructions"
      data-departing={departing}
      data-resting={resting}
    >
      <h1 className="sr-only">{text.title}</h1>
      <p className="sr-only" id="atlas-rest-instructions">
        {text.restHint}
      </p>
      <ScrollAtlas
        locale={locale}
        selected={selected}
        departing={departing}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
        onEnter={onEnter}
        resting={resting}
        onRest={rest}
        onAvailability={(available) => {
          setSceneReady(available);
          setSceneFailed(!available);
        }}
        viewRequest={viewRequest}
      />
      <div className="atlas-compass" aria-hidden="true" data-atlas-interface>
        <span>{text.north}</span>
        <i />
      </div>
      <p className="atlas-live-hint" aria-live="polite" data-atlas-interface aria-hidden={resting}>
        {selected === 'xiyou' ? text.playable : text.coming}
      </p>
      <div
        className="atlas-live-controls"
        role="group"
        aria-label={text.hint}
        data-atlas-interface
        inert={resting}
        aria-hidden={resting}
      >
        {order.map((id) => (
          <Button
            variant="quiet"
            key={id}
            aria-pressed={id === selected}
            onFocus={() => onSelect(id)}
            onPointerEnter={() => onSelect(id)}
            disabled={departing}
            onClick={() => {
              if (sceneFailed) {
                onEnter(id);
                return;
              }
              onSelect(id);
              setViewRequest((previous) => ({ id, sequence: (previous?.sequence ?? 0) + 1 }));
            }}
            aria-label={
              sceneFailed
                ? `${text.places[id]} · ${id === 'xiyou' ? text.enter : text.preview}`
                : `${text.visit} ${text.places[id]} · ${text.eras[id]}`
            }
          >
            {text.places[id]}
          </Button>
        ))}
      </div>
      <p className="atlas-map-note" data-atlas-interface inert={resting} aria-hidden={resting}>
        <a href="/art/atlas/credits.html" target="_blank" rel="noreferrer">
          {text.geography}
        </a>
      </p>
      <label className="atlas-motion" data-atlas-interface inert={resting} aria-hidden={resting}>
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={(event) => onMotionChange(event.target.checked)}
        />
        {text.motion}
      </label>
    </section>
  );
}
