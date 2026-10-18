import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ErrorInfo, ReactNode } from 'react';
import { isGameId } from '@cfgcn/shared';
import type { GameId, Locale, Traveler } from '@cfgcn/shared';
import { Icon } from '@cfgcn/ui';
import { world as xiyou } from '@cfgcn/xiyou/world';
import { world as shuihu } from '@cfgcn/shuihu/world';
import { world as sanguo } from '@cfgcn/sanguo/world';
import { world as honglou } from '@cfgcn/honglou/world';
import { copy } from './copy';
import { useTraveler } from './useTraveler';

const worlds = [xiyou, shuihu, sanguo, honglou];
const worldPages = {
  xiyou: lazy(() => import('@cfgcn/xiyou')),
  shuihu: lazy(() => import('@cfgcn/shuihu')),
  sanguo: lazy(() => import('@cfgcn/sanguo')),
  honglou: lazy(() => import('@cfgcn/honglou')),
};
const parseRoute = () => {
  const hash = window.location.hash;
  if (!hash || hash === '#' || hash === '#/') return 'home';
  const match = /^#\/world\/([^/]+)$/.exec(hash);
  return match && isGameId(match[1]) ? match[1] : 'not-found';
};

class PageBoundary extends Component<{ children: ReactNode; locale: Locale }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('World preview failed', error.message, info.componentStack);
  }
  render() {
    const text = copy[this.props.locale];
    return this.state.failed ? (
      <main id="main" className="empty-page">
        <Icon name="book" size={32} />
        <h1>{text.failure}</h1>
        <button className="button primary" onClick={() => window.location.reload()}>
          {text.retry}
        </button>
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
        <button className="icon-button journal-close" aria-label={text.close} onClick={onClose}>
          <Icon name="close" />
        </button>
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
            <button type="submit" aria-label={text.saveName}>
              <Icon name="arrow" size={20} />
            </button>
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
                    <a href={`#/world/${world.id}`} onClick={onClose}>
                      <img src={world.image.replace('.webp', '-card.webp')} alt="" />
                      <span>
                        {world.title[traveler.locale]}
                        <small>{world.genre[traveler.locale]}</small>
                      </span>
                    </a>
                    <button
                      className="icon-button"
                      onClick={() => onBookmark(world.id)}
                      aria-label={`${text.unsave} · ${world.title[traveler.locale]}`}
                    >
                      <Icon name="close" size={16} />
                    </button>
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
        <button className="journal-export" onClick={exportJournal}>
          <Icon name="download" size={16} />
          {text.download}
        </button>
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
  const [selected, setSelected] = useState<GameId>('xiyou');
  const [journal, setJournal] = useState(false);
  const [toast, setToast] = useState('');
  const [sound, setSound] = useState(false);
  const [soundBusy, setSoundBusy] = useState(false);
  const stopSound = useRef<(() => Promise<void>) | null>(null);
  const audioRequest = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = worlds.find((world) => world.id === selected)!;
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
    window.scrollTo(0, 0);
    if (isGameId(route)) visit(route);
  }, [route, visit]);
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      audioRequest.current++;
      void stopSound.current?.();
    },
    [],
  );

  const toggleBookmark = (id: GameId) => {
    notify(traveler.bookmarks.includes(id) ? text.removed : text.added);
    bookmark(id);
  };
  const scrollTo = (id: string) => {
    const scroll = () =>
      document.getElementById(id)?.scrollIntoView({
        behavior:
          traveler.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
      });
    if (route !== 'home') {
      window.location.hash = '/';
      setTimeout(scroll, 100);
    } else scroll();
  };
  async function toggleSound() {
    if (soundBusy) return;
    setSoundBusy(true);
    const request = ++audioRequest.current;
    try {
      if (stopSound.current) {
        await stopSound.current();
        stopSound.current = null;
        setSound(false);
      } else {
        const { createAmbience } = await import('./ambient');
        const stop = await createAmbience();
        if (request !== audioRequest.current) await stop();
        else {
          stopSound.current = stop;
          setSound(true);
        }
      }
    } catch {
      notify(text.soundUnavailable);
      setSound(false);
    } finally {
      setSoundBusy(false);
    }
  }
  const WorldPage = isGameId(route) ? worldPages[route] : null;
  return (
    <div
      className="app"
      data-motion={traveler.reducedMotion ? 'reduced' : 'full'}
      data-locale={locale}
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
        <a href="#/" className="brand" aria-label={text.brand}>
          <span className="brand-seal" aria-hidden="true">
            四
          </span>
          <span>
            {text.brand}
            <small>THE FOUR CLASSICS</small>
          </span>
        </a>
        <nav className="main-nav" aria-label={locale === 'en' ? 'Main navigation' : '主导航'}>
          <button onClick={() => scrollTo('worlds')}>{text.worlds}</button>
          <button onClick={() => scrollTo('our-story')}>{text.about}</button>
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
          <button
            className="icon-button sound-button"
            aria-label={sound ? text.disableSound : text.enableSound}
            aria-pressed={sound}
            disabled={soundBusy}
            onClick={() => void toggleSound()}
          >
            <Icon name={sound ? 'volume' : 'mute'} size={18} />
          </button>
          <button
            className="journal-trigger"
            aria-label={text.journal}
            onClick={() => setJournal(true)}
          >
            <Icon name="book" size={18} />
            <span>{text.journal}</span>
            {traveler.bookmarks.length > 0 && <i className="journal-dot" />}
          </button>
        </div>
      </header>
      {route === 'home' ? (
        <main id="main">
          <section
            className="hero"
            style={{ '--world-accent': current.accent } as CSSProperties}
            onPointerMove={(event) => {
              if (
                traveler.reducedMotion ||
                matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches
              )
                return;
              const box = event.currentTarget.getBoundingClientRect();
              event.currentTarget.style.setProperty(
                '--pan-x',
                `${((event.clientX - box.left - box.width / 2) / box.width) * 9}px`,
              );
              event.currentTarget.style.setProperty(
                '--pan-y',
                `${((event.clientY - box.top - box.height / 2) / box.height) * 6}px`,
              );
            }}
            onPointerLeave={(event) => {
              event.currentTarget.style.setProperty('--pan-x', '0px');
              event.currentTarget.style.setProperty('--pan-y', '0px');
            }}
          >
            <div className="hero-art" key={selected}>
              <img src={current.image} alt={current.place[locale]} fetchPriority="high" />
              <div className="hero-art-wash" />
            </div>
            <div className="hero-copy container">
              <p className="eyebrow hero-eyebrow">
                <span />
                {text.eyebrow}
              </p>
              <h1>
                {text.hero1}
                <br />
                <span>{text.hero2}</span>
              </h1>
              <p className="hero-description">{text.heroDescription}</p>
              <a className="button primary hero-cta" href={`#/world/${selected}`}>
                {text.enter}
                <Icon name="arrow" size={18} />
              </a>
              <button className="explore-link" onClick={() => scrollTo('worlds')}>
                {text.explore}
                <span aria-hidden="true">↓</span>
              </button>
            </div>
            <div className="hero-side-note" aria-hidden="true">
              {current.place[locale]}
            </div>
            <span className="hero-scene-caption">
              {current.number}
              <span />
              {current.title[locale]} · {text.preview}
            </span>
            <div className="hero-bottom container">
              <div className="hero-world-selector" role="group" aria-label={text.worlds}>
                {worlds.map((world) => (
                  <button
                    key={world.id}
                    aria-pressed={selected === world.id}
                    className={selected === world.id ? 'is-selected' : ''}
                    onClick={() => setSelected(world.id)}
                  >
                    <span className="world-number">{world.number}</span>
                    <span className="world-selector-text">
                      {world.title[locale]}
                      <small>{world.genre[locale]}</small>
                    </span>
                    <span className="selector-dot" />
                  </button>
                ))}
              </div>
            </div>
          </section>
          <div className="chapter-divider container">
            <span>{text.artNote}</span>
            <Icon name="leaf" size={16} />
            <span>THE FOUR CLASSICS</span>
          </div>
          <section id="worlds" className="worlds-section container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CHOOSE YOUR CHAPTER</p>
                <h2>
                  {text.worldsHeading1}
                  <br />
                  {text.worldsHeading2}
                </h2>
              </div>
              <p>{text.worldsDescription}</p>
            </div>
            <div className="world-grid">
              {worlds.map((world) => (
                <article
                  className="world-card"
                  key={world.id}
                  style={{ '--card-accent': world.accent } as CSSProperties}
                >
                  <a
                    href={`#/world/${world.id}`}
                    className="world-card-image"
                    aria-label={`${text.enter} · ${world.title[locale]}`}
                  >
                    <img
                      src={world.image.replace('.webp', '-card.webp')}
                      alt={world.place[locale]}
                      loading="lazy"
                      width="640"
                      height="800"
                    />
                    <span className="card-chapter">
                      {text.chapter} {world.number}
                    </span>
                    <span className="card-preview">{text.preview}</span>
                    <span className="card-calligraphy" aria-hidden="true">
                      {world.title[locale]}
                    </span>
                  </a>
                  <button
                    className={`card-bookmark ${traveler.bookmarks.includes(world.id) ? 'saved' : ''}`}
                    onClick={() => toggleBookmark(world.id)}
                    aria-label={`${traveler.bookmarks.includes(world.id) ? text.unsave : text.save} · ${world.title[locale]}`}
                    aria-pressed={traveler.bookmarks.includes(world.id)}
                  >
                    <Icon
                      name={traveler.bookmarks.includes(world.id) ? 'check' : 'bookmark'}
                      size={16}
                    />
                  </button>
                  <div className="card-meta">
                    <span>{world.genre[locale]}</span>
                    <span>{world.number}</span>
                  </div>
                  <a href={`#/world/${world.id}`} className="world-card-title">
                    <h3>{world.title[locale]}</h3>
                    <Icon name="arrow" size={19} />
                  </a>
                  <p className="card-invitation">{world.invitation[locale]}</p>
                </article>
              ))}
            </div>
          </section>
          <section id="our-story" className="story-section container">
            <div className="story-image">
              <img
                src={honglou.image}
                alt={honglou.place[locale]}
                loading="lazy"
                width="800"
                height="600"
              />
              <p>{text.gardenCaption}</p>
              <span className="story-image-index" aria-hidden="true">
                肆
              </span>
            </div>
            <div className="story-copy">
              <p className="eyebrow">{text.aboutEyebrow}</p>
              <h2>
                {text.aboutHeading1}
                <br />
                {text.aboutHeading2}
              </h2>
              <p>{text.aboutDescription}</p>
              <p className="story-detail">{text.aboutDetail}</p>
              <span className="story-seal" aria-hidden="true">
                入<br />境
              </span>
            </div>
          </section>
        </main>
      ) : WorldPage && isGameId(route) ? (
        <PageBoundary key={route} locale={locale}>
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
              bookmarked={traveler.bookmarks.includes(route)}
              onBookmark={() => toggleBookmark(route)}
            />
          </Suspense>
        </PageBoundary>
      ) : (
        <main id="main" className="empty-page">
          <p className="eyebrow">404 / UNWRITTEN CHAPTER</p>
          <h1>{text.notFound}</h1>
          <a className="button primary" href="#/">
            {text.home}
          </a>
        </main>
      )}
      <footer className="site-footer container">
        <a href="#/" className="footer-brand">
          {text.brand}
          <span>THE FOUR CLASSICS</span>
        </a>
        <div>
          <p>{text.footer}</p>
          <small>{text.footerNote}</small>
        </div>
        <button className="footer-journal" onClick={() => setJournal(true)}>
          {text.journal}
          <Icon name="arrow" size={16} />
        </button>
      </footer>
      {journal && (
        <Journal
          traveler={traveler}
          persisted={persisted}
          onClose={() => setJournal(false)}
          onUpdate={update}
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
