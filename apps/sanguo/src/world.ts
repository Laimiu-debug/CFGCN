import type { WorldDefinition } from '@cfgcn/shared';

export const world = {
  id: 'sanguo',
  number: '03',
  title: {
    'zh-CN': '三国演义',
    'zh-TW': '三國演義',
    en: 'Three Kingdoms',
  },
  englishTitle: 'ROMANCE OF THE THREE KINGDOMS',
  subtitle: {
    'zh-CN': '天下如局，落子由你',
    'zh-TW': '天下如局，落子由你',
    en: 'A realm of possibilities. Your move.',
  },
  invitation: {
    'zh-CN': '山河为局，谁定乾坤。',
    'zh-TW': '山河為局，誰定乾坤。',
    en: 'Across rivers and kingdoms, shape your own fate.',
  },
  description: {
    'zh-CN':
      '城关、江流与群雄，铺成一卷波澜壮阔的天下。于人才、粮草与联盟之间运筹，寻找属于自己的破局之道。',
    'zh-TW':
      '城關、江流與群雄，鋪成一卷波瀾壯闊的天下。於人才、糧草與聯盟之間運籌，尋找屬於自己的破局之道。',
    en: 'A river winds between ancient fortresses and rival lords. Weigh talent, provisions and alliances to find your own way through a changing realm.',
  },
  genre: {
    'zh-CN': '策略 · 群雄逐鹿',
    'zh-TW': '策略 · 群雄逐鹿',
    en: 'Strategy · Rival kingdoms',
  },
  place: {
    'zh-CN': '秋染城关，江流入远',
    'zh-TW': '秋染城關，江流入遠',
    en: 'An autumn river beneath an ancient fortress',
  },
  features: {
    'zh-CN': [
      '识人用人，在群雄之间寻找同道',
      '谋略与取舍，比单纯的强弱更重要',
      '区域策略与异步阵容玩法，方向尚在酝酿',
    ],
    'zh-TW': [
      '識人用人，在群雄之間尋找同道',
      '謀略與取捨，比單純的強弱更重要',
      '區域策略與非同步陣容玩法，方向尚在醞釀',
    ],
    en: [
      'Discover the people who can change the fate of a realm',
      'Make meaningful choices about resources and alliances',
      'Regional strategy and asynchronous formations are being explored',
    ],
  },
  accent: 'var(--accent-sanguo)',
  image: '/art/sanguo.webp',
} satisfies WorldDefinition;
