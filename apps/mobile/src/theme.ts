// Design tokens. Dark, layered "fintech" palette — surfaces stack from bg →
// card → cardAlt for depth, and each semantic color has a soft tint used for
// pills, chips, and selected states. Existing keys are preserved so every
// screen inherits the uplift without changes.
export const colors = {
  // Layered surfaces (darkest → lightest)
  bg: '#080B16',
  bgElevated: '#0E1324',
  card: '#141B31',
  cardAlt: '#1B2340',
  border: '#252E4E',
  borderStrong: '#354063',

  // Text
  text: '#F5F7FF',
  muted: '#8A96C4',
  faint: '#525E8C',

  // Accent (periwinkle indigo)
  accent: '#6C8CFF',
  accentText: '#FFFFFF',
  accentSoft: 'rgba(108,140,255,0.14)',
  accentBorder: 'rgba(108,140,255,0.45)',

  // Semantic
  positive: '#3DDC97',
  positiveSoft: 'rgba(61,220,151,0.14)',
  negative: '#FF6B81',
  negativeSoft: 'rgba(255,107,129,0.14)',
  warning: '#FFB454',
  warningSoft: 'rgba(255,180,84,0.14)',
  danger: '#FF6B81',
};

// Vibrant gradients — the signature of the look. Used on CTAs, hero cards,
// avatars, and balance bars. Tuples are [start, end] for LinearGradient.
export const gradients = {
  brand: ['#6C8CFF', '#A66BFF'] as const, // indigo → violet (primary)
  brandBright: ['#5D7BFF', '#C061FF'] as const,
  positive: ['#34E0A1', '#12B981'] as const, // you're owed
  negative: ['#FF6B81', '#FF9563'] as const, // you owe
  aqua: ['#4CC9F0', '#4361EE'] as const,
  sunset: ['#FF8A5B', '#FF6B81'] as const,
  hero: ['#1C2547', '#141B31', '#10162B'] as const, // card sheen
};

// Deterministic vivid color pairs for avatars / group accents.
export const vivid = [
  ['#6C8CFF', '#A66BFF'],
  ['#34E0A1', '#12B981'],
  ['#FF8A5B', '#FF6B81'],
  ['#4CC9F0', '#4361EE'],
  ['#FFB454', '#FF7E5F'],
  ['#B57BFF', '#7C4DFF'],
] as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const font = {
  h1: 28,
  h2: 20,
  h3: 16,
  body: 15,
  small: 13,
  tiny: 11,
} as const;

export const spacing = (n: number) => n * 8;

// A palette to color member avatars deterministically by id/name.
export const avatarPalette = ['#6C8CFF', '#3DDC97', '#FFB454', '#FF6B81', '#B57BFF', '#4CC9F0'];
