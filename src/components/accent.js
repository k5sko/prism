// Static class strings per accent so Tailwind keeps them in the build.
// (Dynamic `bg-${accent}-100` would get purged.)
// Dark-tinted chips for the dark theme: a quiet color wash + soft pastel text,
// so subject tags read clearly without the glaring light-pill look.
export const TAG_CLASSES = {
  blue: 'bg-blue-700/15 text-blue-400 border-blue-700/30',
  green: 'bg-green-700/15 text-green-400 border-green-700/30',
  amber: 'bg-amber-700/15 text-amber-400 border-amber-700/30',
  purple: 'bg-purple-700/15 text-purple-400 border-purple-700/30',
  pink: 'bg-pink-700/15 text-pink-400 border-pink-700/30',
  teal: 'bg-teal-700/15 text-teal-400 border-teal-700/30',
}

export const DOT_CLASSES = {
  blue: 'bg-blue-700',
  green: 'bg-green-700',
  amber: 'bg-amber-700',
  purple: 'bg-purple-700',
  pink: 'bg-pink-700',
  teal: 'bg-teal-700',
}
