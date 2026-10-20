import type { WorldDefinition } from '@cfgcn/shared';

export const world = {
  id: 'xiyou',
  number: '01',
  title: {
    'zh-CN': '西游记',
    'zh-TW': '西遊記',
    en: 'Journey to the West',
  },
  englishTitle: 'JOURNEY TO THE WEST',
  subtitle: {
    'zh-CN': '西行万里，修得本领',
    'zh-TW': '西行萬里，修得本領',
    en: 'A long road. An extraordinary journey.',
  },
  invitation: {
    'zh-CN': '一念起，万水千山。',
    'zh-TW': '一念起，萬水千山。',
    en: 'Every great journey begins with a single step.',
  },
  description: {
    'zh-CN':
      '从唐僧独行启程，在五行山救出悟空。师徒自动协作、共享灵光，由你分配修习，沿着三段初程西行。',
    'zh-TW':
      '從唐僧獨行啟程，在五行山救出悟空。師徒自動協作、共享靈光，由你分配修習，沿著三段初程西行。',
    en: 'Begin as Tang Sanzang and free Wukong beneath Five Elements Mountain. Lead the party, share wisdom and choose each companion’s arts across three stretches of the eastern road.',
  },
  genre: {
    'zh-CN': '动作 · 流派构筑',
    'zh-TW': '動作 · 流派構築',
    en: 'Action · Buildcraft',
  },
  place: {
    'zh-CN': '云海仙山，西行之路',
    'zh-TW': '雲海仙山，西行之路',
    en: 'A mountain path above a sea of clouds',
  },
  features: {
    'zh-CN': [
      '唐僧独行起步，五行山解封悟空',
      '单人带领整队，伙伴自动随行与迎敌',
      '共享灵光，选择培养对象与角色本领',
    ],
    'zh-TW': [
      '唐僧獨行起步，五行山解封悟空',
      '單人帶領整隊，夥伴自動隨行與迎敵',
      '共享靈光，選擇培養對象與角色本領',
    ],
    en: [
      'Start alone as Sanzang and free Wukong at Five Elements Mountain',
      'Lead the party while companions follow and fight automatically',
      'Share wisdom and choose whom to train and which art to learn',
    ],
  },
  accent: 'var(--accent-xiyou)',
  image: '/art/xiyou.webp',
} satisfies WorldDefinition;
