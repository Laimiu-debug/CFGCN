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
    'zh-CN': '踏过云海与仙山，与师徒一同西行。让七十二变、法宝与一场场奇遇，成就你自己的取经路。',
    'zh-TW': '踏過雲海與仙山，與師徒一同西行。讓七十二變、法寶與一場場奇遇，成就你自己的取經路。',
    en: 'Follow the mountain path beyond the clouds. Discover transformations, magical treasures and unexpected encounters on a journey west.',
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
      '七十二变与法宝，组合自己的本领',
      '护送师父，在清怪与守护之间取舍',
      '一难一关，与山川洞府中的妖王相遇',
    ],
    'zh-TW': [
      '七十二變與法寶，組合自己的本領',
      '護送師父，在清怪與守護之間取捨',
      '一難一關，與山川洞府中的妖王相遇',
    ],
    en: [
      'Discover your own combinations of transformations and treasures',
      'Balance the fight ahead with protecting your companions',
      'Explore a new trial, landscape and legendary foe in each chapter',
    ],
  },
  accent: '#4d7056',
  image: '/art/xiyou.webp',
} satisfies WorldDefinition;
