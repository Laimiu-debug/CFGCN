// Deterministic action scheduling. Rendering and combat consumers receive the
// same release events; receiving an event alone never implies a successful hit.
export function restoreLoadouts(book, saved) {
  const result = structuredClone(book.defaults);
  if (saved?.version !== 1 || !saved.loadouts || typeof saved.loadouts !== 'object') return result;
  for (const actor of Object.keys(result)) {
    const pool = new Set(
      book.entries.filter((e) => e.actor === actor && e.kind === 'active').map((e) => e.id),
    );
    const list = saved.loadouts[actor];
    if (
      Array.isArray(list) &&
      list.length === 4 &&
      new Set(list).size === 4 &&
      list.every((id) => pool.has(id))
    )
      result[actor] = [...list];
  }
  return result;
}

export class SkillDirector {
  constructor(book, saved) {
    this.entries = new Map(book.entries.filter((e) => e.kind === 'active').map((e) => [e.id, e]));
    this.loadouts = restoreLoadouts(book, saved);
    this.clocks = new Map();
    this.casts = new Map();
    this.paused = true;
    this.elapsed = 0;
    this.sequence = 0;
    this.events = [];
  }
  equip(actor, slot, id) {
    if (!this.paused) return { ok: false, reason: '先暂停演练再整备' };
    if (
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot > 3 ||
      !this.loadouts[actor] ||
      this.entries.get(id)?.actor !== actor
    )
      return { ok: false, reason: '技能不属于这个角色' };
    const list = this.loadouts[actor];
    const existing = list.indexOf(id);
    // A skill already in another slot swaps with the selected slot. It cannot
    // duplicate a skill, discard a slot, or reset that skill's cooldown.
    if (existing >= 0) [list[slot], list[existing]] = [list[existing], list[slot]];
    else list[slot] = id;
    return { ok: true };
  }
  cast(actor, slot) {
    const id = this.loadouts[actor]?.[slot];
    const skill = this.entries.get(id);
    if (!skill || this.paused || this.casts.has(actor) || this.remaining(id) > 0) return false;
    const cast = { actor, id, skill, time: 0, eventIndex: 0, token: ++this.sequence };
    this.casts.set(actor, cast);
    this.clocks.set(id, this.elapsed + skill.rehearsal_cooldown);
    this.events.push({ type: 'cast_start', actor, id, token: cast.token, time: this.elapsed });
    return true;
  }
  tick(dt) {
    if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
    // Bound a suspended tab's catch-up. Consumers resume the current action;
    // they never compress many seconds of releases into one visible frame.
    dt = Math.min(dt, 0.1);
    this.elapsed += dt;
    for (const [actor, cast] of this.casts) {
      cast.time = Math.min(cast.time + dt, cast.skill.motion.duration);
      const events = cast.skill.motion.events;
      while (cast.eventIndex < events.length && events[cast.eventIndex].time <= cast.time + 1e-8) {
        const event = events[cast.eventIndex++];
        this.events.push({
          ...event,
          actor,
          id: cast.id,
          token: cast.token,
          castTime: event.time,
          time: this.elapsed,
        });
      }
      if (cast.time >= cast.skill.motion.duration) {
        this.events.push({
          type: 'cast_end',
          actor,
          id: cast.id,
          token: cast.token,
          time: this.elapsed,
        });
        this.casts.delete(actor);
      }
    }
  }
  remaining(id) {
    return Math.max(0, (this.clocks.get(id) ?? 0) - this.elapsed);
  }
  cancel(actor) {
    const cast = this.casts.get(actor);
    if (!cast) return;
    this.casts.delete(actor);
    this.events.push({
      type: 'cast_cancel',
      actor,
      id: cast.id,
      token: cast.token,
      time: this.elapsed,
    });
  }
  drain() {
    return this.events.splice(0);
  }
  serialize() {
    return { version: 1, loadouts: structuredClone(this.loadouts) };
  }
}
