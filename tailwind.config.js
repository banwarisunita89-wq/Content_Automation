/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#09090b',
          900: '#0c0c0f',
          850: '#18181b',
          800: '#27272a',
          750: '#2d2d31',
          700: '#3f3f46',
          600: '#52525b',
          500: '#71717a',
          400: '#a1a1aa',
          300: '#c4c4c8',
          200: '#d4d4d8',
          100: '#e4e4e7',
          50: '#f4f4f5',
        },
        accent: {
          DEFAULT: 'var(--accent, #18181b)',
          glow: 'var(--accent-glow, rgba(24,24,27,0.25))',
          dim: 'var(--accent-dim, rgba(24,24,27,0.08))',
        },
        success: { DEFAULT: '#16a34a', dim: 'rgba(22,163,74,0.10)' },
        warning: { DEFAULT: '#ca8a04', dim: 'rgba(202,138,4,0.10)' },
        danger: { DEFAULT: '#dc2626', dim: 'rgba(220,38,38,0.10)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: 'var(--radius, 8px)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseGlow: { '0%,100%': { opacity: '0.4' }, '50%': { opacity: '0.8' } },
      },
    },
  },
  plugins: [],
};
