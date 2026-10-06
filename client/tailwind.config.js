import defaultColors from 'tailwindcss/colors.js';
import plugin from 'tailwindcss/plugin.js';

// Walnut browns and brass accents for a warm furniture-workshop feel.
const brand = {
  walnut: { 50: '#faf6f2', 100: '#f2e9df', 200: '#e4d2bd', 300: '#d2b393', 400: '#bd8f68', 500: '#a8734c', 600: '#8f5c3c', 700: '#744832', 800: '#5c3a2c', 900: '#3f2a21', 950: '#241611' },
  brass: { 50: '#fcf8ec', 100: '#f6ecc9', 200: '#edd78f', 300: '#e3bd55', 400: '#d9a531', 500: '#c48a22', 600: '#a66a1b', 700: '#854e1a', 800: '#6d3f1b', 900: '#5c351b' },
  sage: { 50: '#f4f7f4', 100: '#e3ebe3', 500: '#5f7f63', 600: '#4b674f', 700: '#3d5341' },
};

// Light values: the brand palettes plus the Tailwind palettes the app uses.
const light = {
  ...brand,
  stone: defaultColors.stone,
  ...Object.fromEntries(['red', 'orange', 'amber', 'emerald', 'teal', 'sky', 'violet'].map((c) => [c, defaultColors[c]])),
  white: '#ffffff',
  canvas: '#fbf8f4', // page background behind the storefront
};

// Dark values: warm, low-glare scales that run the other way (50 = darkest tint).
const mirror = (scale) => {
  const keys = Object.keys(scale);
  return Object.fromEntries(keys.map((k, i) => [k, scale[keys[keys.length - 1 - i]]]));
};
const dark = {
  walnut: { 50: '#2a1d17', 100: '#352519', 200: '#4a3324', 300: '#6b4a35', 400: '#8f6648', 500: '#b08362', 600: '#c9a083', 700: '#dcbda4', 800: '#ead6c4', 900: '#f4e8dc', 950: '#fbf5ef' },
  brass: { ...mirror(brand.brass), 50: '#2c2113', 100: '#3a2a15', 200: '#5a3f1a' },
  sage: { 50: '#1b241d', 100: '#26332a', 500: '#86a68a', 600: '#a3bfa6', 700: '#c2d6c4' },
  stone: { 50: '#16110e', 100: '#211a16', 200: '#30261f', 300: '#47392f', 400: '#6f6056', 500: '#9a8b80', 600: '#b9aca2', 700: '#d4c9c0', 800: '#e7dfd8', 900: '#f3eee9', 950: '#faf7f4' },
  ...Object.fromEntries(['red', 'orange', 'amber', 'emerald', 'teal', 'sky', 'violet'].map((c) => [c, mirror(defaultColors[c])])),
  white: '#1d1713',
  canvas: '#16110e',
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
const toVars = (palette) =>
  Object.fromEntries(
    Object.entries(palette).flatMap(([name, value]) =>
      typeof value === 'string' ? [[`--c-${name}`, rgb(value)]] : Object.entries(value).map(([k, v]) => [`--c-${name}-${k}`, rgb(v)])
    )
  );
const themeColors = Object.fromEntries(
  Object.entries(light).map(([name, value]) => [
    name,
    typeof value === 'string'
      ? `rgb(var(--c-${name}) / <alpha-value>)`
      : Object.fromEntries(Object.keys(value).map((k) => [k, `rgb(var(--c-${name}-${k}) / <alpha-value>)`])),
  ])
);

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Every palette is a CSS variable so dark mode can swap the whole scale at once
      // (see the theme plugin below); light mode keeps the original values.
      colors: themeColors,
      fontFamily: {
        // Noto Sans Ethiopic covers Amharic (Ge'ez script), which Inter and Playfair lack.
        sans: ['Inter', '"Noto Sans Ethiopic"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', '"Noto Sans Ethiopic"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(36, 22, 17, 0.04), 0 1px 3px rgba(36, 22, 17, 0.06)',
        lift: '0 18px 40px -18px rgba(36, 22, 17, 0.35)',
        glow: '0 10px 26px -8px rgba(196, 138, 34, 0.55)',
        'glow-sm': '0 6px 16px -6px rgba(196, 138, 34, 0.45)',
        // Layered elevation scale. `soft` replaces the flat `card` look on large
        // surfaces; `floating` is for overlays (menus, dialogs, popovers).
        soft: '0 1px 2px rgba(36, 22, 17, 0.04), 0 4px 12px -2px rgba(36, 22, 17, 0.07)',
        raised: '0 2px 4px rgba(36, 22, 17, 0.05), 0 12px 28px -8px rgba(36, 22, 17, 0.16)',
        floating: '0 8px 20px -6px rgba(36, 22, 17, 0.18), 0 24px 56px -16px rgba(36, 22, 17, 0.26)',
        'inset-hair': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        400: '400ms',
        600: '600ms',
        900: '900ms',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(1.5deg)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.72' },
        },
        // Sweeping highlight for loading placeholders.
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        // Slow brass sheen that sweeps across premium surfaces.
        sheen: {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '100%': { transform: 'translateX(220%) skewX(-18deg)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 9s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.5s ease both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
        sheen: 'sheen 2.4s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) =>
      addBase({
        ':root': toVars(light),
        '.dark': toVars(dark),
        // Sections that are dark by design (hero, footer, sidebar) keep their light-mode colours.
        '.dark .theme-static': toVars(light),
      })
    ),
  ],
};
