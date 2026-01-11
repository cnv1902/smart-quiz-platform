/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Sky Blue
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0EA5E9', // Main accent color
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Dark slate for text
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155', // Main text color
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0,0,0,0.1)',
        'card': '0 2px 4px rgba(0,0,0,0.08)',
        'lift': '0 4px 12px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
}
