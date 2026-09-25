let currency = 'TZS';
export const setCurrency = (c) => {
  if (c) currency = c;
};
export const getCurrency = () => currency;

export function money(value, { compact = false, withCurrency = true } = {}) {
  const n = Number(value || 0);
  const formatted = compact
    ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    : new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(n);
  return withCurrency ? `${currency} ${formatted}` : formatted;
}

export const number = (value, digits = 2) => new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(Number(value || 0));

export function date(value, opts = {}) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', ...opts });
}

export function dateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value) {
  if (!value) return '';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(seconds) >= secs) return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.round(seconds / secs), unit);
  }
  return 'just now';
}

// "IN_PRODUCTION" → "In production"
export const label = (value) => {
  if (!value) return '—';
  const s = String(value).replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export const daysUntil = (value) => (value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : null);
