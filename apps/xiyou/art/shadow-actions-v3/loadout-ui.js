// Included inside the GLB viewer's module by prepare_preview.py.
const director = new SkillDirector(book, readSaved());
let practice = false,
  autoSlots = false,
  nextSlot = 0,
  selectedSlot = 0,
  visibleCast = 0;
let gap = 0,
  lastSlotPaint = -1;
qa.loadouts = director.loadouts;
qa.directorEvents = [];
function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(book.storage_key) ?? 'null');
  } catch {
    return null;
  }
}
function saveLoadouts() {
  try {
    localStorage.setItem(book.storage_key, JSON.stringify(director.serialize()));
    $('#equipment-status').textContent = '五人方案已保存在本机 · 20 / 20 槽';
  } catch {
    $('#equipment-status').textContent = '当前方案可用，浏览器未允许保存；关闭后可能丢失。';
  }
}
function endPractice() {
  practice = autoSlots = false;
  director.paused = true;
  for (const actor of director.casts.keys()) director.cancel(actor);
  $('#practice').setAttribute('aria-pressed', 'false');
}
function updateEquipButton() {
  const entry = book.entries.find((e) => e.id === current?.record.id + '.' + spec?.clip);
  const usable = entry?.kind === 'active';
  $('#equip').disabled = !usable;
  $('#equip').textContent = usable
    ? `把「${entry.name}」装入第 ${selectedSlot + 1} 槽`
    : '被动、连携与妖怪招式不占主角技能槽';
}
function renderSlots() {
  const actor = current?.record.id,
    slots = director.loadouts[actor];
  $('#loadout').hidden = !slots;
  $('#templates').hidden = actor !== 'wukong';
  const film = $('#film');
  film.pause();
  $('#film-panel').hidden = true;
  $('#film-toggle').setAttribute('aria-expanded', 'false');
  $('#film-toggle').disabled = !slots;
  if (slots) {
    film.src = `/assets/${actor}/new-actions.webm`;
    film.poster =
      '/assets/' + book.entries.find((e) => e.actor === actor && e.new_in === 3).motion.thumbnail;
  } else film.removeAttribute('src');
  if (!slots) return;
  const nav = $('#slots');
  nav.replaceChildren();
  slots.forEach((id, i) => {
    const entry = director.entries.get(id),
      button = document.createElement('button');
    button.className = 'series-button series-button--portrait slot';
    button.type = 'button';
    button.dataset.slot = String(i);
    button.setAttribute('aria-label', `第 ${i + 1} 槽 ${entry.name}，点击施展`);
    const img = document.createElement('img');
    img.src = '/assets/' + entry.motion.thumbnail;
    img.alt = '';
    const title = document.createElement('strong');
    title.textContent = `${i + 1} · ${entry.name}`;
    const cd = document.createElement('span');
    cd.className = 'slot-cooldown';
    cd.setAttribute('aria-hidden', 'true');
    button.append(img, title, cd);
    button.onclick = () => castSlot(i);
    nav.append(button);
  });
  $('#slot-choice').value = String(selectedSlot);
  updateEquipButton();
  paintSlots(true);
  for (const b of $('#party').children)
    b.setAttribute('aria-pressed', String(b.dataset.actor === actor));
}
function paintSlots(force = false) {
  if (!current) return;
  qa.practice = {
    active: practice,
    automatic: autoSlots,
    elapsed: director.elapsed,
    paused: director.paused,
    cast: director.casts.get(current.record.id)?.id ?? null,
  };
  const stamp = Math.floor(director.elapsed * 10);
  if (!force && stamp === lastSlotPaint) return;
  lastSlotPaint = stamp;
  for (const button of $('#slots').children) {
    const slot = Number(button.dataset.slot),
      id = director.loadouts[current.record.id]?.[slot];
    const left = director.remaining(id),
      entry = director.entries.get(id);
    const cover = button.querySelector('.slot-cooldown');
    cover.textContent = left > 0.05 ? left.toFixed(1) + 's' : '';
    button.disabled = practice && (left > 0.05 || director.casts.has(current.record.id));
    button.setAttribute(
      'aria-label',
      `第 ${slot + 1} 槽 ${entry?.name}，${left > 0.05 ? '冷却 ' + left.toFixed(1) + ' 秒' : '可以施展'}`,
    );
  }
}
function castSlot(i) {
  const actor = current?.record.id;
  if (!director.loadouts[actor]) return;
  practice = true;
  autoSlots = false;
  paused = false;
  director.paused = false;
  if (director.cast(actor, i)) {
    const cast = director.casts.get(actor);
    visibleCast = cast.token;
    selectModule(
      current.record.modules.find((s) => s.clip === cast.skill.clip),
      true,
      true,
      true,
    );
  }
  paintSlots(true);
}
function practiceTick(dt) {
  director.paused = paused;
  director.tick(dt);
  const events = director.drain();
  for (const event of events) {
    qa.directorEvents.push(event);
    if (qa.directorEvents.length > 160) qa.directorEvents.shift();
    if (event.type === 'cast_end' && event.actor === current?.record.id) gap = 0.24;
  }
  let cast = director.casts.get(current?.record.id);
  if (!cast && autoSlots && !paused) {
    gap = Math.max(0, gap - dt);
    if (!gap)
      for (let j = 0; j < 4; j++) {
        const slot = (nextSlot + j) % 4;
        if (director.cast(current.record.id, slot)) {
          nextSlot = (slot + 1) % 4;
          cast = director.casts.get(current.record.id);
          break;
        }
      }
  }
  if (cast) {
    if (visibleCast !== cast.token) {
      visibleCast = cast.token;
      selectModule(
        current.record.modules.find((s) => s.clip === cast.skill.clip),
        false,
        true,
        true,
      );
    }
    time = cast.time;
    sample();
  } else if (spec) {
    time = spec.duration;
    sample();
  }
  paintSlots();
}
for (const actor of Object.keys(book.defaults)) {
  const record = records.find((r) => r.id === actor),
    button = document.createElement('button');
  button.className = 'series-button series-button--portrait party-portrait';
  button.type = 'button';
  button.dataset.actor = actor;
  button.setAttribute('aria-label', `选择${record.name}，已装备 4 个技能`);
  const img = document.createElement('img');
  img.src = `/assets/${actor}/parts/head.png`;
  img.alt = '';
  const label = document.createElement('span');
  label.textContent = record.name;
  button.append(img, label);
  button.onclick = async () => {
    endPractice();
    $('#character').value = actor;
    await selectCharacter(actor);
  };
  $('#party').append(button);
}
$('#slot-choice').onchange = (e) => {
  selectedSlot = Number(e.target.value);
  updateEquipButton();
};
$('#equip').onclick = () => {
  endPractice();
  paused = true;
  pausedUI();
  director.paused = true;
  const result = director.equip(
    current.record.id,
    selectedSlot,
    current.record.id + '.' + spec.clip,
  );
  if (result.ok) {
    saveLoadouts();
    renderSlots();
  } else $('#equipment-status').textContent = result.reason;
};
$('#practice').onclick = () => {
  if (practice && autoSlots) {
    paused = true;
    pausedUI();
    endPractice();
    paintSlots(true);
    return;
  }
  practice = autoSlots = true;
  nextSlot = 0;
  gap = 0;
  paused = false;
  pausedUI();
  director.paused = false;
  $('#practice').setAttribute('aria-pressed', 'true');
};
$('#new-loadout').onclick = () => {
  endPractice();
  paused = true;
  pausedUI();
  book.entries
    .filter((e) => e.actor === current.record.id && e.new_in === 3)
    .forEach((e, slot) => director.equip(e.actor, slot, e.id));
  saveLoadouts();
  renderSlots();
};
$('#film-toggle').onclick = () => {
  const panel = $('#film-panel');
  panel.hidden = !panel.hidden;
  $('#film-toggle').setAttribute('aria-expanded', String(!panel.hidden));
  paused = true;
  pausedUI();
  director.paused = true;
  if (panel.hidden) $('#film').pause();
};
const templates = {
  棍法强攻: ['StaffSweep', 'StaffThrust', 'BackSweep', 'CrashingCloud'],
  分身指挥: ['HairClone', 'FreezeSeal', 'FlameGaze', 'MonkeyCommand'],
  游斗反击: ['CloudFeint', 'StaffGuard', 'ReturningStaff', 'StoneShell'],
};
for (const [name, clips] of Object.entries(templates)) {
  const button = document.createElement('button');
  button.className = 'series-button series-button--secondary';
  button.type = 'button';
  button.textContent = name;
  button.onclick = () => {
    endPractice();
    paused = true;
    pausedUI();
    clips.forEach((clip, slot) => director.equip('wukong', slot, 'wukong.' + clip));
    saveLoadouts();
    renderSlots();
  };
  $('#templates').append(button);
}
document.addEventListener('keydown', (e) => {
  if (e.repeat || e.target.closest('input,select,textarea')) return;
  if (/^[1-4]$/.test(e.key)) {
    e.preventDefault();
    castSlot(Number(e.key) - 1);
  }
});
saveLoadouts();
