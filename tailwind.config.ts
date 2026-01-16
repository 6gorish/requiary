import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        display: ['var(--font-cormorant)', 'Georgia', 'serif'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      typography: (theme: any) => ({
        DEFAULT: {
          css: {
            color: theme('colors.stone.700'),
            lineHeight: '1.75',
            p: {
              marginTop: '1.5em',
              marginBottom: '1.5em',
            },
            h1: {
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontWeight: '300',
              letterSpacing: '-0.025em',
            },
            h2: {
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontWeight: '300',
              letterSpacing: '-0.025em',
            },
            h3: {
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontWeight: '400',
              letterSpacing: '-0.025em',
            },
            a: {
              color: theme('colors.sky.700'),
              textDecoration: 'underline',
              '&:hover': {
                color: theme('colors.sky.800'),
              },
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
