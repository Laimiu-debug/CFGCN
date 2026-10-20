import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import {
  gameHref, isGameId, parseSiteRoute, portalHref,
  audioToggleEvent, getAudioStatus, publishAudioStatus,
} from '@cfgcn/shared';
import type { GameId, Locale, Traveler } from '@cfgcn/shared';
import { Button, Icon } from '@cfgcn/ui';
import { world as xiyou } from '@cfgcn/xiyou/world';
import { world as shuihu } from '@cfgcn/shuihu/world';
import { world as sanguo } from '@cfgcn/sanguo/world';
import { world as honglou } from '@cfgcn/honglou/world';
import { copy } from './copy';
import { useTraveler } from './useTraveler';
import { useMotionPreference } from './useMotionPreference';
import { initialArrival } from './arrival-state';
import type { ArrivalStatus } from './arrival-state';

const FineInkStudy = lazy(() =>
  import('./fine-ink-home/FineInkStudy').then((page) => ({ default: page.FineInkStudy })),
);
const ChanganEntrance = lazy(() =>
  import('./ChanganEntrance').then((page) => ({ default: page.ChanganEntrance })),
);

const worlds = [xiyou, shuihu, sanguo, honglou];
const loadXiyou = () => import('@cfgcn/xiyou');
const worldPages = {
  xiyou: lazy(loadXiyou),
  shuihu: lazy(() => import('@cfgcn/shuihu')),
  sanguo: lazy(() => import('@cfgcn/sanguo')),
  honglou: lazy(() => import('@cfgcn/honglou')),
};
const parseRoute = () => parseSiteRoute(window.location.hash, window.location.hostname);
const homeHref = (locale: Locale) => portalHref(window.location.hostname, locale);
const worldHref = (id: GameId, locale: Locale) => gameHref(id, window.location.hostname, locale);

class PageBoundary extends Component<
  { children: ReactNode; locale: Locale; onFailure?: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('World preview failed', error.message, info.componentStack);
    this.props.onFailure?.();
  }
  render() {
    const text = copy[this.props.locale];
    return this.state.failed ? (
      <main id="main" className="empty-page">
        <Icon name="book" size={32} />
        <h1>{text.failure}</h1>
        <Button
          variant="primary"
          className="button primary"
          onClick={() => window.location.reload()}
        >
          {text.retry}
        </Button>
      </main>
    ) : (
      this.props.children
    );
  }
}

function Journal({
  traveler,
  persisted,
  onClose,
  onUpdate,
  onBookmark,
  notify,
}: {
  traveler: Traveler;
  persisted: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<Pick<Traveler, 'name' | 'locale' | 'reducedMotion'>>) => void;
  onBookmark: (id: GameId) => void;
  notify: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(traveler.name);
  const text = copy[traveler.locale];
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  function exportJournal() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(traveler, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'four-classics-journal.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <dialog
      ref={ref}
      className="journal-dialog"
      aria-labelledby="journal-heading"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="journal-sheet">
        <Button
          variant="icon"
          className="icon-button journal-close"
          aria-label={text.close}
          onClick={onClose}
        >
          <Icon name="close" />
        </Button>
        <span className="journal-mark" aria-hidden="true">
          <Icon name="book" size={31} />
        </span>
        <p className="eyebrow">{text.journalEyebrow}</p>
        <h2 id="journal-heading">{text.journalHeading}</h2>
        <p className="journal-intro">{text.journalIntro}</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onUpdate({ name: name.trim().slice(0, 24) });
            notify(text.nameSaved);
          }}
        >
          <label htmlFor="traveler-name">{text.nameLabel}</label>
          <div className="name-field">
            <input
              id="traveler-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={24}
              placeholder={text.namePlaceholder}
              autoComplete="off"
            />
            <Button variant="quiet" type="submit" aria-label={text.saveName}>
              <Icon name="arrow" size={20} />
            </Button>
          </div>
        </form>
        <section className="journal-bookmarks">
          <h3>
            {text.savedWorlds}
            <span>{traveler.bookmarks.length.toString().padStart(2, '0')}</span>
          </h3>
          {traveler.bookmarks.length ? (
            <ul>
              {worlds
                .filter((world) => traveler.bookmarks.includes(world.id))
                .map((world) => (
                  <li key={world.id}>
                    <a href={worldHref(world.id, traveler.locale)} onClick={onClose}>
                      <img src={world.image.replace('.webp', '-card.webp')} alt="" />
                      <span>
                        {world.title[traveler.locale]}
                        <small>{world.genre[traveler.locale]}</small>
                      </span>
                    </a>
                    <Button
                      variant="icon"
                      className="icon-button"
                      onClick={() => onBookmark(world.id)}
                      aria-label={`${text.unsave} · ${world.title[traveler.locale]}`}
                    >
                      <Icon name="close" size={16} />
                    </Button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="journal-empty">{text.emptyBookmarks}</p>
          )}
        </section>
        <label className="motion-setting">
          <span>
            {text.reduceMotion}
            <small>{text.reduceMotionHint}</small>
          </span>
          <input
            type="checkbox"
            checked={traveler.reducedMotion}
            onChange={(event) => onUpdate({ reducedMotion: event.target.checked })}
          />
          <span className="switch" aria-hidden="true" />
        </label>
        <Button variant="quiet" className="journal-export" onClick={exportJournal}>
          <Icon name="download" size={16} />
          {text.download}
        </Button>
        <p className={`local-note ${!persisted ? 'storage-warning' : ''}`}>
          {persisted ? text.localNote : text.storageWarning}
        </p>
      </div>
    </dialog>
  );
}

export function App() {
  const { traveler, persisted, update, bookmark, visit } = useTraveler();
  const locale = traveler.locale;
  const text = copy[locale];
  const [route, setRoute] = useState(parseRoute);
  const [journal, setJournal] = useState(false);
  const [toast, setToast] = useState('');
  const [sound, setSound] = useState(false);
  const [soundBusy, setSoundBusy] = useState(false);
  const [departing, setDeparting] = useState(false);
  const [arrival, setArrival] = useState(
    () =>
      parseRoute() === 'xiyou' && new URLSearchParams(location.search).get('arrival') === 'changan',
  );
  const [arrivalDirect, setArrivalDirect] = useState(
    () => new URLSearchParams(location.search).get('intro') === 'skip',
  );
  const [arrivalPlay, setArrivalPlay] = useState(false);
  const [arrivalRuntime, setArrivalRuntime] = useState(false);
  const [arrivalStatus, setArrivalStatus] = useState<ArrivalStatus>(initialArrival);
  const [arrivalRevision, setArrivalRevision] = useState(0);
  const departureTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopSound = useRef<(() => Promise<void>) | null>(null);
  const audioRequest = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [motionReduced, chooseMotion] = useMotionPreference(traveler.reducedMotion);
  const reducedMotion = motionReduced;
  const updatePreferences = (
    patch: Partial<Pick<Traveler, 'name' | 'locale' | 'reducedMotion'>>,
  ) => {
    if (patch.reducedMotion !== undefined) {
      chooseMotion(patch.reducedMotion);
      const url = new URL(location.href);
      url.searchParams.delete('motion');
      history.replaceState(null, '', url);
    }
    update(patch);
  };
  const reportArrival = useCallback((status: ArrivalStatus) => setArrivalStatus(status), []);
  const startArrival = useCallback(() => setArrivalPlay(true), []);
  const loadArrivalRuntime = useCallback(() => setArrivalRuntime(true), []);
  const completeArrival = useCallback(() => {
    setArrival(false);
    const url = new URL(location.href);
    for (const name of ['arrival', 'intro', 'motion']) url.searchParams.delete(name);
    history.replaceState(null, '', url);
  }, []);
  const notify = useCallback((message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);
  useEffect(() => {
    const change = () => setRoute(parseRoute());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = text.pageTitle;
  }, [locale, text.pageTitle]);
  useEffect(() => {
    if (route !== 'xiyou') return;
    let active = true;
    let dispose: (() => void) | undefined;
    void import('./GameHomeReturn').then((module) => {
      if (active) dispose = module.installGameHomeReturn();
    });
    return () => {
      active = false;
      dispose?.();
    };
  }, [route]);
  useEffect(() => {
    const incoming = new URLSearchParams(location.search).get('motion');
    if (incoming === 'reduce' || incoming === 'full') {
      chooseMotion(incoming === 'reduce');
      update({ reducedMotion: incoming === 'reduce' });
    }
  }, [update, chooseMotion]);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (route === 'home') {
      clearTimeout(departureTimer.current);
      setDeparting(false);
      setArrival(false);
      setArrivalPlay(false);
    }
    if (isGameId(route)) visit(route);
    if (route === 'home' && ['#worlds', '#our-story'].includes(location.hash))
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [route, visit]);
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(departureTimer.current);
      audioRequest.current++;
      void stopSound.current?.();
      publishAudioStatus({ enabled: false, busy: false });
    },
    [],
  );

  const toggleBookmark = (id: GameId) => {
    notify(traveler.bookmarks.includes(id) ? text.removed : text.added);
    bookmark(id);
  };
  const enterFromMap = (id: GameId, direct = false) => {
    if (departing) return;
    const href = worldHref(id, locale);
    if (id !== 'xiyou') {
      window.location.assign(href);
      return;
    }
    if (href.startsWith('#')) void loadXiyou().catch(() => {});
    setArrivalDirect(direct);
    setDeparting(true);
    departureTimer.current = setTimeout(
      () => {
        if (href.startsWith('#')) {
          setArrivalStatus(initialArrival);
          setArrivalPlay(false);
          setArrivalRuntime(false);
          setArrival(true);
          window.location.hash = '/world/xiyou';
        } else {
          const url = new URL(href);
          url.searchParams.set('arrival', 'changan');
          if (direct) url.searchParams.set('intro', 'skip');
          url.searchParams.set('motion', reducedMotion ? 'reduce' : 'full');
          window.location.assign(url);
        }
      },
      reducedMotion || direct ? 0 : 1050,
    );
  };
  const scrollTo = (id: string) => {
    if (homeHref(locale) !== '#/') {
      window.location.assign(`${homeHref(locale)}#${id}`);
      return;
    }
    const scroll = () =>
      document.getElementById(id)?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    if (route !== 'home') {
      window.location.hash = '/';
      setTimeout(scroll, 100);
    } else scroll();
  };
  const toggleSound = useCallback(async () => {
    if (getAudioStatus().busy) return;
    setSoundBusy(true);
    publishAudioStatus({ enabled: !!stopSound.current, busy: true });
    const request = ++audioRequest.current;
    let context: AudioContext | undefined;
    try {
      if (stopSound.current) {
        await stopSound.current();
        stopSound.current = null;
        setSound(false);
      } else {
        // Unlock before the dynamic import/fetch, while still inside the click.
        context = new AudioContext();
        await context.resume();
        if (context.state !== 'running') throw new Error('Audio gesture required');
        const { createAmbience } = await import('./ambient');
        const stop = await createAmbience(context);
        if (request !== audioRequest.current) await stop();
        else {
          stopSound.current = stop;
          setSound(true);
        }
      }
    } catch {
      if (context && context.state !== 'closed') await context.close();
      notify(text.soundUnavailable);
      setSound(false);
    } finally {
      setSoundBusy(false);
      publishAudioStatus({ enabled: !!stopSound.current, busy: false });
    }
  }, [notify, text.soundUnavailable]);
  useEffect(() => {
    const toggle = () => void toggleSound();
    const failure = () => notify(text.soundUnavailable);
    window.addEventListener(audioToggleEvent, toggle);
    window.addEventListener('cfgcn:audio-failure', failure);
    return () => {
      window.removeEventListener(audioToggleEvent, toggle);
      window.removeEventListener('cfgcn:audio-failure', failure);
    };
  }, [toggleSound, notify, text.soundUnavailable]);
  const WorldPage = isGameId(route) ? worldPages[route] : null;
  return (
    <div
      className="app"
      data-motion={reducedMotion ? 'reduced' : 'full'}
      data-audio={sound ? 'playing' : 'off'}
      data-locale={locale}
      data-atlas-study={route === 'home' ? 'fine-ink' : undefined}
    >
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById('main');
          main?.setAttribute('tabindex', '-1');
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        {text.skip}
      </a>
      <header className="site-header container">
        <a href={homeHref(locale)} className="brand" aria-label={text.brand}>
          <span className="brand-seal" aria-hidden="true">
            四
          </span>
          <span>
            {text.brand}
            <small>THE FOUR CLASSICS</small>
          </span>
        </a>
        <nav className="main-nav" aria-label={locale === 'en' ? 'Main navigation' : '主导航'}>
          <Button variant="quiet" onClick={() => scrollTo('worlds')}>
            {text.worlds}
          </Button>
        </nav>
        <div className="header-tools">
          <div className="language-control">
            <Icon name="globe" size={16} />
            <select
              aria-label={text.language}
              value={locale}
              onChange={(event) => update({ locale: event.target.value as Locale })}
            >
              <option value="zh-CN">简体中文</option>
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
            </select>
          </div>
          <Button
            variant="icon"
            className="icon-button sound-button"
            data-audio-toggle
            aria-label={sound ? text.disableSound : text.enableSound}
            aria-pressed={sound}
            aria-busy={soundBusy}
            title={sound ? text.disableSound : text.enableSound}
            disabled={soundBusy}
            onClick={() => void toggleSound()}
          >
            <Icon name={sound ? 'volume' : 'mute'} size={18} />
          </Button>
          <Button
            variant="quiet"
            className="journal-trigger"
            aria-label={text.journal}
            onClick={() => setJournal(true)}
          >
            <Icon name="book" size={18} />
            <span>{text.journal}</span>
            {traveler.bookmarks.length > 0 && <i className="journal-dot" />}
          </Button>
        </div>
      </header>
      {route === 'home' ? (
        <main id="main">
          <Suspense fallback={<p role="status">{text.loading}</p>}>
            <FineInkStudy
              locale={locale}
              reducedMotion={reducedMotion}
              onMotionChange={(value) => updatePreferences({ reducedMotion: value })}
              onEnter={enterFromMap}
            />
          </Suspense>
        </main>
      ) : WorldPage && isGameId(route) ? (
        <PageBoundary
          key={`${route}-${arrivalRevision}`}
          locale={locale}
          onFailure={() => setArrival(false)}
        >
          <div inert={arrival && route === 'xiyou'}>
            {(!arrival || arrivalRuntime) && (
              <Suspense
                fallback={
                  <main id="main" className="empty-page" role="status">
                    <Icon name="book" size={30} />
                    <p>{text.loading}</p>
                  </main>
                }
              >
                <WorldPage
                  locale={locale}
                  onLocaleChange={(next: Locale) => update({ locale: next })}
                  arrival={
                    arrival && route === 'xiyou'
                      ? { play: arrivalPlay, onStatus: reportArrival }
                      : undefined
                  }
                  bookmarked={traveler.bookmarks.includes(route)}
                  onBookmark={() => toggleBookmark(route)}
                />
              </Suspense>
            )}
          </div>
        </PageBoundary>
      ) : (
        <main id="main" className="empty-page">
          <p className="eyebrow">404 / UNWRITTEN CHAPTER</p>
          <h1>{text.notFound}</h1>
          <a className="button primary" href={homeHref(locale)}>
            {text.home}
          </a>
        </main>
      )}
      <footer className="site-footer container">
        <a href={homeHref(locale)} className="footer-brand">
          {text.brand}
          <span>THE FOUR CLASSICS</span>
        </a>
        <div>
          <p>{text.footer}</p>
          <small>{text.footerNote}</small>
        </div>
        <Button variant="quiet" className="footer-journal" onClick={() => setJournal(true)}>
          {text.journal}
          <Icon name="arrow" size={16} />
        </Button>
      </footer>
      {arrival && route === 'xiyou' && (
        <Suspense fallback={<p role="status">{text.loading}</p>}>
          <ChanganEntrance
            locale={locale}
            reducedMotion={reducedMotion}
            direct={arrivalDirect}
            status={arrivalStatus}
            onStart={startArrival}
            onLoadGame={loadArrivalRuntime}
            onComplete={completeArrival}
            onReturn={() => {
              setArrival(false);
              setArrivalPlay(false);
              window.location.assign(homeHref(locale));
            }}
            onRetry={() => {
              setArrivalStatus(initialArrival);
              setArrivalPlay(false);
              setArrivalRevision((value) => value + 1);
            }}
          />
        </Suspense>
      )}
      {journal && (
        <Journal
          traveler={{ ...traveler, reducedMotion }}
          persisted={persisted}
          onClose={() => setJournal(false)}
          onUpdate={updatePreferences}
          onBookmark={toggleBookmark}
          notify={notify}
        />
      )}
      <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">
        {toast && (
          <>
            <Icon name="check" size={16} />
            {toast}
          </>
        )}
      </div>
    </div>
  );
}
