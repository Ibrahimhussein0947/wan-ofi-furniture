import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Download } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

// The browser fires this once, early; keep it at module level so late-mounting buttons still get it.
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** Shows only while the browser says the app can be installed; one click opens the native install dialog. */
export default function InstallButton({ className }) {
  const { t } = useLanguage();
  const [, rerender] = useState(0);

  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  if (!deferredPrompt) return null;

  const install = async () => {
    const prompt = deferredPrompt;
    deferredPrompt = null;
    notify();
    prompt.prompt();
    await prompt.userChoice.catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={install}
      className={clsx(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-stone-600 transition hover:bg-walnut-50 hover:text-walnut-800',
        className
      )}
      title={t('Install app')}
    >
      <Download className="h-5 w-5" aria-hidden />
      <span className="hidden md:inline">{t('Install app')}</span>
      <span className="sr-only md:hidden">{t('Install app')}</span>
    </button>
  );
}
