// All copy and timing for the intro lives here. Times are in seconds.
export const config = {
  width: 2560,
  height: 1600,
  fps: 30,
  duration: 30,

  title: 'Jury',
  subtitle: ['Site reviews from', 'the Awwwards jury panel'],
  author: 'Artemii Lebedev',
  role: 'Awwwards Jury',
  episode: 'Episode 01',
  platform: 'Boosty',
  year: '2026',
  tagline: ['Feeling', 'over', 'noise.'],

  // Persistent editorial frame in the corners.
  frame: {
    topLeft: 'Artemii Lebedev',
    topRight: 'Site Reviews',
    bottomRight: 'Episode 01',
  },

  copy: {
    glint: 'Every year,',
    thousands: 'Thousands',
    thousandsSub: ['of websites', 'compete for attention.'],
    noise: ['Most of it', 'is noise.'],
    one: ['One', 'jury.'],
    oneSub: ['Four criteria.', 'One honest score.'],
    score: 'Final score',
  },

  // Awwwards voting weights. The final score below is the weighted sum.
  criteria: [
    { key: 'design', word: 'Design', weight: 40, score: 8.6, note: 'Composition, grid, rhythm' },
    { key: 'usability', word: 'Usability', weight: 30, score: 8.2, note: 'Clarity of every interaction' },
    { key: 'creativity', word: 'Creativity', weight: 20, score: 8.9, note: 'An idea nobody has seen' },
    { key: 'content', word: 'Content', weight: 10, score: 7.8, note: 'What is actually said' },
  ],

  // Cuts sit on a 0.7s beat grid (≈85.7 BPM); the soundtrack uses the same grid.
  beat: 0.7,
  shots: {
    glint: [0.0, 2.8],
    thousands: [2.8, 5.6],
    noise: [5.6, 7.0],
    one: [7.0, 9.8],
    design: [9.8, 12.6],
    usability: [12.6, 15.4],
    creativity: [15.4, 18.2],
    content: [18.2, 21.0],
    score: [21.0, 24.85],
    title: [24.85, 30.0],
  },

  paper: '#EDEBE6',
  accent: '#D92B57',
};

export const finalScore = () =>
  config.criteria.reduce((s, c) => s + (c.score * c.weight) / 100, 0);
