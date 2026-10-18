import type { WorldDefinition } from '@cfgcn/shared';

export const world = {
  id: 'shuihu',
  number: '02',
  title: {
    'zh-CN': '水浒传',
    'zh-TW': '水滸傳',
    en: 'Water Margin',
  },
  englishTitle: 'WATER MARGIN',
  subtitle: {
    'zh-CN': '水泊聚义，与子同袍',
    'zh-TW': '水泊聚義，與子同袍',
    en: 'Find your companions. Stand together.',
  },
  invitation: {
    'zh-CN': '江湖路远，幸有同袍。',
    'zh-TW': '江湖路遠，幸有同袍。',
    en: 'A wide world is warmer with companions.',
  },
  description: {
    'zh-CN':
      '一叶舟入梁山泊，遇见各有性情的江湖好汉。亲手排兵、借势地形，在一场场战斗中写下彼此的义气。',
    'zh-TW':
      '一葉舟入梁山泊，遇見各有性情的江湖好漢。親手排兵、借勢地形，在一場場戰鬥中寫下彼此的義氣。',
    en: 'Cross the quiet waters of Liangshan and find a band of unlikely heroes. Plan every move, read the terrain and turn loyalty into action.',
  },
  genre: {
    'zh-CN': '战棋 · 小队协作',
    'zh-TW': '戰棋 · 小隊協作',
    en: 'Tactics · Companions',
  },
  place: {
    'zh-CN': '烟波梁山，英雄聚处',
    'zh-TW': '煙波梁山，英雄聚處',
    en: 'Liangshan stronghold above a misty lake',
  },
  features: {
    'zh-CN': [
      '结识好汉，让性格与本领形成配合',
      '亲手指挥小队，借地形赢得战局',
      '援护与救援，让义气成为真实选择',
    ],
    'zh-TW': [
      '結識好漢，讓性格與本領形成配合',
      '親手指揮小隊，借地形贏得戰局',
      '援護與救援，讓義氣成為真實選擇',
    ],
    en: [
      'Build a company with complementary talents and personalities',
      'Command each move and make the landscape your ally',
      'Choose when to risk everything for a companion',
    ],
  },
  accent: '#426e78',
  image: '/art/shuihu.webp',
} satisfies WorldDefinition;
