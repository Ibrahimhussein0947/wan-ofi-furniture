/**
 * - Removes keys starting with "$" or containing "." (MongoDB operator injection).
 * - Strips HTML tags from string values (stored-XSS defence in depth; React also escapes output).
 * Password fields are left untouched so no character is ever silently removed from them.
 */
const TAG_PATTERN = /<\/?[a-zA-Z!][^>]*>/g;
const SKIP_TAG_STRIP = new Set(['password', 'currentPassword', 'newPassword']);

function clean(value, key) {
  if (Array.isArray(value)) return value.map((v) => clean(v, key));
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    for (const k of Object.keys(value)) {
      if (k.startsWith('$') || k.includes('.')) {
        delete value[k];
      } else {
        value[k] = clean(value[k], k);
      }
    }
    return value;
  }
  if (typeof value === 'string' && !SKIP_TAG_STRIP.has(key)) return value.replace(TAG_PATTERN, '');
  return value;
}

const sanitizeRequest = (req, _res, next) => {
  if (req.body) req.body = clean(req.body);
  if (req.query) clean(req.query);
  if (req.params) clean(req.params);
  next();
};

module.exports = { sanitizeRequest, clean };
