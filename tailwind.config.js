/** @type {import('tailwindcss').Config} */
// Direction C — "Premium" (Apple/Notion): quiet luxury on a light base. Geist
// neutral ramp kept for continuity; type is Space Grotesk (display) + Inter
// (body), the loud Geist blue is replaced by a single muted-indigo `accent`,
// and surfaces lean on hairlines + soft radii + subtle glass over heavy shadow.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#171717',
        secondary: '#4d4d4d',
        tertiary: '#5b5bd6',
        neutral: '#f2f2f2',
        'bg-100': '#ffffff',
        'bg-200': '#fafafa',
        // muted indigo — used sparingly (focus, active marks, quiet highlights)
        accent: {
          100: '#eeeffb',
          200: '#e0e2f7',
          400: '#bcbff0',
          500: '#5b5bd6',
          600: '#4f4fc4',
          700: '#4040a6',
        },
        gray: {
          100: '#f2f2f2',
          200: '#ebebeb',
          300: '#e6e6e6',
          400: '#eaeaea',
          500: '#c9c9c9',
          600: '#a8a8a8',
          700: '#8f8f8f',
          800: '#7d7d7d',
          900: '#4d4d4d',
          1000: '#171717',
        },
        'gray-a': {
          100: '#0000000d',
          200: '#00000015',
          300: '#0000001a',
          400: '#00000014',
          500: '#00000036',
          600: '#0000003d',
          700: '#00000070',
          800: '#00000082',
          900: '#000000b3',
          1000: '#000000e8',
        },
        blue: {
          100: '#f0f7ff',
          200: '#e9f4ff',
          300: '#dfefff',
          400: '#cae7ff',
          500: '#94ccff',
          600: '#48aeff',
          700: '#006bff',
          800: '#0059ec',
          900: '#005ff2',
          1000: '#002359',
        },
        green: {
          100: '#ecfdec',
          400: '#b9f5bc',
          700: '#28a948',
          900: '#107d32',
          1000: '#003a00',
        },
        amber: {
          100: '#fff6de',
          400: '#ffdc73',
          700: '#ffae00',
          900: '#aa4d00',
        },
        purple: {
          100: '#faf0ff',
          400: '#f2d9ff',
          700: '#a000f8',
          900: '#7d00cc',
        },
        pink: {
          100: '#ffe8f6',
          400: '#ffd3e1',
          700: '#f22782',
          900: '#c41562',
        },
        teal: {
          100: '#defffb',
          400: '#b1f7ec',
          700: '#00ac96',
          900: '#007f70',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        head: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        // softer, more "expensive" corners than Geist's defaults
        sm: '8px',
        md: '14px',
        lg: '20px',
        xl: '28px',
        full: '9999px',
      },
      boxShadow: {
        // quieter, more diffuse than Geist — premium leans on hairlines, not shadow
        raised: '0 1px 2px rgba(16,18,38,0.04)',
        popover:
          '0 1px 1px rgba(16,18,38,0.02), 0 6px 12px -6px rgba(16,18,38,0.06), 0 18px 28px -12px rgba(16,18,38,0.08)',
        modal:
          '0 1px 1px rgba(16,18,38,0.02), 0 10px 20px -8px rgba(16,18,38,0.07), 0 32px 48px -16px rgba(16,18,38,0.12)',
      },
      transitionTimingFunction: {
        geist: 'cubic-bezier(0.175, 0.885, 0.32, 1.1)',
      },
    },
  },
  plugins: [],
}
