import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useT } from '../../i18n/LanguageContext';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export default function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const t = useT();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      // Keep keyboard focus inside the dialog.
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => panelRef.current?.querySelector('input, select, textarea, button:not([data-close])')?.focus(), 30);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="theme-static absolute inset-0 bg-walnut-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={clsx('animate-scale-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-floating sm:rounded-2xl', SIZES[size])}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-gradient-to-b from-stone-50/70 to-transparent px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold tracking-tight text-stone-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
          </div>
          <button type="button" data-close onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label={t('Close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
