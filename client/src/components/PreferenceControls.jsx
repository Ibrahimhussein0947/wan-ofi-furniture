import clsx from 'clsx';
import { Languages, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';

export function ThemeToggle({ className }) {
  const { theme, toggle } = useTheme();
  const { t } = useLanguage();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className={clsx('rounded-lg p-2 text-stone-600 transition hover:bg-walnut-50 hover:text-walnut-800', className)}
      aria-label={dark ? t('Switch to light mode') : t('Switch to dark mode')}
      title={dark ? t('Light mode') : t('Dark mode')}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

export function LanguageSwitcher({ className }) {
  const { lang, setLang, languages, t } = useLanguage();
  return (
    <label className={clsx('relative flex items-center rounded-lg text-stone-600 hover:bg-walnut-50', className)}>
      <Languages className="pointer-events-none absolute left-2 h-4 w-4" aria-hidden />
      <span className="sr-only">{t('Language')}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg bg-transparent py-2 pl-8 pr-2 text-sm font-medium text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code} className="bg-white text-stone-800">
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
