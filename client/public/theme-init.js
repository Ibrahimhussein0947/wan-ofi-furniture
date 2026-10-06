// Runs before the app loads; keep in sync with ThemeContext / LanguageContext storage keys.
try {
  var theme = localStorage.getItem('wanofi.theme');
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
  var lang = localStorage.getItem('wanofi.lang');
  if (lang) document.documentElement.lang = lang;
} catch (e) {
  // Storage unavailable — the app falls back to defaults.
}
