import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SkillDirector, restoreLoadouts } from './director.mjs';
const book = JSON.parse(readFileSync(new URL('./skills.json', import.meta.url)));
const actors = Object.keys(book.defaults);
const advance = (d, seconds) => {
  for (let t = 0; t < seconds; t += 0.025) d.tick(0.025);
};

test('five independent twelve-skill pools equip exactly twenty distinct owner slots', () => {
  const d = new SkillDirector(book);
  for (const actor of actors) {
    assert.equal(book.entries.filter((e) => e.actor === actor && e.kind === 'active').length, 12);
    assert.equal(new Set(d.loadouts[actor]).size, 4);
  }
  assert.equal(Object.values(d.loadouts).flat().length, 20);
  assert.equal(d.equip('wukong', 0, 'tangseng.Chant').ok, false);
  assert.equal(d.equip('wukong', 4, 'wukong.StaffGuard').ok, false);
});
test('duplicate equipment swaps, saves validate per actor and do not touch campaign saves', () => {
  const d = new SkillDirector(book);
  const previous = [...d.loadouts.wukong];
  assert.ok(d.equip('wukong', 0, previous[1]).ok);
  assert.deepEqual(d.loadouts.wukong, [previous[1], previous[0], previous[2], previous[3]]);
  const saved = d.serialize();
  saved.loadouts.tangseng = ['wukong.StaffSweep'];
  assert.deepEqual(restoreLoadouts(book, saved).wukong, d.loadouts.wukong);
  assert.deepEqual(restoreLoadouts(book, saved).tangseng, book.defaults.tangseng);
  assert.deepEqual(restoreLoadouts(book, { version: 2, loadouts: {} }), book.defaults);
});
test('cooldowns belong to skill ids across equipment changes and pause freezes releases', () => {
  const d = new SkillDirector(book);
  d.paused = false;
  assert.ok(d.cast('wukong', 0));
  assert.equal(d.cast('wukong', 1), false);
  advance(d, 0.2);
  const time = d.elapsed,
    remaining = d.remaining('wukong.StaffSweep');
  d.paused = true;
  advance(d, 20);
  assert.equal(d.elapsed, time);
  assert.equal(d.remaining('wukong.StaffSweep'), remaining);
  assert.ok(d.equip('wukong', 0, 'wukong.ReturningStaff').ok);
  assert.ok(d.equip('wukong', 0, 'wukong.StaffSweep').ok);
  assert.equal(d.remaining('wukong.StaffSweep'), remaining);
  d.paused = false;
  advance(d, 1);
  assert.equal(d.cast('wukong', 0), false);
});
test('all sixty clips emit every timed release once and complete before the next body action', () => {
  for (const skill of book.entries.filter((e) => e.kind === 'active')) {
    const d = new SkillDirector(book);
    d.equip(skill.actor, 0, skill.id);
    d.paused = false;
    assert.ok(d.cast(skill.actor, 0), skill.id);
    assert.equal(d.equip(skill.actor, 1, skill.id).ok, false);
    advance(d, skill.motion.duration + 0.1);
    const events = d.drain();
    assert.deepEqual(
      events.filter((e) => !['cast_start', 'cast_end'].includes(e.type)).map((e) => e.type),
      skill.motion.events.map((e) => e.type),
      skill.id,
    );
    assert.equal(events.filter((e) => e.type === 'cast_start').length, 1);
    assert.equal(events.filter((e) => e.type === 'cast_end').length, 1);
    assert.equal(d.casts.size, 0);
    const clock = d.elapsed;
    d.tick(NaN);
    d.tick(-1);
    assert.equal(d.elapsed, clock);
  }
});
test('five actors can execute different chosen slots without stealing each others actions', () => {
  const d = new SkillDirector(book);
  d.paused = false;
  for (const actor of actors) assert.ok(d.cast(actor, 0));
  assert.equal(d.casts.size, 5);
  advance(d, 2);
  const events = d.drain();
  assert.equal(new Set(events.filter((e) => e.type === 'cast_start').map((e) => e.actor)).size, 5);
});
test('an interrupted rehearsal cannot emit later releases and keeps its spent cooldown', () => {
  const d = new SkillDirector(book);
  d.equip('wukong', 0, 'wukong.ReturningStaff');
  d.paused = false;
  assert.ok(d.cast('wukong', 0));
  advance(d, 0.2);
  d.cancel('wukong');
  const remaining = d.remaining('wukong.ReturningStaff');
  assert.ok(remaining > 0);
  advance(d, 1);
  const events = d.drain();
  assert.equal(events.filter((e) => e.type === 'staff_out').length, 0);
  assert.equal(events.filter((e) => e.type === 'cast_cancel').length, 1);
  assert.ok(d.remaining('wukong.ReturningStaff') > 0);
});
