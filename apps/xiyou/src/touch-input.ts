export type StickVector = { x: number; z: number };

// Screen right / up match the keyboard bridge; the camera transform stays in Rust.
export function stickVector(dx: number, dy: number, radius = 36): StickVector {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(radius) || radius <= 0)
    return { x: 0, z: 0 };
  const distance = Math.hypot(dx, dy);
  const dead = radius * 0.16;
  if (distance <= dead) return { x: 0, z: 0 };
  const strength = Math.min(1, (distance - dead) / (radius - dead));
  return { x: (dx / distance) * strength, z: (-dy / distance) * strength };
}
