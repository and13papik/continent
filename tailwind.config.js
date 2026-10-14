/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{ts,tsx}', './pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  // These backgrounds are derived from text colors in financial cards.
  safelist: ['bg-amber-400', 'bg-sky-400', 'bg-rose-400', 'bg-indigo-400', 'bg-emerald-400', 'bg-slate-400'],
  // Ignore a legacy template expression: it is not a valid runtime class.
  blocklist: ['shadow-[0_15px_30px_-8px_${shadowColor}]'],
  theme: { extend: {} },
  plugins: [],
};
