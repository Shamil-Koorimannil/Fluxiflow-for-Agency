/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border, 240 5.9% 90%))',
        input: 'hsl(var(--input, 240 5.9% 90%))',
        ring: 'hsl(var(--ring, 240 5% 64.9%))',
        background: 'hsl(var(--background, 0 0% 100%))',
        foreground: 'hsl(var(--foreground, 240 10% 3.9%))',
        primary: {
          DEFAULT: 'hsl(var(--primary, 240 5.9% 10%))',
          foreground: 'hsl(var(--primary-foreground, 0 0% 98%))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary, 240 4.8% 95.9%))',
          foreground: 'hsl(var(--secondary-foreground, 240 5.9% 10%))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted, 240 4.8% 95.9%))',
          foreground: 'hsl(var(--muted-foreground, 240 3.8% 46.1%))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent, 240 4.8% 95.9%))',
          foreground: 'hsl(var(--accent-foreground, 240 5.9% 10%))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover, 0 0% 100%))',
          foreground: 'hsl(var(--popover-foreground, 240 10% 3.9%))',
        },
        card: {
          DEFAULT: 'hsl(var(--card, 0 0% 100%))',
          foreground: 'hsl(var(--card-foreground, 240 10% 3.9%))',
        },
      },
      borderRadius: {
        lg: 'var(--radius, 0.5rem)',
        md: 'calc(var(--radius, 0.5rem) - 2px)',
        sm: 'calc(var(--radius, 0.5rem) - 4px)',
      },
    },
  },
  plugins: [],
}
