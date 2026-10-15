// All copy and timing for the intro lives here. Times are in seconds.
export const config = {
  width: 2560,
  height: 1600,
  fps: 30,
  duration: 30,

  title: 'JURY',
  subtitle: 'SITE REVIEWS FROM THE AWWWARDS JURY PANEL',
  author: 'ARTEMII LEBEDEV',
  episode: 'EP. 001',
  tagline: 'FEELING OVER NOISE.',
  platform: 'BOOSTY',

  hud: {
    topLeft: ['ARTEMII LEBEDEV', 'AWWWARDS JURY'],
    topRight: 'REVIEW IN PROGRESS',
  },

  open: {
    lines: ['AWWWARDS — JURY PANEL', 'ARTEMII LEBEDEV PRESENTS'],
  },
  field: { words: ['THOUSANDS', 'OF SITES.'], counterLabel: 'SUBMISSIONS' },
  one: { words: ['ONE', 'JURY.'] },

  // Awwwards voting weights. The final score below is the weighted sum.
  criteria: [
    { key: 'design', word: 'DESIGN', weight: 40, score: 8.6 },
    { key: 'usability', word: 'USABILITY', weight: 30, score: 8.2 },
    { key: 'creativity', word: 'CREATIVITY', weight: 20, score: 8.9 },
    { key: 'content', word: 'CONTENT', weight: 10, score: 7.8 },
  ],
  score: { words: ['ONE', 'SCORE.'] },

  // Cuts sit on a 0.7s beat grid (≈85.7 BPM) starting at 0.2s; the soundtrack uses the same grid.
  beat: 0.7,
  shots: {
    open: [0.0, 3.0],
    field: [3.0, 6.5],
    one: [6.5, 9.3],
    design: [9.3, 12.1],
    usability: [12.1, 14.9],
    creativity: [14.9, 17.7],
    content: [17.7, 20.5],
    score: [20.5, 24.7],
    title: [24.7, 30.0],
  },

  // Rough palette lifted from artemiilebedev.com
  accent: '#D92B57',
  gold: '#AD9058',
};

export const finalScore = () =>
  config.criteria.reduce((s, c) => s + (c.score * c.weight) / 100, 0);
