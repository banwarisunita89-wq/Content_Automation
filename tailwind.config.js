/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B0C10',
          900: '#0F1015',
          850: '#141519',
          800: '#1F2833',
          750: '#252A35',
          700: '#2C3340',
          600: '#3A4055',
          500: '#3a4055',
          400: '#565d75',
          300: '#7c8499',
          200: '#a8aec0',
          100: '#cdd2de',
          50: '#e8eaef',
        },
        accent: {
          DEFAULT: 'var(--accent, #00d4ff)',
          gold: '#ffb547',
          glow: 'var(--accent-glow, rgba(0,212,255,0.35))',
          dim: 'var(--accent-dim, rgba(0,212,255,0.12))',
        },
        success: { DEFAULT: '#22e078', dim: 'rgba(34,224,120,0.12)' },
        warning: { DEFAULT: '#ffb547', dim: 'rgba(255,181,71,0.12)' },
        danger: { DEFAULT: '#ff5470', dim: 'rgba(255,84,112,0.12)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: 'var(--radius, 12px)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'scan': 'scan 3s linear infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseGlow: { '0%,100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        scan: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
      },
    },
  },
  plugins: [],
};
