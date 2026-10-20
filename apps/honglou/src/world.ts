import type { WorldDefinition } from '@cfgcn/shared';

export const world = {
  id: 'honglou',
  number: '04',
  title: {
    'zh-CN': '红楼梦',
    'zh-TW': '紅樓夢',
    en: 'Dream of the Red Chamber',
  },
  englishTitle: 'DREAM OF THE RED CHAMBER',
  subtitle: {
    'zh-CN': '一园春色，万般人情',
    'zh-TW': '一園春色，萬般人情',
    en: 'A garden of stories. A world of human feeling.',
  },
  invitation: {
    'zh-CN': '花开有时，人间有情。',
    'zh-TW': '花開有時，人間有情。',
    en: 'Every blossom has its season. Every encounter, a story.',
  },
  description: {
    'zh-CN':
      '步入大观园，在诗会、宴席与节令中结识园中人。安排一日的府中事务，也照看那些难以用银钱衡量的心事。',
    'zh-TW':
      '步入大觀園，在詩會、宴席與節令中結識園中人。安排一日的府中事務，也照看那些難以用銀錢衡量的心事。',
    en: 'Step into a garden of poetry, gatherings and changing seasons. Care for a household and the relationships that no ledger can fully describe.',
  },
  genre: {
    'zh-CN': '经营 · 人情叙事',
    'zh-TW': '經營 · 人情敘事',
    en: 'Management · Narrative',
  },
  place: {
    'zh-CN': '花影大观园，一池春水',
    'zh-TW': '花影大觀園，一池春水',
    en: 'Blossoms, a moon gate and a quiet garden pond',
  },
  features: {
    'zh-CN': [
      '安排府中事务，让银钱与人手各得其所',
      '筹办诗会与宴席，体会人情的微妙',
      '沿着人物关系与节令，展开园中的故事',
    ],
    'zh-TW': [
      '安排府中事務，讓銀錢與人手各得其所',
      '籌辦詩會與宴席，體會人情的微妙',
      '沿著人物關係與節令，展開園中的故事',
    ],
    en: [
      "Balance the household's resources and daily needs",
      'Host poetry gatherings and understand the people around you',
      'Discover stories woven through relationships and seasons',
    ],
  },
  accent: 'var(--accent-honglou)',
  image: '/art/honglou.webp',
} satisfies WorldDefinition;
