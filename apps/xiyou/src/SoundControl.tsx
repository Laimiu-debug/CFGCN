import { useSyncExternalStore } from 'react';
import { getAudioStatus, subscribeAudioStatus, requestAudioToggle } from '@cfgcn/shared';
import type { Locale } from '@cfgcn/shared';
import { Button, Icon } from '@cfgcn/ui';

export function SoundControl({ locale }: { locale: Locale }) {
  const { enabled, busy } = useSyncExternalStore(subscribeAudioStatus, getAudioStatus);
  const labels = {
    'zh-CN': ['开启音乐与音效', '关闭音乐与音效'],
    'zh-TW': ['開啟音樂與音效', '關閉音樂與音效'],
    en: ['Enable music and sounds', 'Mute music and sounds'],
  }[locale];
  return (
    <Button
      variant="portrait"
      data-audio-toggle
      aria-label={labels[enabled ? 1 : 0]}
      title={labels[enabled ? 1 : 0]}
      aria-pressed={enabled}
      aria-busy={busy}
      disabled={busy}
      onClick={requestAudioToggle}
    >
      <Icon name={enabled ? 'volume' : 'mute'} size={20} />
    </Button>
  );
}
