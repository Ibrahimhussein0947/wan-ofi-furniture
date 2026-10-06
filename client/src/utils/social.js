/**
 * Turns what the admin typed for each contact channel into a link:
 * full https links are kept, usernames and phone numbers become the channel's own link.
 * Returns [] entries only for channels that are filled in.
 */
const clean = (v) => String(v || '').trim();
const handle = (v) => clean(v).replace(/^@/, '').replace(/^\/+|\/+$/g, '');
const isUrl = (v) => /^https?:\/\//i.test(v);

const BUILDERS = {
  facebook: (v) => (isUrl(v) ? v : `https://facebook.com/${handle(v)}`),
  instagram: (v) => (isUrl(v) ? v : `https://instagram.com/${handle(v)}`),
  telegram: (v) => (isUrl(v) ? v : `https://t.me/${handle(v).replace(/^t\.me\//i, '')}`),
  // wa.me wants the full international number, digits only (e.g. 251911223344).
  whatsapp: (v) => (isUrl(v) ? v : `https://wa.me/${clean(v).replace(/\D/g, '')}`),
};

/** Text shown next to the icon: the phone number or @username rather than the full link. */
function display(key, v) {
  if (key === 'whatsapp' && !isUrl(v)) return v;
  if (!isUrl(v)) return `@${handle(v)}`;
  const path = v.replace(/^https?:\/\/(www\.)?[^/]+\/?/i, '').replace(/\/+$/, '');
  return path ? `@${path.split(/[/?#]/)[0]}` : v.replace(/^https?:\/\/(www\.)?/i, '');
}

export const SOCIAL_LABELS = { facebook: 'Facebook', telegram: 'Telegram', whatsapp: 'WhatsApp', instagram: 'Instagram' };

export function socialLinks(links = {}) {
  return Object.keys(BUILDERS)
    .map((key) => {
      const value = clean(links?.[key]);
      if (!value || (key === 'whatsapp' && !isUrl(value) && !/\d{6,}/.test(value.replace(/\D/g, '')))) return null;
      // Anything with a scheme other than http(s) is ignored, never turned into a link.
      if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !isUrl(value)) return null;
      return { key, label: SOCIAL_LABELS[key], href: BUILDERS[key](value), text: display(key, value) };
    })
    .filter(Boolean);
}
