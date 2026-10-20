import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { browserStorage, portalHref, readGameSave, writeGameSave } from '@cfgcn/shared';
import type { Locale } from '@cfgcn/shared';
import { Button, Icon } from '@cfgcn/ui';
import { copy } from './copy';
import { journeyCopy } from './journey-copy';
import { riverCopy } from './river-copy';
import { worldCopy } from './world-copy';
import { SkillArt } from './SkillArt';
import { WorldMap } from './WorldMap';
import { TouchStick } from './TouchStick';
import { ShadowTrial } from './ShadowTrial';
import { ExpeditionHud } from './ExpeditionHud';
import { SoundControl } from './SoundControl';
import { InkGlyph } from './InkUi';
import { mapRegions, readMapSave, saveMap } from './expedition-map';
import type { ExpeditionState } from './expedition-map';
import { isMapChart } from './map-exploration';
import type { MapChart } from './map-exploration';
import type { StickVector } from './touch-input';
import { isJourneyCheckpoint } from './journey';
import type { JourneyCheckpoint, JourneyState } from './journey';
import './styles.css';
import './ink-interface.css';
import './ink-shell.css';

type Phase = 'menu' | 'playing' | 'paused' | 'upgrade' | 'won' | 'lost';
type Snapshot = {
  expedition?: ExpeditionState | null;
  performance?: {
    terrain_chunks: boolean[];
    stream_waiting: boolean;
    mean_fps?: number;
    frame_p95_ms?: number;
    sampled_frames?: number;
    map_built?: number;
    map_released?: number;
    map_cells?: number;
  };
  journey: JourneyState | null;
  ready: boolean;
  hero?: { x: number; z: number };
  master?: { x: number; z: number };
  phase: Phase;
  hp: number;
  master_hp: number;
  elapsed: number;
  kills: number;
  level: number;
  xp: number;
  next_xp: number;
  progress: number;
  talents: number[];
  choices: number[];
  freeze_cd: number;
  clone_cd: number;
  boss_hp: number | null;
  boss_max_hp: number;
};
type Result = {
  at: string;
  won: boolean;
  kills: number;
  seconds: number;
  level: number;
  mode?: 'journey' | 'trial';
  chapter?: number;
};
type Journal = {
  version: 1;
  runs: number;
  wins: number;
  best: number;
  results: Result[];
  checkpoint?: JourneyCheckpoint;
};
const emptyJournal = (): Journal => ({ version: 1, runs: 0, wins: 0, best: 0, results: [] });
const initial: Snapshot = {
  journey: null,
  ready: false,
  phase: 'menu',
  hp: 100,
  master_hp: 120,
  elapsed: 0,
  kills: 0,
  level: 1,
  xp: 0,
  next_xp: 4,
  progress: 0,
  talents: Array(8).fill(0),
  choices: [],
  freeze_cd: 0,
  clone_cd: 0,
  boss_hp: null,
  boss_max_hp: 1200,
};
const count = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
function readJournal(): Journal {
  const value = readGameSave<Journal>(browserStorage(), 'xiyou')?.payload;
  if (
    !value ||
    value.version !== 1 ||
    !count(value.runs) ||
    !count(value.wins) ||
    !count(value.best) ||
    value.wins > value.runs ||
    !Array.isArray(value.results)
  )
    return emptyJournal();
  return {
    ...value,
    checkpoint: isJourneyCheckpoint(value.checkpoint) ? value.checkpoint : undefined,
    results: value.results
      .filter(
        (r) =>
          r &&
          typeof r.at === 'string' &&
          Number.isFinite(Date.parse(r.at)) &&
          typeof r.won === 'boolean' &&
          count(r.kills) &&
          count(r.level) &&
          Number.isFinite(r.seconds) &&
          r.seconds >= 0,
      )
      .slice(0, 10),
  };
}
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function World(props: Omit<Parameters<typeof LegacyWorld>[0], 'onTrial'>) {
  const [trial, setTrial] = useState(
    () => new URLSearchParams(location.search).get('mode') === 'skills',
  );
  return trial ? (
    <ShadowTrial locale={props.locale} onExit={() => setTrial(false)} />
  ) : (
    <LegacyWorld {...props} onTrial={() => setTrial(true)} />
  );
}

function LegacyWorld({
  locale,
  bookmarked,
  onBookmark,
  onLocaleChange,
  arrival,
  onTrial,
}: {
  locale: Locale;
  onTrial?: () => void;
  bookmarked: boolean;
  onBookmark: () => void;
  onLocaleChange?: (locale: Locale) => void;
  arrival?: {
    play: boolean;
    onStatus: (status: {
      ready: boolean;
      hero?: { x: number; z: number };
      master?: { x: number; z: number };
      playing: boolean;
      error: boolean;
      stage: 'download' | 'compile' | 'models';
      progress: number | null;
    }) => void;
  };
}) {
  const text = copy[locale];
  const jt = journeyCopy[locale];
  const rt = riverCopy[locale];
  const wt = worldCopy[locale];
  const frame = useRef<HTMLIFrameElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousPhase = useRef<Phase>('menu');
  const savedRecruit = useRef<string | null>(null);
  const arrivalStarted = useRef(false);
  const mapStarted = useRef(false);
  const mapRestoring = useRef<{ x: number; z: number; visited: number } | null>(null);
  const mapSavedAt = useRef(0);
  const held = useRef(new Set<string>());
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState<{
    stage: 'download' | 'compile' | 'models';
    progress: number | null;
  }>({ stage: 'download', progress: null });
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [panel, setPanel] = useState<'journal' | 'practice' | 'route' | 'party' | null>(null);
  const [journal, setJournal] = useState(readJournal);
  const [storageError, setStorageError] = useState(false);
  const [mapSaved, setMapSaved] = useState(true);
  const [mapCharts, setMapCharts] = useState<MapChart[]>([]);
  const [mapRequest, setMapRequest] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const send = useCallback((value: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage(
      { type: 'cfgcn:xiyou:input', value },
      location.origin,
    );
  }, []);
  const moveTouch = useCallback((vector: StickVector) => send(vector), [send]);
  // A second finger does not produce a click on several mobile browsers.
  // Handle touch directly, while keeping mouse and keyboard button semantics.
  const battlePress = (value: Record<string, unknown>) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.disabled) return;
      // Keep the canvas's held keyboard input when clicking battle controls.
      // Moving focus on mousedown clears Bevy's keys before the physical keyup.
      event.preventDefault();
      if (event.pointerType === 'mouse') return;
      send(value);
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (event.currentTarget.disabled) return;
      if (
        event.detail > 0 &&
        'pointerType' in event.nativeEvent &&
        event.nativeEvent.pointerType !== 'mouse'
      )
        return;
      send(value);
    },
  });
  useEffect(() => {
    send({ locale });
    const shell = document.querySelector('[data-motion]');
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () =>
      send({
        reduced_motion: shell?.getAttribute('data-motion') === 'reduced' || preference.matches,
      });
    update();
    const observer = new MutationObserver(update);
    if (shell) observer.observe(shell, { attributes: true, attributeFilter: ['data-motion'] });
    preference.addEventListener('change', update);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', update);
    };
  }, [locale, state.ready, send]);
  const direction = useCallback(() => {
    const keys = held.current;
    send({
      x:
        Number(keys.has('d') || keys.has('ArrowRight')) -
        Number(keys.has('a') || keys.has('ArrowLeft')),
      z:
        Number(keys.has('w') || keys.has('ArrowUp')) -
        Number(keys.has('s') || keys.has('ArrowDown')),
    });
  }, [send]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      const { type, value } = event.data ?? {};
      if (type === 'cfgcn:xiyou:map-toggle') setMapRequest((v) => v + 1);
      if (type === 'cfgcn:xiyou:chart' && isMapChart(value))
        setMapCharts((current) =>
          [
            ...current.filter((c) => c.x !== value.x || c.z !== value.z || c.span !== value.span),
            value,
          ].slice(-6),
        );
      if (
        type === 'cfgcn:xiyou:state' &&
        value &&
        ['menu', 'playing', 'paused', 'upgrade', 'won', 'lost'].includes(value.phase)
      )
        setState(value as Snapshot);
      if (type === 'cfgcn:xiyou:error') setError(true);
      if (
        type === 'cfgcn:xiyou:loading' &&
        value &&
        ['download', 'compile', 'models'].includes(value.stage)
      )
        setLoading(value);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  useEffect(() => {
    if (
      (state.phase === 'won' || state.phase === 'lost') &&
      previousPhase.current !== state.phase
    ) {
      setJournal((current) => {
        const next: Journal = {
          ...current,
          version: 1,
          runs: current.runs + 1,
          wins: current.wins + Number(state.phase === 'won'),
          best: Math.max(current.best, state.kills),
          results: [
            {
              at: new Date().toISOString(),
              won: state.phase === 'won',
              kills: state.kills,
              seconds: state.elapsed,
              level: state.level,
              mode: state.journey ? ('journey' as const) : ('trial' as const),
              chapter: state.journey?.chapter,
            },
            ...current.results,
          ].slice(0, 10),
          checkpoint:
            state.phase === 'won' && state.journey && isJourneyCheckpoint(state.journey.checkpoint)
              ? state.journey.checkpoint
              : current.checkpoint,
        };
        setStorageError(!writeGameSave(browserStorage(), 'xiyou', next));
        return next;
      });
    }
    previousPhase.current = state.phase;
    if (state.phase !== 'playing') {
      held.current.clear();
      send({ x: 0, z: 0 });
    }
  }, [state.phase, state.kills, state.elapsed, state.level, state.journey, send]);

  useEffect(() => {
    const j = state.journey;
    if (!j || !isJourneyCheckpoint(j.checkpoint) || (!j.world?.events && !j.reunion)) return;
    const key = JSON.stringify(j.checkpoint);
    if (savedRecruit.current === key) return;
    savedRecruit.current = key;
    setJournal((current) => {
      const next = { ...current, checkpoint: j.checkpoint };
      setStorageError(!writeGameSave(browserStorage(), 'xiyou', next));
      return next;
    });
  }, [state.journey]);

  useEffect(() => {
    if (state.phase !== 'upgrade') return;
    dialog.current
      ?.querySelector<HTMLElement>(
        state.journey?.recipient === null ? '.xiyou-companions button' : '.xiyou-choices button',
      )
      ?.focus();
  }, [state.phase, state.journey?.recipient, state.level]);

  const modal =
    error || state.expedition
      ? null
      : (panel ??
        (['paused', 'upgrade', 'won', 'lost'].includes(state.phase) ? state.phase : null));
  useEffect(() => {
    const node = dialog.current;
    if (modal && !node?.open) node?.showModal();
    if (!modal && node?.open) node.close();
    if (!modal && state.phase === 'playing') send({ focus: true });
  }, [modal, state.phase, send]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('input, select, textarea, dialog')
      )
        return;
      if (event.key === 'Escape' && state.phase === 'playing') {
        event.preventDefault();
        send({ action: 2 });
        return;
      }
      if (state.phase !== 'playing' || event.repeat) return;
      if (
        ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
      ) {
        event.preventDefault();
        held.current.add(event.key);
        direction();
      }
      if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        send({ freeze: true });
      }
      if (event.key.toLowerCase() === 'e') send({ clone: true });
      if (event.key.toLowerCase() === 'q') send({ action: 7 });
      if (['1', '2', '3'].includes(event.key)) send({ action: 10, member: Number(event.key) - 1 });
    };
    const up = (event: KeyboardEvent) => {
      if (held.current.delete(event.key)) direction();
    };
    const blur = () => {
      held.current.clear();
      send({ x: 0, z: 0 });
      if (!document.hasFocus()) send({ action: 2 });
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      held.current.clear();
    };
  }, [state.phase, send, direction]);

  const start = () => {
    setPanel(null);
    send({ action: 1, focus: true });
  };
  const startJourney = (checkpoint?: JourneyCheckpoint) => {
    savedRecruit.current = null;
    setPanel(null);
    send({ action: 5, checkpoint, focus: true });
  };
  const startMap = () => {
    const saved = readMapSave(browserStorage());
    mapStarted.current = true;
    mapRestoring.current = saved ? { ...saved.pos, visited: saved.visited } : null;
    setPanel(null);
    send({ action: 11, map_position: saved?.pos, map_visited: saved?.visited ?? 0, focus: true });
  };
  useEffect(() => {
    if (
      !state.ready ||
      (state.phase !== 'menu' && !state.expedition) ||
      mapStarted.current ||
      error ||
      new URLSearchParams(location.search).get('mode') === 'legacy' ||
      (arrival && !arrival.play)
    )
      return;
    // The map boot already restores its checkpoint before creating terrain.
    // A second start here can overwrite an early map command / restore twice.
    if (state.expedition) {
      mapStarted.current = true;
      const saved = readMapSave(browserStorage());
      mapRestoring.current = saved ? { ...saved.pos, visited: saved.visited } : null;
      send({ focus: true });
      return;
    }
    startMap();
  }, [state.ready, state.phase, state.expedition, error, send, arrival]);
  useEffect(() => {
    if (!state.expedition || !state.ready || !mapStarted.current) return;
    const pending = mapRestoring.current;
    if (pending) {
      const p = state.expedition.pos;
      const restoredFrom = state.expedition.restored_from;
      const acknowledged =
        restoredFrom && Math.hypot(restoredFrom.x - pending.x, restoredFrom.z - pending.z) < 0.01;
      if (
        (!acknowledged && Math.hypot(p.x - pending.x, p.z - pending.z) > 1) ||
        (state.expedition.visited & pending.visited) >>> 0 !== pending.visited >>> 0
      )
        return;
      mapRestoring.current = null;
    }
    if (Date.now() - mapSavedAt.current < 1000 && state.phase === 'playing') return;
    mapSavedAt.current = Date.now();
    setMapSaved(saveMap(browserStorage(), state.expedition));
  }, [state.expedition, state.phase, state.ready]);
  const restart = () => (state.journey ? startJourney(state.journey.start) : start());
  const journey = state.journey;
  const available = (member: number) =>
    member === 0 || (member === 1 ? journey?.joined : journey?.dragon_joined);
  const ranks = journey ? [journey.monk, journey.wukong, journey.dragon] : [];
  const bossName = journey ? (journey.chapter === 3 ? rt.boss : jt.boss) : text.boss;
  const routeProgress = state.phase === 'won' ? 1 : state.progress;
  const canContinue =
    journal.checkpoint && journal.checkpoint.chapter > 0 && journal.checkpoint.chapter <= 4;
  useEffect(() => {
    arrival?.onStatus({
      ready: state.ready,
      playing: state.phase === 'playing',
      error,
      stage: loading.stage,
      progress: loading.progress,
    });
  }, [arrival?.onStatus, state.ready, state.phase, error, loading.stage, loading.progress]);
  useEffect(() => {
    if (!arrival?.play || !state.ready || error || arrivalStarted.current || state.phase !== 'menu')
      return;
    arrivalStarted.current = true;
    savedRecruit.current = null;
    setPanel(null);
    const saved = readMapSave(browserStorage());
    send({ action: 11, map_position: saved?.pos, map_visited: saved?.visited ?? 0, focus: true });
  }, [arrival?.play, state.ready, state.phase, error, send]);
  useEffect(() => {
    if (!arrival && state.phase === 'playing') send({ focus: true });
  }, [arrival, state.phase, send]);
  const heading = state.expedition
    ? mapRegions[state.expedition.region].names[locale === 'en' ? 2 : locale === 'zh-TW' ? 1 : 0]
    : journey?.world
      ? wt.regions[journey.world.region]
      : journey
        ? jt.chapter[journey.chapter]
        : text.chapter;
  const eventStep = !journey?.world
    ? 0
    : journey.world.events & 16
      ? 6
      : !journey.joined
        ? 0
        : !(journey.world.events & 2)
          ? 1
          : journey.world.region < 2
            ? 2
            : !journey.dragon_defeated
              ? 3
              : !journey.dragon_joined
                ? 4
                : 5;
  useEffect(() => {
    if (state.phase !== 'playing') {
      setHintVisible(false);
      return;
    }
    setHintVisible(true);
    const timer = setTimeout(() => setHintVisible(false), 3800);
    return () => clearTimeout(timer);
  }, [heading, eventStep, state.phase, journey?.exit_open]);
  const resume = () => send({ action: 3, focus: true });
  const exportJournal = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(journal, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'xiyou-journal.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main
      id="main"
      className="xiyou-page"
      data-phase={state.phase}
      data-mode={
        state.expedition ? 'expedition' : journey || state.phase === 'menu' ? 'journey' : 'trial'
      }
      data-party-size={journey?.dragon_joined ? 3 : journey?.joined ? 2 : 1}
      data-leader={journey?.leader ?? 0}
    >
      <div className="xiyou-topline">
        <Button variant="quiet" onClick={onTrial}>
          <InkGlyph name="sword" />
          五人皮影演武
        </Button>
        <a href={portalHref(window.location.hostname, locale)}>
          <span aria-hidden="true">←</span> {text.back}
        </a>
        <span>{state.phase === 'menu' ? jt.region : heading}</span>
        <select
          aria-label={locale === 'en' ? 'Game language' : '游戏语言'}
          value={locale}
          onChange={(event) => onLocaleChange?.(event.target.value as Locale)}
        >
          <option value="zh-CN">简体中文</option>
          <option value="zh-TW">繁體中文</option>
          <option value="en">English</option>
        </select>
        <Button
          variant="quiet"
          className="xiyou-bookmark"
          onClick={onBookmark}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? text.saved : text.bookmark}
        >
          <Icon name={bookmarked ? 'check' : 'bookmark'} size={15} />
          <span className="xiyou-button-caption">{bookmarked ? text.saved : text.bookmark}</span>
        </Button>
        <SoundControl locale={locale} />
      </div>
      <section className="xiyou-stage" aria-label={jt.title}>
        <iframe
          key={revision}
          ref={frame}
          src={
            new URLSearchParams(location.search).get('mode') === 'legacy'
              ? '/games/xiyou/index.html'
              : '/games/xiyou/index.html?map=1'
          }
          title={state.expedition ? heading : jt.title}
          allow="autoplay"
        />
        <div className="xiyou-vignette" aria-hidden="true" />
        {state.phase === 'menu' && !error && (
          <div className="xiyou-entry">
            <p className="xiyou-kicker">{jt.region}</p>
            <h1>{jt.title}</h1>
            <div className="xiyou-rule" aria-hidden="true" />
            <p className="xiyou-invitation">{jt.intro}</p>
            <p className="xiyou-description">{jt.detail}</p>
            <ol className="xiyou-entry-route" aria-label={jt.map}>
              {jt.chapter.map((name, index) => (
                <li key={name} data-complete={(journal.checkpoint?.chapter ?? 0) > index}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {name}
                </li>
              ))}
            </ol>
            <Button
              variant="primary"
              className="xiyou-primary"
              onClick={startMap}
              aria-busy={!state.ready}
              disabled={!state.ready}
            >
              {locale === 'en'
                ? 'Survey the westward world'
                : locale === 'zh-TW'
                  ? '踏勘西行大地圖'
                  : '踏勘西行大地图'}
              <InkGlyph name="back" />
            </Button>
            <Button
              variant="secondary"
              className="xiyou-secondary"
              onClick={onTrial}
              aria-busy={!state.ready}
              disabled={!state.ready}
            >
              {locale === 'en'
                ? 'Five shadows · four arts'
                : locale === 'zh-TW'
                  ? '五人演武 · 自選四式'
                  : '五人演武 · 自选四式'}
              <InkGlyph name="sword" />
            </Button>
            <div className="xiyou-entry-links">
              <Button
                variant="quiet"
                onClick={() => startJourney(canContinue ? journal.checkpoint : undefined)}
              >
                {locale === 'en' ? 'Earlier journey' : locale === 'zh-TW' ? '舊章回' : '旧章回'}
              </Button>
              <Button variant="quiet" onClick={() => setPanel('route')}>
                {jt.map}
              </Button>
              <Button variant="quiet" onClick={() => setPanel('party')}>
                {jt.party}
              </Button>
              <span aria-hidden="true">·</span>
              <Button variant="quiet" onClick={() => setPanel('journal')}>
                {text.journal}
              </Button>
            </div>
            <Button
              variant="quiet"
              className="xiyou-trial-link"
              disabled={!state.ready}
              onClick={start}
            >
              {jt.trial}
            </Button>
            {journal.checkpoint?.chapter === 4 && (
              <p className="xiyou-checkpoint">{jt.regionComplete}</p>
            )}
            {canContinue && (
              <Button
                variant="quiet"
                className="xiyou-trial-link"
                disabled={!state.ready}
                onClick={() => startJourney()}
              >
                {jt.fresh}
              </Button>
            )}
            <p className="xiyou-controls-hint">{jt.controls}</p>
          </div>
        )}
        {!state.ready && !error && !state.expedition && (
          <div className="xiyou-loading" role="status" aria-live="polite">
            <span className="xiyou-seal" aria-hidden="true">
              山
            </span>
            <div>
              <strong>{text.loading}</strong>
              <p>
                {text[loading.stage]}
                {loading.progress !== null ? ` · ${Math.round(loading.progress * 100)}%` : '…'}
              </p>
              <progress max={1} value={loading.progress ?? undefined} aria-label={text.loading} />
            </div>
          </div>
        )}
        {error && (
          <div className="xiyou-error" role="alert">
            <h2>{text.error}</h2>
            <p>{text.errorHint}</p>
            <Button
              variant="primary"
              className="xiyou-primary"
              onClick={() => {
                setState(initial);
                setError(false);
                setLoading({ stage: 'download', progress: null });
                setRevision((n) => n + 1);
              }}
            >
              {text.retry}
            </Button>
          </div>
        )}
        {state.expedition && !error && (
          <ExpeditionHud
            expedition={state.expedition}
            charts={mapCharts}
            mapRequest={mapRequest}
            performance={state.performance}
            phase={state.phase}
            ready={state.ready}
            saved={mapSaved}
            locale={locale}
            send={send}
            onMove={moveTouch}
          />
        )}
        {state.phase !== 'menu' && !error && !state.expedition && (
          <>
            {storageError && journey?.world && (
              <div className="xiyou-save-warning" role="alert" title={text.storageError}>
                <Icon name="bookmark" />
                <span>
                  {locale === 'en'
                    ? 'Waymark not saved'
                    : locale === 'zh-TW'
                      ? '路標未記下'
                      : '路标未记下'}
                </span>
                <Button
                  variant="quiet"
                  aria-label={text.retry}
                  onClick={() =>
                    setStorageError(!writeGameSave(browserStorage(), 'xiyou', journal))
                  }
                >
                  <Icon name="download" />
                </Button>
              </div>
            )}
            <div className="xiyou-hud">
              <div className="xiyou-health" hidden={journey !== null}>
                {(!journey || journey.joined) && (
                  <>
                    <span>
                      {text.hero}
                      <b>{Math.ceil(state.hp)} / 100</b>
                    </span>
                    <meter aria-label={`${text.hero} ${text.hp}`} max={100} value={state.hp} />
                  </>
                )}
                <span>
                  {journey ? jt.members[0] : text.master}
                  <b>{Math.ceil(state.master_hp)} / 120</b>
                </span>
                <meter
                  className="xiyou-master"
                  aria-label={`${journey ? jt.members[0] : text.master} ${text.hp}`}
                  max={120}
                  value={state.master_hp}
                />
                {journey?.dragon_joined && (
                  <>
                    <span>
                      {jt.members[2]}
                      <b>{Math.ceil(journey.dragon_hp)} / 140</b>
                    </span>
                    <meter
                      aria-label={`${jt.members[2]} ${text.hp}`}
                      max={140}
                      value={journey.dragon_hp}
                    />
                  </>
                )}
              </div>
              <div className="xiyou-run-time">
                <strong>{clock(state.elapsed)}</strong>
                <span>
                  {text.kills} {state.kills} · {text.level} {state.level}
                </span>
              </div>
              <Button
                variant="icon"
                className="xiyou-pause"
                aria-label={text.pause}
                {...battlePress({ action: 2 })}
                disabled={state.phase !== 'playing'}
              >
                <span aria-hidden="true">Ⅱ</span>
              </Button>
            </div>
            {journey && (
              <div className="xiyou-party-control" role="group" aria-label={rt.lead}>
                {jt.members.map((name, member) => (
                  <Button
                    key={name}
                    variant="portrait"
                    aria-label={`${rt.switch} ${name}`}
                    aria-pressed={journey.leader === member}
                    disabled={!available(member) || !['playing', 'paused'].includes(state.phase)}
                    {...battlePress({ action: 10, member })}
                  >
                    <img
                      className="xiyou-member-portrait"
                      src={`/games/xiyou/assets/${['monk', 'wukong', 'white_dragon'][member]}-portrait.png`}
                      alt=""
                    />
                    <span className="xiyou-member-info">
                      <span>
                        {name}
                        <kbd>{member + 1}</kbd>
                      </span>
                      {available(member) ? (
                        <>
                          <meter
                            aria-label={`${name} ${text.hp}`}
                            max={[120, 100, 140][member]}
                            value={[state.master_hp, state.hp, journey.dragon_hp][member]}
                          />
                          <small>
                            {Math.ceil([state.master_hp, state.hp, journey.dragon_hp][member])} /{' '}
                            {[120, 100, 140][member]}
                          </small>
                        </>
                      ) : (
                        <small>{rt.locked}</small>
                      )}
                    </span>
                  </Button>
                ))}
                <p className="xiyou-control-description">{rt.ready}</p>
              </div>
            )}
            <div className="xiyou-route">
              <span>
                {journey ? heading : text.progress}
                <b>{Math.floor(routeProgress * 100)}%</b>
              </span>
              <progress
                max={1}
                value={routeProgress}
                aria-label={journey ? jt.progress : text.progress}
              />
              {journey && (
                <p
                  className="xiyou-objective"
                  role="status"
                  data-visible={hintVisible}
                  aria-hidden={!hintVisible}
                >
                  {journey.world ? (
                    <>
                      <SkillArt link skill={eventStep > 4 ? 1 : 0} />
                      <span>{wt.goals[eventStep]}</span>
                    </>
                  ) : journey.exit_open ? (
                    journey.chapter === 3 ? (
                      rt.exit
                    ) : (
                      jt.exit
                    )
                  ) : journey.chapter === 3 && !journey.dragon_joined ? (
                    journey.dragon_defeated ? (
                      rt.pledgeHint
                    ) : (
                      rt.goal
                    )
                  ) : journey.chapter === 3 ? (
                    `${rt.after} ${Math.max(0, Math.ceil(55 - journey.stage_time))} ${text.seconds} · ${rt.river}`
                  ) : journey.chapter === 2 && !journey.joined ? (
                    jt.rescueHint
                  ) : journey.chapter === 2 && state.boss_hp !== null ? (
                    jt.bossGoal
                  ) : (
                    `${jt.untilExit} ${Math.max(0, Math.ceil((journey.chapter === 0 ? 45 : 60) - journey.stage_time))} ${text.seconds}`
                  )}
                </p>
              )}
            </div>
            {journey?.world && <WorldMap state={state} locale={locale} />}
            {state.performance?.stream_waiting && (
              <div className="xiyou-streaming" role="status">
                <Icon name="leaf" />
                <progress />
                <span>
                  {locale === 'en'
                    ? 'Unfolding the road…'
                    : locale === 'zh-TW'
                      ? '正在展開前路…'
                      : '正在展开前路…'}
                </span>
              </div>
            )}
            {journey?.joined && (
              <div className="xiyou-links" title={wt.hint} aria-label={wt.resonance}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="xiyou-link-emblem"
                    data-active={journey.links.remaining > 0 && journey.links.active === i + 1}
                    data-locked={i > 0 && !journey.dragon_joined}
                    title={wt.links[i]}
                  >
                    <SkillArt link skill={i} />
                    <small>
                      {journey.links.cooldown[i] > 0 ? Math.ceil(journey.links.cooldown[i]) : '◇'}
                    </small>
                  </div>
                ))}
                <progress max={100} value={journey.links.resonance} aria-label={wt.resonance} />
                <span className="sr-only">{wt.hint}</span>
              </div>
            )}
            {state.boss_hp !== null && (
              <div className="xiyou-boss">
                <span>{bossName}</span>
                <meter max={state.boss_max_hp} value={state.boss_hp} aria-label={bossName} />
              </div>
            )}
            <TouchStick
              enabled={state.phase === 'playing'}
              label={text.touchMove}
              onMove={moveTouch}
            />
            <div className="xiyou-bottom">
              <div className="xiyou-wisdom">
                <span>
                  {journey ? jt.shared : text.wisdom} {state.xp} / {state.next_xp}
                </span>
                <progress
                  max={state.next_xp}
                  value={state.xp}
                  aria-label={journey ? jt.shared : text.wisdom}
                />
              </div>
              {journey && (
                <div className="xiyou-passive-arts" aria-label={jt.party}>
                  {[0, 3].map((skill) => (
                    <div
                      key={skill}
                      title={`${jt.skills[journey.leader][skill]} · ${jt.descriptions[journey.leader][skill]}`}
                    >
                      <SkillArt member={journey.leader} skill={skill} />
                      <small>{ranks[journey.leader][skill]}</small>
                    </div>
                  ))}
                </div>
              )}
              <div className="xiyou-spells">
                <Button
                  variant="icon"
                  aria-label={journey ? rt.primary[journey.leader] : text.freeze}
                  title={journey ? rt.primary[journey.leader] : text.freeze}
                  disabled={state.freeze_cd > 0 || state.phase !== 'playing'}
                  {...battlePress({ freeze: true })}
                >
                  <SkillArt
                    member={journey?.leader ?? 1}
                    skill={1}
                    cooldown={Math.min(0.999, state.freeze_cd / [12, 13, 8][journey?.leader ?? 1])}
                  />
                  <strong>{journey ? rt.primary[journey.leader] : text.freeze}</strong>
                  <small data-ready={state.freeze_cd <= 0}>
                    {state.freeze_cd > 0
                      ? `${Math.ceil(state.freeze_cd)} ${text.seconds}`
                      : `${text.ready} · Space`}
                  </small>
                </Button>
                <Button
                  variant="icon"
                  aria-label={journey ? rt.secondary[journey.leader] : text.clone}
                  title={journey ? rt.secondary[journey.leader] : text.clone}
                  disabled={state.clone_cd > 0 || state.phase !== 'playing'}
                  {...battlePress({ clone: true })}
                >
                  <SkillArt
                    member={journey?.leader ?? 1}
                    skill={2}
                    cooldown={Math.min(0.999, state.clone_cd / [20, 20, 18][journey?.leader ?? 1])}
                  />
                  <strong>{journey ? rt.secondary[journey.leader] : text.clone}</strong>
                  <small data-ready={state.clone_cd <= 0}>
                    {state.clone_cd > 0
                      ? `${Math.ceil(state.clone_cd)} ${text.seconds}`
                      : `${text.ready} · E`}
                  </small>
                </Button>
              </div>
            </div>
            {journey?.world?.camp_ready && !journey.rescue_ready && state.phase === 'playing' && (
              <Button
                variant="icon"
                className="xiyou-rescue"
                {...battlePress({ action: 7 })}
                aria-label={wt.camp}
                title={wt.camp}
              >
                <Icon name="leaf" /> <kbd>Q</kbd>
              </Button>
            )}
            {journey?.rescue_ready && state.phase === 'playing' && (
              <Button
                variant="icon"
                className="xiyou-rescue"
                {...battlePress({ action: 7 })}
                aria-label={journey.chapter === 3 ? rt.pledge : jt.rescue}
                title={journey.chapter === 3 ? rt.pledge : jt.rescue}
              >
                <Icon name={journey.chapter === 3 ? 'leaf' : 'book'} />
                <span className="xiyou-button-caption">
                  {journey.chapter === 3 ? rt.pledge : jt.rescue}
                </span>
                <kbd>Q</kbd>
              </Button>
            )}
          </>
        )}
      </section>
      <dialog
        className="xiyou-dialog"
        ref={dialog}
        aria-labelledby="xiyou-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          if (panel) setPanel(null);
          else if (state.phase === 'paused') resume();
        }}
      >
        {panel && (
          <Button
            variant="icon"
            className="xiyou-dialog-close"
            onClick={() => setPanel(null)}
            aria-label={text.close}
          >
            <Icon name="close" />
          </Button>
        )}
        <p className="xiyou-kicker">{journey ? heading : jt.region}</p>
        <h2 id="xiyou-dialog-title">
          {panel
            ? panel === 'route'
              ? jt.map
              : panel === 'party'
                ? jt.party
                : text[panel]
            : journey?.reunion
              ? journey.dragon_joined
                ? rt.reunion
                : jt.reunion
              : state.phase === 'paused'
                ? text.paused
                : state.phase === 'upgrade'
                  ? journey
                    ? journey.recipient === null
                      ? jt.chooseMember
                      : jt.chooseSkill
                    : text.choose
                  : state.phase === 'won'
                    ? journey
                      ? journey.chapter === 3
                        ? jt.finished
                        : jt.clear
                      : text.win
                    : text.loss}
        </h2>
        {panel === 'route' && (
          <>
            <p>{jt.mapHint}</p>
            <ol className="xiyou-route-cards">
              {jt.chapter.map((name, index) => (
                <li key={name} data-complete={(journal.checkpoint?.chapter ?? 0) > index}>
                  <span className="xiyou-talent-number">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{name}</h3>
                    <p>{jt.chapterHint[index]}</p>
                  </div>
                  {(journal.checkpoint?.chapter ?? 0) > index && <Icon name="check" size={18} />}
                </li>
              ))}
              <li className="xiyou-future">
                <span>05</span>
                <div>
                  <h3>{jt.future}</h3>
                  <p>{jt.futureParty}</p>
                </div>
              </li>
            </ol>
            <p className="xiyou-muted">{jt.culture}</p>
          </>
        )}
        {panel === 'party' && (
          <>
            {jt.members.map((member, memberIndex) => (
              <section className="xiyou-party-catalogue" key={member}>
                <h3>
                  {member} <small>{jt.roles[memberIndex]}</small>
                </h3>
                <div className="xiyou-talents">
                  {jt.skills[memberIndex].slice(0, 4).map((skill, skillIndex) => (
                    <article key={skill}>
                      <SkillArt member={memberIndex} skill={skillIndex} />
                      <h3>{skill}</h3>
                      <p>{jt.descriptions[memberIndex][skillIndex]}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            <p className="xiyou-muted">{jt.culture}</p>
          </>
        )}
        {panel === 'practice' && (
          <>
            <p>{text.practiceHint}</p>
            <div className="xiyou-talents">
              {text.talents.map((name, index) => (
                <article key={name}>
                  <span className="xiyou-talent-number">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{name}</h3>
                  <p>{text.descriptions[index]}</p>
                </article>
              ))}
            </div>
          </>
        )}
        {panel === 'journal' && (
          <>
            <div className="xiyou-record-stats">
              <span>
                {text.runs}
                <b>{journal.runs}</b>
              </span>
              <span>
                {text.victories}
                <b>{journal.wins}</b>
              </span>
              <span>
                {text.best}
                <b>{journal.best}</b>
              </span>
            </div>
            {journal.results.length ? (
              <ol className="xiyou-records">
                {journal.results.map((record, index) => (
                  <li key={`${record.at}-${index}`}>
                    <time dateTime={record.at}>
                      {new Date(record.at).toLocaleDateString(locale)}
                    </time>
                    <strong>{record.won ? text.win : text.loss}</strong>
                    {record.mode === 'journey' && <span>{jt.chapter[record.chapter ?? 0]}</span>}
                    <span>
                      {clock(record.seconds)} · {text.kills} {record.kills}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>{text.noRecords}</p>
            )}
            <p className="xiyou-muted">{jt.local}</p>
            <Button variant="secondary" className="xiyou-secondary" onClick={exportJournal}>
              {text.export}
            </Button>
          </>
        )}
        {!panel && state.phase === 'paused' && journey?.reunion && (
          <>
            <p>{journey.dragon_joined ? rt.reunionHint : jt.reunionHint}</p>
            <div className="xiyou-companions">
              {jt.members.map(
                (name, index) =>
                  available(index) && (
                    <article key={name}>
                      <span className="xiyou-spell-seal" aria-hidden="true">
                        {['僧', '猴', '龙'][index]}
                      </span>
                      <h3>{name}</h3>
                      <p>{jt.roles[index]}</p>
                    </article>
                  ),
              )}
            </div>
            {storageError && <p role="alert">{text.storageError}</p>}
            <Button variant="primary" className="xiyou-primary" onClick={resume}>
              {jt.reunionAction}
            </Button>
          </>
        )}
        {!panel && state.phase === 'paused' && !journey?.reunion && (
          <div className="xiyou-dialog-actions">
            <Button variant="primary" className="xiyou-primary" onClick={resume}>
              {text.resume}
            </Button>
            <Button variant="secondary" className="xiyou-secondary" onClick={restart}>
              {journey ? jt.restart : text.restart}
            </Button>
            {journey && (
              <Button variant="quiet" onClick={() => setPanel('party')}>
                {jt.party}
              </Button>
            )}
            <a href={portalHref(window.location.hostname, locale)}>{text.home}</a>
          </div>
        )}
        {!panel && state.phase === 'upgrade' && (
          <>
            <p>{journey ? jt.chooseHint : text.chooseHint}</p>
            {journey && journey.recipient === null && (
              <div className="xiyou-companions">
                {jt.members.map(
                  (member, index) =>
                    available(index) && (
                      <Button
                        key={member}
                        variant="choice"
                        onClick={() => send({ action: 8, member: index })}
                      >
                        <img
                          className="xiyou-upgrade-portrait"
                          src={`/games/xiyou/assets/${['monk', 'wukong', 'white_dragon'][index]}-portrait.png`}
                          alt=""
                        />
                        <h3>{member}</h3>
                        <p>{jt.roles[index]}</p>
                        <small>
                          {ranks[index].reduce((sum, n) => sum + n, 0)} {text.level}
                        </small>
                      </Button>
                    ),
                )}
              </div>
            )}
            {journey?.joined && journey.recipient !== null && (
              <Button variant="quiet" onClick={() => send({ action: 9 })}>
                {jt.changeMember}
              </Button>
            )}
            {(!journey || journey.recipient !== null) && (
              <div className="xiyou-choices">
                {state.choices.map((talent, index) => (
                  <Button
                    variant="choice"
                    key={`${index}-${talent}`}
                    onClick={() => send({ action: 4, choice: index, focus: true })}
                  >
                    <SkillArt member={journey?.recipient ?? 0} skill={talent} />
                    <h3>
                      {journey ? jt.skills[journey.recipient ?? 0][talent] : text.talents[talent]}
                    </h3>
                    <p>
                      {journey
                        ? jt.descriptions[journey.recipient ?? 0][talent]
                        : text.descriptions[talent]}
                    </p>
                    <small>
                      {journey && <>{jt.members[journey.recipient ?? 0]} · </>}
                      {talent === 4 && journey
                        ? text.ready
                        : `Lv. ${((journey ? ranks[journey.recipient ?? 0][talent] : state.talents[talent]) ?? 0) + 1}`}
                    </small>
                  </Button>
                ))}
              </div>
            )}
          </>
        )}
        {!panel && (state.phase === 'won' || state.phase === 'lost') && (
          <>
            <p>
              {journey
                ? state.phase === 'lost'
                  ? jt.lossHint
                  : journey.chapter === 3
                    ? jt.finishedHint
                    : jt.clearHint
                : state.phase === 'won'
                  ? text.winHint
                  : text.lossHint}
            </p>
            <div className="xiyou-record-stats">
              <span>
                {text.kills}
                <b>{state.kills}</b>
              </span>
              <span>
                {text.level}
                <b>{state.level}</b>
              </span>
              <span>
                {journey ? jt.progress : text.progress}
                <b>{Math.floor(routeProgress * 100)}%</b>
              </span>
            </div>
            {storageError && <p role="alert">{text.storageError}</p>}
            {journey && state.phase === 'won' && !storageError && (
              <p role="status">{jt.checkpoint}</p>
            )}
            <p className="xiyou-muted">{journey ? jt.local : text.local}</p>
            <div className="xiyou-dialog-actions">
              {journey && state.phase === 'won' && journey.chapter < 3 ? (
                <Button
                  variant="primary"
                  className="xiyou-primary"
                  onClick={() => send({ action: 6, focus: true })}
                >
                  {jt.next}
                </Button>
              ) : journey && state.phase === 'won' ? (
                <Button
                  variant="primary"
                  className="xiyou-primary"
                  onClick={() => setPanel('route')}
                >
                  {jt.map}
                </Button>
              ) : (
                <Button variant="primary" className="xiyou-primary" onClick={restart}>
                  {journey ? jt.restart : text.restart}
                </Button>
              )}
              <a href={portalHref(window.location.hostname, locale)}>{text.home}</a>
            </div>
          </>
        )}
      </dialog>
    </main>
  );
}
