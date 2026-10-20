import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import type { Locale } from '@cfgcn/shared';
import { Button } from '@cfgcn/ui';
import { TouchStick } from './TouchStick';
import { SoundControl } from './SoundControl';
import { mapRegions, mapLandmarks } from './expedition-map';
import { browserStorage } from '@cfgcn/shared';
import { InkMap } from './InkMap';
import {
  readFog,
  revealFog,
  saveFog,
  readMapMarks,
  saveMapMarks,
  maxMapMarks,
  fogKey,
} from './map-exploration';
import type { MapChart, MapMark } from './map-exploration';
import { MapGlyph } from './MapGlyph';
import { InkGlyph, InkHeading } from './InkUi';
import type { ExpeditionState } from './expedition-map';
import type { StickVector } from './touch-input';
import './expedition.css';

const words = {
  'zh-CN': {
    title: '西行山河',
    survey: '皮影悟空样板',
    map: '展开西行全图',
    close: '收起全图',
    locate: '踏勘定位',
    resume: '继续行走',
    pause: '停步',
    leave: '返回入口',
    hint: '走动与转向样板 · 地图、剧情与战斗仍在制作',
    moving: '移动',
    west: '西行',
    saved: '位置已记下',
    unsaved: '位置未保存',
    ready: '正在铺展山河…',
    visited: '已到',
    km: '公里',
    mark: '放置标记',
    erase: '删除选中标记',
    undo: '撤销删除',
    marked: '标记已记下',
    unknown: '雾中尚不能落记，请先去探索',
    markHint: '点选已探索位置 · Enter 标记地图中心',
    markLimit: '已放满 64 个标记',
    myMark: '我的标记',
    legend: ['林地', '水域', '村居 / 寺观', '个人标记'],
    zoomIn: '放大地图',
    zoomOut: '缩小地图',
    recenter: '回到我的位置',
    controls: '地图操作',
  },
  'zh-TW': {
    title: '西行山河',
    survey: '皮影悟空樣板',
    map: '展開西行全圖',
    close: '收起全圖',
    locate: '踏勘定位',
    resume: '繼續行走',
    pause: '停步',
    leave: '返回入口',
    hint: '走動與轉向樣板 · 地圖、劇情與戰鬥仍在製作',
    moving: '移動',
    west: '西行',
    saved: '位置已記下',
    unsaved: '位置未儲存',
    ready: '正在鋪展山河…',
    visited: '已到',
    km: '公里',
    mark: '放置標記',
    erase: '刪除選中標記',
    undo: '撤銷刪除',
    marked: '標記已記下',
    unknown: '霧中尚不能落記，請先去探索',
    markHint: '點選已探索位置 · Enter 標記地圖中心',
    markLimit: '已放滿 64 個標記',
    myMark: '我的標記',
    legend: ['林地', '水域', '村居 / 寺觀', '個人標記'],
    zoomIn: '放大地圖',
    zoomOut: '縮小地圖',
    recenter: '回到我的位置',
    controls: '地圖操作',
  },
  en: {
    title: 'The Westward World',
    survey: 'Wukong puppet study',
    map: 'Open world map',
    close: 'Close map',
    locate: 'Survey location',
    resume: 'Keep walking',
    pause: 'Pause',
    leave: 'Return to entry',
    hint: 'Walking and turning study · World, story and combat remain in development',
    moving: 'Move',
    west: 'Westward',
    saved: 'Position saved',
    unsaved: 'Position not saved',
    ready: 'Unfolding the landscape…',
    visited: 'Visited',
    km: 'km',
    mark: 'Place a marker',
    erase: 'Delete selected marker',
    undo: 'Undo deletion',
    marked: 'Marker saved',
    unknown: 'Explore the mist before marking this place',
    markHint: 'Tap explored terrain · Enter marks the map centre',
    markLimit: 'All 64 markers are in use',
    myMark: 'My marker',
    legend: ['Woodland', 'Water', 'Dwellings / temples', 'My markers'],
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    recenter: 'My position',
    controls: 'Map controls',
  },
};
export const mapWords = words;
function MotifGeometry({ biome }: { biome: string }) {
  return (
    <>
      {biome === 'river' ? (
        <>
          <path d="M2 17Q12 9 22 17T46 17M2 26Q12 18 22 26T46 26M2 35Q12 27 22 35T46 35" />
          <path d="M14 9L20 3L27 10M32 39L39 44L46 39" />
        </>
      ) : biome === 'forest' || biome === 'garden' ? (
        <>
          <path d="M13 40V24M6 30L13 13L21 30ZM26 37L34 7L44 37ZM34 22V44M2 43Q20 39 46 43" />
          <path d="M24 34L28 24M8 23L14 7L20 24" />
        </>
      ) : biome === 'meadow' ? (
        <>
          <path d="M2 34Q12 23 26 32T46 30M2 41Q21 34 46 40M13 30V20M8 25L13 21L18 25M30 32L35 22L39 32" />
          <path d="M2 20L10 15L17 19M25 17L33 11L42 17" />
        </>
      ) : (
        <>
          <path d="M2 40L16 12L23 24L32 5L46 40ZM10 30L16 19L19 26M25 24L32 13L36 23M4 43Q24 39 44 43" />
          <path d="M18 31L24 35M31 28L36 34" />
        </>
      )}
    </>
  );
}
function Motif({ biome }: { biome: string }) {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" className="expedition-motif">
      <MotifGeometry biome={biome} />
    </svg>
  );
}
export function ExpeditionHud({
  expedition,
  charts,
  performance,
  phase,
  ready,
  mapRequest,
  saved,
  locale,
  send,
  onMove,
}: {
  expedition: ExpeditionState;
  charts: MapChart[];
  performance?: {
    mean_fps?: number;
    frame_p95_ms?: number;
    sampled_frames?: number;
    map_built?: number;
    map_released?: number;
    map_cells?: number;
  };
  phase: string;
  ready: boolean;
  mapRequest: number;
  saved: boolean;
  locale: Locale;
  send: (v: Record<string, unknown>) => void;
  onMove: (v: StickVector) => void;
}) {
  const text = words[locale];
  const lang = locale === 'en' ? 2 : locale === 'zh-TW' ? 1 : 0;
  const region = mapRegions[expedition.region];
  const [open, setOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [center, setCenter] = useState(expedition.pos);
  const [span, setSpan] = useState(160);
  const [fog] = useState(() => readFog(browserStorage()));
  const [revision, setRevision] = useState(0);
  const [fogSaved, setFogSaved] = useState(true);
  const [marks, setMarks] = useState(() => readMapMarks(browserStorage()));
  const [marksSaved, setMarksSaved] = useState(true);
  const [marking, setMarking] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [removed, setRemoved] = useState<MapMark | null>(null);
  const [notice, setNotice] = useState('');
  const returnToPlay = useRef(false);
  const lastMapRequest = useRef(mapRequest);
  const dialog = useRef<HTMLDialogElement>(null);
  const tools = new URLSearchParams(location.search).get('survey-tools') === '1';
  const close = useCallback(() => {
    setOpen(false);
    setDebugOpen(false);
    setMarking(false);
    send({
      ...(returnToPlay.current && !document.hidden ? { action: 3 } : {}),
      x: 0,
      z: 0,
      focus: true,
    });
  }, [send]);
  const showMap = useCallback(() => {
    if (!ready || !['playing', 'paused'].includes(phase)) return;
    returnToPlay.current = phase === 'playing';
    send({ action: 2, x: 0, z: 0 });
    setCenter({ ...expedition.pos });
    setNotice('');
    setOpen(true);
  }, [ready, phase, expedition.pos, send]);
  const toggleMap = useCallback(() => (open ? close() : showMap()), [open, close, showMap]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.isComposing ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        (e.target instanceof Element &&
          e.target.closest('input, textarea, select, [contenteditable="true"]'))
      )
        return;
      if (e.code === 'KeyM' || e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMap();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [toggleMap]);
  useEffect(() => {
    if (lastMapRequest.current === mapRequest) return;
    lastMapRequest.current = mapRequest;
    toggleMap();
  }, [mapRequest, toggleMap]);
  const persist = (next: MapMark[]) => {
    setMarks(next);
    setMarksSaved(saveMapMarks(browserStorage(), next));
  };
  const placeMark = (pos: { x: number; z: number }) => {
    if (!fog.has(fogKey(pos.x, pos.z))) {
      setNotice(text.unknown);
      return;
    }
    if (marks.length >= maxMapMarks) {
      setNotice(text.markLimit);
      return;
    }
    const mark = { id: crypto.randomUUID(), pos };
    persist([...marks, mark]);
    setSelected(mark.id);
    setMarking(false);
    setNotice(text.marked);
  };
  const eraseMark = () => {
    const mark = marks.find((m) => m.id === selected);
    if (!mark) return;
    setRemoved(mark);
    persist(marks.filter((m) => m.id !== mark.id));
    setSelected(null);
    setNotice('');
  };
  useEffect(() => {
    if (open && !dialog.current?.open) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => {
    if (ready && revealFog(fog, expedition.pos)) {
      setRevision((v) => v + 1);
      setFogSaved(saveFog(browserStorage(), fog));
    }
  }, [expedition.pos, ready, fog]);
  const p = expedition.pos;
  const press = (action: () => void) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.disabled) return;
      event.preventDefault();
      if (event.pointerType !== 'mouse') action();
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (
        event.detail > 0 &&
        'pointerType' in event.nativeEvent &&
        event.nativeEvent.pointerType !== 'mouse'
      )
        return;
      action();
    },
  });
  const localLabel =
    locale === 'en'
      ? 'Explored terrain, water, woodland and dwellings'
      : locale === 'zh-TW'
        ? '已探索的地形、水域、林木與村居'
        : '已探索的地形、水域、林木与村居';
  const recenter = () => setCenter({ ...p });
  return (
    <>
      <div className="expedition-title" role="status" key={region.id}>
        <span>{text.survey}</span>
        <h1>{region.names[lang]}</h1>
        <small title={saved && fogSaved && marksSaved ? text.saved : text.unsaved}>
          {saved && fogSaved && marksSaved ? '◈' : '◇'}
        </small>
        {tools && (
          <small className="expedition-coordinates">
            {p.x.toFixed(1)}, {p.z.toFixed(1)} · {performance?.mean_fps?.toFixed(1)} FPS · p95{' '}
            {performance?.frame_p95_ms?.toFixed(1)} ms ({performance?.sampled_frames}) ·{' '}
            {performance?.map_cells} cells · +{performance?.map_built}/−{performance?.map_released}
          </small>
        )}
      </div>
      <div className="expedition-tools">
        <SoundControl locale={locale} />
        <Button
          variant="icon"
          aria-label={text.map}
          aria-keyshortcuts="M"
          title={`${text.map} · M`}
          disabled={!ready}
          {...press(showMap)}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="M5 11L17 5L31 11L43 5V37L31 43L17 37L5 43ZM17 5V37M31 11V43M8 30Q18 10 36 28" />
          </svg>
        </Button>
        <Button
          variant="icon"
          aria-label={text.pause}
          title={text.pause}
          disabled={phase !== 'playing' || !ready}
          {...press(() => send({ action: 2, x: 0, z: 0 }))}
        >
          <InkGlyph name="pause" />
        </Button>
      </div>
      <div className="expedition-local" aria-hidden="true">
        <InkMap
          center={p}
          player={p}
          span={192}
          charts={charts}
          fog={fog}
          revision={revision}
          label={localLabel}
          miniature
          marks={marks}
          markLabel={text.myMark}
          request={send}
        />
      </div>
      <TouchStick
        enabled={phase === 'playing' && ready && !open}
        label={text.moving}
        onMove={onMove}
      />
      {!ready && (
        <p className="expedition-loading" role="status">
          {text.ready}
        </p>
      )}
      {phase === 'paused' && !open && (
        <div className="expedition-paused">
          <InkHeading eyebrow={locale === 'en' ? 'JOURNEY TO THE WEST' : '西游 · 山河漫游'}>
            {locale === 'en' ? 'A quiet moment' : locale === 'zh-TW' ? '稍歇片刻' : '稍歇片刻'}
          </InkHeading>
          <Button variant="primary" onClick={() => send({ action: 3, focus: true })}>
            <InkGlyph name="play" />
            {text.resume}
          </Button>
          <Button variant="quiet" onClick={() => send({ action: 13 })}>
            <InkGlyph name="back" />
            {text.leave}
          </Button>
        </div>
      )}
      <p className="expedition-caption">{text.hint}</p>
      <dialog
        ref={dialog}
        className="expedition-atlas"
        aria-label={text.map}
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.stopPropagation();
          if (e.key === 'Delete' && selected) {
            e.preventDefault();
            eraseMark();
          }
        }}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <header>
          <div>
            <span>{region.names[lang]}</span>
            <h2>{text.title}</h2>
          </div>
          <Button
            variant="icon"
            aria-label={text.close}
            aria-keyshortcuts="M Escape"
            onClick={close}
          >
            <InkGlyph name="close" />
          </Button>
        </header>
        <nav className="expedition-map-views" aria-label={text.controls}>
          <Button
            variant="icon"
            aria-label={text.zoomIn}
            disabled={span <= 160}
            onClick={() => setSpan((v) => Math.max(160, v / 2))}
          >
            <span aria-hidden="true">＋</span>
          </Button>
          <Button
            variant="icon"
            aria-label={text.zoomOut}
            disabled={span >= 640}
            onClick={() => setSpan((v) => Math.min(640, v * 2))}
          >
            <span aria-hidden="true">−</span>
          </Button>
          <Button variant="icon" aria-label={text.recenter} onClick={recenter}>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="12" />
              <circle cx="24" cy="24" r="3" />
              <path d="M24 4V14M24 34V44M4 24H14M34 24H44" />
            </svg>
          </Button>
          <Button
            variant="icon"
            aria-label={text.mark}
            title={text.mark}
            aria-pressed={marking}
            onClick={() => {
              setMarking((v) => !v);
              setNotice('');
            }}
          >
            <MapGlyph kind="flag" />
          </Button>
          <Button
            variant="icon"
            aria-label={text.erase}
            title={text.erase}
            disabled={!selected}
            onClick={eraseMark}
          >
            <MapGlyph kind="erase" />
          </Button>
          <Button
            variant="icon"
            aria-label={text.undo}
            title={text.undo}
            disabled={!removed || marks.length >= maxMapMarks}
            onClick={() => {
              if (!removed) return;
              persist([...marks, removed]);
              setSelected(removed.id);
              setRemoved(null);
              setNotice(text.marked);
            }}
          >
            <MapGlyph kind="undo" />
          </Button>
          {tools && (
            <Button
              variant="quiet"
              aria-pressed={debugOpen}
              onClick={() => setDebugOpen((v) => !v)}
            >
              {locale === 'en' ? 'Survey tools' : '制作定位'}
            </Button>
          )}
        </nav>
        {debugOpen && tools ? (
          <div className="expedition-debug-regions">
            {[
              [19, '岸柳根部', '岸柳根部', 'Bank willow'],
              [20, '芦苇穿行', '蘆葦穿行', 'Reed passage'],
              [21, '临水卧石', '臨水臥石', 'Bank slate'],
              [24, '庄边杏树', '莊邊杏樹', 'Apricot tree'],
              [25, '低草根部', '低草根部', 'Meadow grass'],
              [26, '野花草丛', '野花草叢', 'Wildflower patch'],
              [27, '林下蕨丛', '林下蕨叢', 'Woodland fern'],
            ].map(([symbol, cn, tw, en]) => {
              const prop = charts
                .flatMap((chart) => chart.props)
                .filter((v) => v[2] === symbol && Math.abs(v[0] - p.x) < 120)
                .sort(
                  (a, b) => Math.hypot(a[0] - p.x, a[1] - p.z) - Math.hypot(b[0] - p.x, b[1] - p.z),
                )[0];
              const label = String(locale === 'en' ? en : locale === 'zh-TW' ? tw : cn);
              return (
                <Button
                  key={symbol}
                  variant="quiet"
                  disabled={!prop}
                  onClick={() => {
                    if (!prop) return;
                    setOpen(false);
                    setDebugOpen(false);
                    send({
                      action: 11,
                      map_position: { x: prop[0], z: prop[1] - 3 },
                      map_visited: expedition.visited,
                      focus: true,
                    });
                  }}
                >
                  <Motif biome="river" />
                  {label}
                </Button>
              );
            })}
            {mapLandmarks
              .filter((m) => (m.pack === 3 && m.scene !== 1) || (m.pack === 4 && m.scene === 0))
              .map((m) => (
                <Button
                  key={m.id}
                  variant="quiet"
                  aria-label={m.names[lang]}
                  onClick={() => {
                    setOpen(false);
                    setDebugOpen(false);
                    send({
                      action: 11,
                      map_position: {
                        x: m.x + (m.pack === 3 && m.scene === 0 ? -0.4 : 0),
                        z: m.z - (m.scene === 3 ? 10 : 6),
                      },
                      map_visited: expedition.visited,
                      focus: true,
                    });
                  }}
                >
                  <Motif biome="forest" />
                  {m.names[lang]}
                </Button>
              ))}
            {mapRegions.slice(0, 4).map((r, i) => {
              const house = mapLandmarks.find((m) =>
                i === 0
                  ? m.id === 'hamlet_east_house'
                  : m.region === r.id && m.pack === 2 && m.scene === 1,
              )!;
              return (
                <Button
                  key={`hamlet-${r.id}`}
                  variant="quiet"
                  aria-label={`${r.names[lang]} · ${locale === 'en' ? 'Dwellings' : '村居'}`}
                  onClick={() => {
                    setOpen(false);
                    setDebugOpen(false);
                    send({
                      action: 11,
                      map_position: { x: house.x + (i === 0 ? -6 : 5), z: house.z - 16 },
                      map_visited: expedition.visited,
                      focus: true,
                    });
                  }}
                >
                  <Motif biome={r.biome} />
                  {r.names[lang]} · {locale === 'en' ? 'Dwellings' : '村居'}
                </Button>
              );
            })}
            {mapRegions.map((r, i) => (
              <Button
                key={r.id}
                variant="quiet"
                aria-label={`${text.locate} · ${r.names[lang]}`}
                onClick={() => {
                  send({ action: 12, map_target: i });
                  setDebugOpen(false);
                  setCenter({ x: r.x, z: r.z });
                }}
              >
                <Motif biome={r.biome} />
                {r.names[lang]}
              </Button>
            ))}
          </div>
        ) : (
          open && (
            <div className="expedition-regional" data-marking={marking}>
              <InkMap
                center={center}
                player={p}
                span={span}
                charts={charts}
                fog={fog}
                revision={revision}
                label={localLabel}
                request={send}
                pan={setCenter}
                marks={marks}
                markLabel={text.myMark}
                selected={selected}
                select={setSelected}
                place={marking ? placeMark : undefined}
                locale={locale}
              />
            </div>
          )
        )}
        <footer>
          <div className="expedition-map-notes">
            <div className="expedition-map-legend">
              {(['wood', 'water', 'home', 'flag'] as const).map((kind, i) => (
                <span key={kind}>
                  <MapGlyph kind={kind} />
                  {text.legend[i]}
                </span>
              ))}
            </div>
            <p role="status">
              {!marksSaved
                ? text.unsaved
                : notice ||
                  (marking
                    ? text.markHint
                    : locale === 'en'
                      ? 'M / Esc close · Drag to explore · Mist conceals the unknown'
                      : locale === 'zh-TW'
                        ? 'M / Esc 收圖 · 拖動查看 · 霧中待尋'
                        : 'M / Esc 收图 · 拖动查看 · 雾中待寻')}
            </p>
          </div>
          <Button variant="primary" onClick={close}>
            {returnToPlay.current ? text.resume : text.close}
          </Button>
        </footer>
      </dialog>
    </>
  );
}
