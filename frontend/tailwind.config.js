/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Charcoal & Gold Theme Tokens (per user prompt)
        charcoal: {
          DEFAULT: '#1A1A1E',
          dark: '#121216',
          surface: '#24242C',
          border: '#33333E',
          light: '#3E3E4C',
        },
        gold: {
          DEFAULT: '#D4AF37',
          light: '#F3E5AB',
          dark: '#AA820A',
          hover: '#C5A028',
          muted: '#8A752A',
        },
        // Royal Blue & Silver Base Tokens (per AGENTS.md Section 6 & docs/02-screens.md)
        royal: {
          DEFAULT: '#021945',
          deep: '#0F2461',
          surface: '#142A5C',
          light: '#25479F',
        },
        silver: {
          DEFAULT: '#C0C0C0',
          accent: '#C0C7D1',
          highlight: '#E6EAF0',
          dark: '#8A92A0',
        },
        // Semantic status tokens
        status: {
          success: '#3DDC97',
          warning: '#F5B94A',
          danger: '#FF6B6B',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Noto Sans Gujarati',
          'Noto Sans Devanagari',
          'sans-serif'
        ],
      }
    },
  },
  plugins: [],
};
