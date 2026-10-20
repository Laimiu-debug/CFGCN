import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Button } from '@cfgcn/ui';

// Local inspection control. It captures this game's rendered canvas only.
export function TrialRecorder({
  frame,
  performance: stats,
  position,
}: {
  frame: RefObject<HTMLIFrameElement | null>;
  performance?: {
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
  position?: { x: number; z: number };
}) {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const record = () => {
    const canvas = frame.current?.contentDocument?.querySelector('canvas');
    if (!canvas || typeof MediaRecorder === 'undefined') {
      setError('当前浏览器不支持场景录制');
      return;
    }
    const stream = canvas.captureStream(24);
    const type = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';
    const media = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4_000_000 });
    recorder.current = media;
    const chunks: BlobPart[] = [];
    media.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      setUrl(URL.createObjectURL(new Blob(chunks, { type })));
      setRecording(false);
    };
    media.onerror = () => {
      setError('录制未完成');
      setRecording(false);
    };
    media.start(500);
    setRecording(true);
    setError('');
    setTimeout(() => {
      if (media.state === 'recording') media.stop();
    }, 8000);
  };
  return (
    <aside className="shadow-recorder" aria-label="本机场景录像检视">
      <output className="shadow-frame-proof" aria-label="实际游戏帧采样">
        {stats &&
          `游戏 ${stats.fps.toFixed(1)} 帧/秒 · P95 ${stats.p95_ms.toFixed(1)} ms · 最长 ${stats.max_ms.toFixed(1)} ms · 超50ms ${stats.over_50}/${stats.samples} · 模拟 ${stats.simulation_ms.toFixed(2)} ms · 角色 ${stats.entities} · 特效 ${stats.effects} · 地块 ${stats.cells}`}
        {position && ` · 位置 ${position.x.toFixed(3)}, ${position.z.toFixed(3)}`}
      </output>
      <Button
        variant="secondary"
        onPointerDown={(event) => event.preventDefault()}
        onClick={record}
        disabled={recording}
      >
        {recording ? '正在录制八秒场景…' : '录制八秒演武'}
      </Button>
      {error && <span role="status">{error}</span>}
      {url && (
        <>
          <video controls playsInline src={url} aria-label="刚录制的游戏场景" />
          <a className="shadow-record-download" href={url} download="xiyou-five-shadow-trial.webm">
            保存演武录像
          </a>
        </>
      )}
    </aside>
  );
}
