let currency = 'ETB';
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

const pad = (n) => String(n).padStart(2, '0');
/** Today's (or any instant's) calendar date in the viewer's own time zone, as YYYY-MM-DD. */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Value for <input type="date">. Dates saved from such inputs sit at midnight UTC, so those read back
 * by their UTC date; any other moment (e.g. "now") uses the viewer's local date, so that after
 * midnight in Ethiopia (UTC+3) the default is already today rather than yesterday.
 */
export const toInputDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  const dateOnly = !d.getUTCHours() && !d.getUTCMinutes() && !d.getUTCSeconds() && !d.getUTCMilliseconds();
  return dateOnly ? d.toISOString().slice(0, 10) : localDate(d);
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export const daysUntil = (value) => (value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : null);

// "2-year warranty" / "6-month warranty"; null when there is none. `t` is the i18n translator.
export const warrantyLabel = (months, t = (k, v) => k.replace(/\{(\w+)\}/g, (_, x) => v[x])) => {
  if (!months) return null;
  if (months % 12 === 0) return months === 12 ? t('1-year warranty') : t('{count}-year warranty', { count: months / 12 });
  return t('{count}-month warranty', { count: months });
};
