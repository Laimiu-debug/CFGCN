import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import type { Locale } from '@cfgcn/shared';
import { browserStorage } from '@cfgcn/shared';
import { Button } from '@cfgcn/ui';
import { TouchStick } from './TouchStick';
import { TrialRecorder } from './TrialRecorder';
import { SoundControl } from './SoundControl';
import { InkGlyph, InkHeading, InkRim, ShadowSkillArt } from './InkUi';
import raw from '../art/shadow-actions-v6/skills.json';
import './ink-interface.css';
import './shadow-trial.css';

export const shadowActors = ['tangseng', 'wukong', 'bajie', 'shaseng', 'xiaobailong'] as const;
const names = ['唐僧', '孙悟空', '猪八戒', '沙悟净', '小白龙'];
type Skill = {
  id: string;
  actor: string;
  clip: string;
  name: string;
  role: string;
  effect: string;
  limit: string;
  ultimate: boolean;
  rehearsal_cooldown: number;
  motion: { thumbnail: string; duration: number; upper_clip: string | null };
};
const skills = raw.entries.filter((e) => e.kind === 'active') as unknown as Skill[];
const pools = shadowActors.map((actor) => skills.filter((s) => s.actor === actor));
const key = 'cfgcn:xiyou:shadow-loadouts:v1';
export function readTrialLoadouts(value: unknown): number[][] {
  const saved = value as { version?: number; loadouts?: Record<string, unknown> } | null;
  return shadowActors.map((actor, a) => {
    const defaults = raw.defaults[actor].map((id) => pools[a].findIndex((s) => s.id === id));
    const list = saved?.version === 1 ? saved.loadouts?.[actor] : null;
    if (!Array.isArray(list) || list.length !== 4 || new Set(list).size !== 4) return defaults;
    const indices = list.map((id) => pools[a].findIndex((s) => s.id === id));
    return indices.every((i) => i >= 0) ? indices : defaults;
  });
}
type Hero = {
  hp: number;
  shield: number;
  cooldowns: number[];
  loadout: number[];
  cast: { skill: number; time: number } | null;
  dodge: { time: number } | null;
  dodge_cooldown: number;
  pos: { x: number; z: number };
};
type Trial = {
  heroes: Hero[];
  leader: number;
  elapsed: number;
  kills: number;
  paused: boolean;
  automatic: boolean;
  casts: number;
  releases: number;
  blocked: number;
  enemies: { hp: number }[];
};
type FrameReport = {
  samples: number;
  fps: number;
  p95_ms: number;
  max_ms: number;
  over_50: number;
  entities: number;
  effects: number;
  cells: number;
  simulation_ms: number;
};
type State = { ready: boolean; trial: Trial; performance: FrameReport };
export function ShadowTrial({ locale, onExit }: { locale: Locale; onExit: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    menu = useRef<HTMLDialogElement>(null);
  const restored = useRef(false),
    lastSave = useRef(''),
    resume = useRef(false),
    lastTouch = useRef(0);
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState('');
  const [editor, setEditor] = useState(false),
    [actor, setActor] = useState(1),
    [slot, setSlot] = useState(0),
    [saved, setSaved] = useState(true);
  const [motion, setMotion] = useState(() => {
    try {
      const savedMotion = browserStorage()?.getItem('cfgcn:xiyou:motion:v1');
      return savedMotion === null || savedMotion === undefined
        ? matchMedia('(prefers-reduced-motion: reduce)').matches
        : savedMotion === 'reduced';
    } catch {
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  });
  const send = useCallback(
    (value: Record<string, unknown>) =>
      frame.current?.contentWindow?.postMessage(
        { type: 'cfgcn:xiyou:input', value },
        location.origin,
      ),
    [],
  );
  const initialize = useCallback(() => {
    let value: unknown = null;
    try {
      value = JSON.parse(browserStorage()?.getItem(key) ?? 'null');
    } catch {
      /* Invalid saves fall back independently per actor. */
    }
    send({
      action: 2,
      shadow_loadouts: readTrialLoadouts(value),
      reduced_motion: motion,
      locale,
    });
  }, [send, locale, motion]);
  useEffect(() => {
    send({ reduced_motion: motion });
    try {
      browserStorage()?.setItem('cfgcn:xiyou:motion:v1', motion ? 'reduced' : 'full');
    } catch {
      /* The current preference still applies in memory. */
    }
  }, [motion, send]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'cfgcn:xiyou:error') setError(String(event.data.value));
      if (event.data?.type === 'cfgcn:xiyou:shadow-state') {
        const value = event.data.value as State;
        if (value?.trial?.heroes?.length !== 5) return;
        if (!restored.current) {
          restored.current = true;
          initialize();
          return;
        }
        setState(value);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [initialize]);
  useEffect(() => {
    if (!state) return;
    const loadouts = Object.fromEntries(
      shadowActors.map((id, a) => [id, state.trial.heroes[a].loadout.map((i) => pools[a][i].id)]),
    );
    const text = JSON.stringify({ version: 1, loadouts });
    if (lastSave.current === text) return;
    lastSave.current = text;
    try {
      const storage = browserStorage();
      if (!storage) throw Error('storage');
      storage.setItem(key, text);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [state]);
  useEffect(() => {
    if (editor || !state?.ready || !state.trial.paused) menu.current?.close();
    if (editor) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else if (dialog.current?.open) {
      dialog.current.close();
    }
    if (!editor && state?.ready && state.trial.paused && !menu.current?.open)
      menu.current?.showModal();
  }, [editor, state?.ready, state?.trial.paused]);
  const stop = useCallback(() => send({ x: 0, z: 0 }), [send]);
  useEffect(() => {
    const pause = () => {
      stop();
      send({ action: 2 });
    };
    const hidden = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('resize', pause);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('resize', pause);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [send, stop]);
  const press = (value: Record<string, unknown>) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (event.pointerType !== 'mouse') {
        lastTouch.current = performance.now();
        send(value);
      }
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail > 0 && performance.now() - lastTouch.current < 600) return;
      send(value);
    },
  });
  const t = state?.trial,
    leader = t?.leader ?? 1,
    hero = t?.heroes[leader];
  const open = () => {
    resume.current = !!t && !t.paused;
    stop();
    send({ action: 2 });
    setActor(leader);
    setEditor(true);
  };
  const close = () => {
    setEditor(false);
    if (resume.current) send({ action: 3, focus: true });
  };
  const selected = pools[actor][t?.heroes[actor].loadout[slot] ?? slot];
  const stamp = `${Math.floor((t?.elapsed ?? 0) / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor((t?.elapsed ?? 0) % 60)
    .toString()
    .padStart(2, '0')}`;
  return (
    <main
      className="shadow-trial"
      id="main"
      data-ready={state?.ready ?? false}
      data-paused={t?.paused ?? true}
      data-reduced={motion}
    >
      {['127.0.0.1', 'localhost'].includes(location.hostname) &&
        new URLSearchParams(location.search).get('proof') === '1' && (
          <TrialRecorder frame={frame} performance={state?.performance} position={hero?.pos} />
        )}
      <iframe
        ref={frame}
        src="/games/xiyou/index.html?skills=1"
        title="西游五人皮影技能演武"
        onLoad={initialize}
      />
      <header className="shadow-toolbar">
        <div className="shadow-title">
          <span>西游 · 山河演武</span>
          <h1>五影同游</h1>
        </div>
        <div className="shadow-tally" aria-label={'演武' + stamp + '，击退' + (t?.kills ?? 0)}>
          <InkGlyph name="clock" />
          <time>{stamp}</time>
          <InkGlyph name="sword" />
          <strong>{t?.kills ?? 0}</strong>
        </div>
        <nav className="shadow-tools" aria-label="演武控制">
          <SoundControl locale={locale} />
          <Button variant="portrait" aria-label="返回地图" title="返回地图" onClick={onExit}>
            <InkGlyph name="back" />
          </Button>
          <Button
            variant="portrait"
            aria-label="十二招整备"
            title="十二招整备"
            onClick={open}
            disabled={!state?.ready}
          >
            <InkGlyph name="scroll" />
          </Button>
          <Button
            variant="portrait"
            aria-label={t?.paused ? '继续演武' : '暂停演武'}
            title="暂停 / 继续 · Esc"
            {...press({ action: t?.paused ? 3 : 2, focus: true })}
            disabled={!state?.ready}
          >
            <InkGlyph name={t?.paused ? 'play' : 'pause'} />
          </Button>
        </nav>
      </header>
      <nav className="shadow-party" aria-label="切换领队">
        {shadowActors.map((id, a) => (
          <Button
            key={id}
            variant="portrait"
            className="shadow-companion"
            aria-label={'切换' + names[a] + '，气血' + Math.ceil(t?.heroes[a].hp ?? 100)}
            aria-pressed={leader === a}
            data-leader={leader === a}
            disabled={!!t && t.heroes[a].hp <= 0}
            {...press({ shadow_leader: a, focus: true })}
          >
            <span className="shadow-portrait">
              <InkRim value={(t?.heroes[a].hp ?? 100) / 100} />
              <img src={'/games/xiyou/assets/shadow/' + id + '/head.png'} alt="" />
            </span>
            <span className="shadow-hero-name">{names[a]}</span>
            <svg className="shadow-hp" viewBox="0 0 100 5" aria-hidden="true">
              <path d="M0 2.5H100" />
              <path d={'M0 2.5H' + Math.max(0, t?.heroes[a].hp ?? 100)} />
            </svg>
          </Button>
        ))}
        <span className="shadow-party-key">
          <kbd>Q</kbd> 换人
        </span>
      </nav>
      {!state?.ready && !error && (
        <div className="shadow-loading" role="status">
          <InkGlyph name="lotus" />
          <p>铺开山河，五影入卷…</p>
        </div>
      )}
      {error && (
        <div className="shadow-loading" role="alert">
          <p>演武载入失败：{error}</p>
          <Button variant="secondary" onClick={() => location.reload()}>
            重新载入
          </Button>
        </div>
      )}
      <TouchStick
        enabled={!!state?.ready && !t?.paused && !editor}
        label="移动领队"
        onMove={send}
      />
      <div className="shadow-combat-deck">
        <Button
          variant="portrait"
          className="shadow-dodge"
          aria-label={
            '闪避，空格键' +
            ((hero?.dodge_cooldown ?? 0) > 0
              ? '，冷却' + hero?.dodge_cooldown.toFixed(1) + '秒'
              : '')
          }
          disabled={!state?.ready || !!t?.paused || (hero?.dodge_cooldown ?? 0) > 0}
          {...press({ shadow_dodge: true, focus: true })}
        >
          <span className="shadow-orb">
            <InkRim value={1 - (hero?.dodge_cooldown ?? 0) / 1.6} />
            <InkGlyph name="dodge" />
            {(hero?.dodge_cooldown ?? 0) > 0 && (
              <b className="shadow-cd">{hero?.dodge_cooldown.toFixed(1)}</b>
            )}
          </span>
          <span className="shadow-key">
            <kbd>Space</kbd> 闪避
          </span>
        </Button>
        <nav className="shadow-slots" aria-label="四个已装备技能">
          {(hero?.loadout ?? readTrialLoadouts(null)[leader]).map((index, s) => {
            const skill = pools[leader][index],
              cd = hero?.cooldowns[index] ?? 0,
              casting = hero?.cast?.skill === index;
            const progress = casting
              ? (hero?.cast?.time ?? 0) / skill.motion.duration
              : 1 - cd / skill.rehearsal_cooldown;
            return (
              <Button
                key={s}
                variant="portrait"
                className="shadow-skill"
                data-casting={casting}
                data-ultimate={skill.ultimate}
                data-cooling={cd > 0 && !casting}
                disabled={!state?.ready || !!t?.paused || cd > 0 || !!hero?.cast || !!hero?.dodge}
                aria-label={
                  s +
                  1 +
                  ' ' +
                  skill.name +
                  (casting ? '，施放中' : cd > 0 ? '，冷却' + cd.toFixed(1) + '秒' : '')
                }
                title={skill.effect + '\n' + skill.limit}
                {...press({ shadow_cast: s, focus: true })}
              >
                <span className="shadow-orb">
                  <InkRim value={progress} ultimate={skill.ultimate} />
                  <ShadowSkillArt skill={skill} />
                  {cd > 0 && !casting && <b className="shadow-cd">{Math.ceil(cd)}</b>}
                  {casting && <b className="shadow-casting">出招</b>}
                  <kbd>{s + 1}</kbd>
                  {skill.ultimate && <em>绝技</em>}
                </span>
                <span className="shadow-skill-name">{skill.name}</span>
              </Button>
            );
          })}
        </nav>
      </div>
      <p className="shadow-movement">
        <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd>
        <span>移步</span>
      </p>
      {!saved && (
        <p className="shadow-save" role="status">
          当前方案未能保存，仍可继续演武。
        </p>
      )}
      <dialog
        className="ink-dialog shadow-menu"
        ref={menu}
        aria-labelledby="shadow-menu-title"
        onCancel={(event) => {
          event.preventDefault();
          send({ action: 3, focus: true });
        }}
      >
        <span className="ink-seal" aria-hidden="true">
          演武
        </span>
        <InkHeading eyebrow="西游 · 皮影演武">
          <span id="shadow-menu-title">{(t?.elapsed ?? 0) < 1 ? '四式入卷' : '稍歇片刻'}</span>
        </InkHeading>
        <p className="shadow-menu-intro">
          {(t?.elapsed ?? 0) < 1 ? '选好四式，携五人共赴山河。' : '留一息从容，再续此行。'}
        </p>
        <div className="shadow-menu-equipped" aria-label="当前四式">
          {(hero?.loadout ?? readTrialLoadouts(null)[leader]).map((index, s) => (
            <div key={s} data-ultimate={pools[leader][index].ultimate}>
              <ShadowSkillArt skill={pools[leader][index]} />
              <span>
                <kbd>{s + 1}</kbd>
                {pools[leader][index].name}
              </span>
            </div>
          ))}
        </div>
        <p className="shadow-manual-hint">四式均由你出手 · 兵器技与绝技占用同样的槽位</p>
        <Button
          variant="primary"
          className="ink-main-action"
          onClick={() => send({ action: 3, focus: true })}
        >
          <InkGlyph name="play" />
          {(t?.elapsed ?? 0) < 1 ? '开始演武' : '继续演武'}
        </Button>
        <div className="shadow-menu-actions">
          <Button variant="quiet" onClick={open}>
            <InkGlyph name="scroll" />
            整备四式
          </Button>
          <Button variant="quiet" onClick={() => send({ shadow_restart: true, action: 2 })}>
            <InkGlyph name="replay" />
            重新演武
          </Button>
          <Button variant="quiet" onClick={onExit}>
            <InkGlyph name="back" />
            返回山河
          </Button>
        </div>
        <Button
          variant="quiet"
          className="shadow-motion"
          aria-pressed={motion}
          onClick={() => setMotion(!motion)}
        >
          <InkGlyph name="moon" />
          减少动态效果 <span>{motion ? '已开启' : '已关闭'}</span>
        </Button>
        <p className="shadow-menu-keys">
          <span>WASD 移步</span>
          <span>1–4 出招</span>
          <span>空格 闪避</span>
          <span>Q 换人</span>
        </p>
        <p className="shadow-menu-touch">左手移步 · 点按四式与闪避 · 头像换人</p>
      </dialog>
      <dialog
        className="ink-dialog shadow-workshop"
        ref={dialog}
        aria-labelledby="shadow-workshop-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <header className="shadow-workshop-header">
          <InkHeading eyebrow="每人十二式 · 自选四式">
            <span id="shadow-workshop-title">山河招式簿</span>
          </InkHeading>
          <Button variant="portrait" aria-label="完成整备" title="完成整备 · Esc" onClick={close}>
            <InkGlyph name="close" />
          </Button>
        </header>
        <nav className="shadow-choose-actor" aria-label="整备角色">
          {shadowActors.map((id, a) => (
            <Button
              key={id}
              variant="portrait"
              aria-label={'整备' + names[a]}
              aria-pressed={actor === a}
              onClick={() => {
                setActor(a);
                setSlot(0);
              }}
            >
              <img src={'/games/xiyou/assets/shadow/' + id + '/head.png'} alt="" />
              <span>{names[a]}</span>
            </Button>
          ))}
        </nav>
        <div className="shadow-book-body">
          <aside className="shadow-figure">
            <span className="shadow-figure-watermark" aria-hidden="true">
              {['禅', '齐天', '天蓬', '流沙', '龙吟'][actor]}
            </span>
            <img
              className="shadow-standee"
              src={'/games/xiyou/assets/shadow/' + shadowActors[actor] + '/standee.png?v=6.1'}
              alt={names[actor] + '游戏内皮影全身立绘'}
            />
            <h3>{names[actor]}</h3>
            <p>
              {
                [
                  '梵音护众 · 净秽救场',
                  '如意金箍 · 破阵镇岳',
                  '九齿天蓬 · 护身压阵',
                  '月牙降魔 · 流沙控场',
                  '龙吟剑潮 · 穿流破阵',
                ][actor]
              }
            </p>
          </aside>
          <section className="shadow-book-skills" aria-label="技能装备">
            <div className="shadow-slot-caption">
              <span>已携四式</span>
              <small>先选槽位，再选下方招式替换</small>
            </div>
            <nav className="shadow-edit-slots" aria-label="选择替换的槽位">
              {(t?.heroes[actor].loadout ?? readTrialLoadouts(null)[actor]).map((i, s) => (
                <Button
                  key={s}
                  variant="choice"
                  aria-pressed={slot === s}
                  onClick={() => setSlot(s)}
                >
                  <kbd>{s + 1}</kbd>
                  <ShadowSkillArt skill={pools[actor][i]} />
                  <span>{pools[actor][i].name}</span>
                </Button>
              ))}
            </nav>
            <div className="shadow-skill-pool" aria-label={names[actor] + '十二招'}>
              {pools[actor].map((skill, i) => {
                const equipped = t?.heroes[actor].loadout.indexOf(i) ?? -1;
                return (
                  <Button
                    key={skill.id}
                    variant="choice"
                    data-ultimate={skill.ultimate}
                    aria-label={'装备' + skill.name + '到第' + (slot + 1) + '槽'}
                    aria-pressed={equipped >= 0}
                    onClick={() => send({ action: 2, shadow_equip: [actor, slot, i] })}
                    title={skill.effect + '\n' + skill.limit}
                  >
                    <span className="shadow-pool-art">
                      <ShadowSkillArt skill={skill} />
                      {equipped >= 0 && <b className="shadow-equipped-index">{equipped + 1}</b>}
                      {skill.ultimate && <em>绝技</em>}
                    </span>
                    <strong>{skill.name}</strong>
                    <small>{skill.role}</small>
                  </Button>
                );
              })}
            </div>
            <div className="shadow-skill-detail" aria-live="polite">
              <div>
                <strong>{selected.name}</strong>
                <span>
                  {selected.ultimate ? '主动绝技 · ' : ''}冷却 {selected.rehearsal_cooldown} 秒
                </span>
              </div>
              <p>{selected.effect}</p>
              <small>{selected.limit}</small>
            </div>
          </section>
        </div>
        <footer className="shadow-workshop-footer">
          <span>已携招式再次选择时交换槽位 · 换招保留冷却</span>
          <Button variant="primary" onClick={close}>
            完成整备
            <InkGlyph name="back" />
          </Button>
        </footer>
      </dialog>
    </main>
  );
}
