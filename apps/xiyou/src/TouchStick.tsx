import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { stickVector } from './touch-input';
import type { StickVector } from './touch-input';

type Contact = { id: number; x: number; y: number; dx: number; dy: number };

export function TouchStick({
  enabled,
  label,
  onMove,
}: {
  enabled: boolean;
  label: string;
  onMove: (vector: StickVector) => void;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const pointer = useRef<Contact | null>(null);
  const pending = useRef<number | null>(null);
  const move = useRef(onMove);
  move.current = onMove;
  const [contact, setContact] = useState<Contact | null>(null);
  const stop = useCallback(() => {
    if (pending.current !== null) cancelAnimationFrame(pending.current);
    pending.current = null;
    const current = pointer.current;
    pointer.current = null;
    if (current && zone.current?.hasPointerCapture(current.id))
      zone.current.releasePointerCapture(current.id);
    setContact(null);
    if (current) move.current({ x: 0, z: 0 });
  }, []);
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('resize', stop);
    return () => {
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('resize', stop);
      stop();
    };
  }, [stop]);
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    current.dx = event.clientX - bounds.left - current.x;
    current.dy = event.clientY - bounds.top - current.y;
    if (pending.current !== null) return;
    pending.current = requestAnimationFrame(() => {
      pending.current = null;
      if (pointer.current !== current) return;
      setContact({ ...current });
      move.current(stickVector(current.dx, current.dy));
    });
  };
  const length = contact ? Math.hypot(contact.dx, contact.dy) : 0;
  const limit = length > 36 ? 36 / length : 1;
  const x = contact?.x ?? '50%';
  const y = contact?.y ?? '65%';
  return (
    <div
      ref={zone}
      className="xiyou-touch-stick"
      role="group"
      aria-label={label}
      aria-disabled={!enabled}
      data-active={Boolean(contact)}
      onPointerDown={(event) => {
        if (!enabled || pointer.current || event.button !== 0) return;
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        pointer.current = {
          id: event.pointerId,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
          dx: 0,
          dy: 0,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setContact({ ...pointer.current });
        move.current({ x: 0, z: 0 });
      }}
      onPointerMove={update}
      onPointerUp={(event) => {
        if (event.pointerId === pointer.current?.id) stop();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === pointer.current?.id) stop();
      }}
      onLostPointerCapture={(event) => {
        if (event.pointerId === pointer.current?.id) stop();
      }}
    >
      <svg aria-hidden="true" width="100%" height="100%">
        <circle className="xiyou-stick-wash" cx={x} cy={y} r="44" />
        <circle className="xiyou-stick-ring" cx={x} cy={y} r="36" />
        <circle
          className="xiyou-stick-thumb"
          cx={contact ? contact.x + contact.dx * limit : x}
          cy={contact ? contact.y + contact.dy * limit : y}
          r="17"
        />
      </svg>
    </div>
  );
}
