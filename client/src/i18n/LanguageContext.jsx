import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, am, om } from './translations';

const DICTIONARIES = { om, am };
const STORAGE_KEY = 'wanofi.lang';

const interpolate = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text);

// English is the key itself, so components rendered without the provider (e.g. in tests) still read correctly.
const LanguageContext = createContext({ lang: 'en', setLang: () => {}, languages: LANGUAGES, t: (key, vars) => interpolate(key, vars) });

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    // Storage unavailable — default to English.
  }
  return 'en';
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage unavailable — the language still applies for this visit.
    }
  }, [lang]);

  const t = useCallback((key, vars) => interpolate(DICTIONARIES[lang]?.[key] ?? key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, languages: LANGUAGES, t }), [lang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useT = () => useContext(LanguageContext).t;
export const useLanguage = () => useContext(LanguageContext);
