// Every fact here comes from PRODUCT.md. Card label and color are a generic rarity (user's choice).
export const TYPES = {
  common: { label: 'Common', color: '#C9D3E0' },
  uncommon: { label: 'Uncommon', color: '#37D99E' },
  rare: { label: 'Rare', color: '#45A6FF' },
  epic: { label: 'Epic', color: '#9B6DFF' },
  legendary: { label: 'Legendary', color: '#FFD447' },
};

// Lowest to highest; card art and the pips under it use this order.
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// The real projects, kept for when the templates get replaced.
// Newest first. `no` is the collector number: the order they were built in.
export const REAL_PROJECTS = [
  {
    id: 'marginalia',
    no: 8,
    title: 'Marginalia',
    type: 'common',
    month: 'Sep 2026',
    stack: 'Swift, SwiftUI',
    stat: { big: '3', small: 'ways to run a pass' },
    blurb: 'Claude reads photos of my book pages and suggests highlights, stars and margin notes. Marginalia turns that reply into a full-screen pass I follow one step at a time, pen in hand.',
    facts: [
      'Page by page, highlights first, or one color at a time',
      'Move on with a key, a click, a tap or a two-finger swipe',
      'Highlights fill the screen in the highlighter’s own color',
    ],
    art: 'Book page with yellow, green and blue highlighter strokes, a star and a pen note in the margin',
  },
  {
    id: 'wps-clubs',
    no: 7,
    title: 'WPS Clubs',
    type: 'uncommon',
    month: 'Sep 2026',
    stack: 'Next.js, Supabase, Cloudflare',
    stat: { big: '3', small: 'views: grid, list, week' },
    blurb: 'The clubs directory for WPS. Sign in with your school email, join clubs and see what meets this week.',
    facts: [
      'Rebuilt in September: a photo mosaic sized by membership',
      'A week board up top shows what meets each day',
      'Runs on Cloudflare Workers',
    ],
    art: 'A mosaic of blue tiles in different sizes under a five-day week board',
  },
  {
    id: 'roblox',
    no: 6,
    title: 'Roblox Games',
    type: 'epic',
    month: 'Sep 2026',
    stack: 'Luau, Roblox Studio',
    stat: { big: '60', small: 'layers to dig through' },
    blurb: 'Two games built by driving Roblox Studio from Claude. Find The Diamond is a meme mining game; Neon Obby is ten glowing stages.',
    facts: [
      'Find The Diamond: 7 rarity bands, 27 collectible characters, bases people can steal from',
      'Neon Obby: tag-driven obstacles and 23 unit tests',
      'Both unpublished for now',
    ],
    art: 'Seven colored rock layers with a diamond at the bottom and neon platforms floating above',
  },
  {
    id: 'atlas',
    no: 5,
    title: 'Atlas',
    type: 'uncommon',
    month: 'Aug 2026',
    stack: 'TypeScript, GitHub Actions',
    stat: { big: '186', small: 'tests' },
    blurb: 'Free code explanations for GitHub that run on your own API key. Every pull request gets a plain-English summary and inline notes on the lines that need them.',
    facts: [
      'The web app explores any repo in your browser',
      'Your key never leaves your browser or your repo',
      'Works with Claude or Gemini',
    ],
    art: 'A dark code editor with one added line and an Atlas note explaining it',
  },
  {
    id: 'sixteen-hundred',
    no: 4,
    title: '1600',
    type: 'rare',
    month: 'Aug 2026',
    stack: 'Expo',
    stat: { big: '3,700+', small: 'real SAT questions' },
    blurb: 'SAT practice built only on real College Board questions, never AI-written ones. Drill one skill, or sit a full adaptive test and get an estimated score.',
    facts: [
      '29 skills to drill',
      '10 full adaptive practice tests',
      'XP, streaks and combos',
    ],
    art: 'A big 1600 on blue with four answer choices, one marked right',
  },
  {
    id: 'quick-math',
    no: 3,
    title: 'Quick Math',
    type: 'rare',
    month: 'Aug 2026',
    stack: 'SwiftUI',
    stat: { big: '2', small: 'themes: Arcade and Precision' },
    blurb: 'Mental math drills. Pick the operation and how many digits each number gets, then answer the cards as they slide up.',
    facts: [
      'A fixed number of questions, or a countdown on each one',
      'Multiple choice or a number pad',
      'Native SwiftUI with no outside libraries',
    ],
    art: 'A stack of question cards reading 47 × 6 above a number pad',
  },
  {
    id: 'arise',
    no: 2,
    title: 'Arise',
    type: 'rare',
    month: 'Jul 2026',
    stack: 'Expo, HealthKit, Vision',
    stat: { big: '211', small: 'tests' },
    blurb: 'A leveling system for real life, after Solo Leveling. Daily quests earn XP and rank, and it tracks food, weight and workouts.',
    facts: [
      'Log food by barcode, or snap a photo and Gemini logs it',
      'Counts reps with camera pose tracking',
      'Syncs with Apple Health',
    ],
    art: 'A glowing blue system window listing a daily quest',
  },
  {
    id: 'first-python',
    no: 1,
    title: 'First Python',
    type: 'legendary',
    month: '2025',
    stack: 'Python',
    stat: { big: '363', small: 'bytes: the first Block Invaders' },
    blurb: 'Where it started: a home folder full of Python. A gas calculator and Harry Potter classes first, then games.',
    facts: [
      'blockInvaders.py was 363 bytes at 2:35 pm on June 16, 2025',
      'blockinvaders-2.0.py was 4,344 bytes by 11:30 pm the same day',
      'Then breakout.py, a raycasting 3D game and snake.html',
    ],
    art: 'A yellow pixel space invader and a blue pixel snake',
  },
];

// TEMPLATE: placeholder cards shown on the site for now. Replace each entry with a
// real project (or set USE_TEMPLATES to false to show REAL_PROJECTS above).
export const USE_TEMPLATES = true;

const TEMPLATE_TYPES = ['legendary', 'rare', 'uncommon', 'epic', 'common', 'rare', 'uncommon', 'common'];
const NUMBER_WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

export const TEMPLATE_PROJECTS = TEMPLATE_TYPES.map((type, i) => ({
  id: `template-${i + 1}`,
  no: 8 - i,
  title: `Project ${NUMBER_WORDS[i]}`,
  type,
  month: 'Month 2026',
  stack: 'Stack goes here',
  stat: { big: '00', small: 'your best number here' },
  blurb: 'Template. Write one or two sentences about what this project does and who it is for.',
  facts: [
    'First detail worth knowing',
    'Second detail worth knowing',
    'Third detail worth knowing',
  ],
  art: `placeholder art: a ${TYPES[type].label.toLowerCase()} gem`,
  template: true,
}));

export const PROJECTS = USE_TEMPLATES ? TEMPLATE_PROJECTS : REAL_PROJECTS;
