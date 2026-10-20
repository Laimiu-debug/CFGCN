import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@cfgcn/shared';
import { Button, Icon } from '@cfgcn/ui';
import { atlasCopy } from './atlas-copy';
import { ScrollAtlas } from './ScrollAtlas';
import './entrance.css';
import type { ArrivalStatus } from './arrival-state';

export function ChanganEntrance({
  locale,
  reducedMotion,
  direct,
  status,
  onStart,
  onComplete,
  onReturn,
  onRetry,
  onLoadGame,
}: {
  locale: Locale;
  reducedMotion: boolean;
  direct: boolean;
  status: ArrivalStatus;
  onStart: () => void;
  onComplete: () => void;
  onReturn: () => void;
  onRetry: () => void;
  onLoadGame: () => void;
}) {
  const text = atlasCopy[locale];
  const [finished, setFinished] = useState(direct || reducedMotion);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, []);
  useEffect(() => {
    if (reducedMotion) setFinished(true);
  }, [reducedMotion]);
  useEffect(() => () => clearTimeout(loadTimer.current), []);
  useEffect(() => {
    if (finished && status.ready && !status.error && !started.current) {
      started.current = true;
      onStart();
    }
  }, [finished, status.ready, status.error, onStart]);
  useEffect(() => {
    if (!status.playing) return;
    setLeaving(true);
    const timer = setTimeout(onComplete, reducedMotion ? 0 : 420);
    return () => clearTimeout(timer);
  }, [status.playing, onComplete, reducedMotion]);
  return (
    <div
      className="changan-entrance"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entrance-title"
      data-finished={finished}
      data-leaving={leaving}
      data-reduced={reducedMotion || direct}
      ref={root}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onReturn();
        }
        if (event.key !== 'Tab') return;
        const buttons = Array.from(
          root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
        );
        const first = buttons[0],
          last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <ScrollAtlas
        locale={locale}
        reducedMotion={reducedMotion || direct || finished}
        mode="arrival"
        onReady={() => {
          loadTimer.current = setTimeout(onLoadGame, 250);
        }}
        onArrivalComplete={() => setFinished(true)}
      />
      <div className="entrance-shade" aria-hidden="true" />
      <div className="entrance-top">
        <Button variant="secondary" onClick={onReturn}>
          <span aria-hidden="true">←</span> {text.return}
        </Button>
        <Button variant="secondary" onClick={() => setFinished(true)} disabled={finished}>
          {text.skip}
          <Icon name="arrow" size={16} />
        </Button>
      </div>
      <div className="entrance-story">
        <p className="eyebrow">{text.entryEyebrow}</p>
        <h1 id="entrance-title">{text.entryTitle}</h1>
        <p>{text.entryLine}</p>
      </div>
      <div className="entrance-loading" role={status.error ? 'alert' : 'status'} aria-live="polite">
        {status.error ? (
          <>
            <strong>{text.failure}</strong>
            <p>{text.failureHint}</p>
            <Button
              variant="primary"
              className="button"
              onClick={() => {
                started.current = false;
                onRetry();
              }}
            >
              {text.retry}
            </Button>
          </>
        ) : (
          <>
            <strong>{status.ready ? text.ready : text.loading}</strong>
            <p>
              {status.ready ? text.entryLine : text[status.stage]}
              {!status.ready && status.progress !== null
                ? ` · ${Math.round(status.progress * 100)}%`
                : ''}
            </p>
            <progress
              aria-label={text.loading}
              max={1}
              value={status.ready ? 1 : (status.progress ?? undefined)}
            />
          </>
        )}
      </div>
    </div>
  );
}
