const env = require('../../config/env');
const logger = require('../../utils/logger');

// Messages "sent" while testing, so tests can assert on them.
const outbox = [];
let transporter;

function getTransporter() {
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Branded, table-based HTML that renders in every mail client. */
function renderEmail({ title, lines = [], action, footer = 'Wan Ofi Furniture · Dar es Salaam, Tanzania' }) {
  const body = lines.map((l) => `<p style="margin:0 0 12px;color:#44403c;font-size:15px;line-height:1.6">${escapeHtml(l)}</p>`).join('');
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#5c3a2c;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(action.label)}</a></p>
       <p style="margin:0;color:#78716c;font-size:12px">Or open: ${escapeHtml(action.url)}</p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#faf6f2;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td style="background:#3f2a21;padding:20px 28px;color:#d9a531;font-size:20px;font-weight:bold">Wan Ofi Furniture</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 16px;font-size:20px;color:#241611">${escapeHtml(title)}</h1>
        ${body}${button}
      </td></tr>
      <tr><td style="padding:16px 28px;background:#f5f5f4;color:#a8a29e;font-size:12px">${escapeHtml(footer)}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

/** Sends an email. Never throws: delivery problems are logged, not surfaced to the user action. */
async function sendEmail({ to, subject, title, lines, action, text }) {
  if (!to) return false;
  const html = renderEmail({ title: title || subject, lines, action });
  const plain = text || [title || subject, ...(lines || []), action ? `${action.label}: ${action.url}` : ''].filter(Boolean).join('\n\n');
  try {
    if (env.isTest) {
      outbox.push({ to, subject, text: plain, html });
      return true;
    }
    // The seed script mutes outbound messages so it doesn't email hundreds of fake updates.
    if (process.env.MUTE_OUTBOUND === '1') return true;
    if (env.EMAIL_DRIVER === 'console') {
      logger.info(`[email → ${to}] ${subject}\n${plain}`);
      return true;
    }
    await getTransporter().sendMail({ from: env.EMAIL_FROM, to, subject, text: plain, html });
    return true;
  } catch (err) {
    logger.error(`Email to ${to} failed:`, err.message);
    return false;
  }
}

module.exports = { sendEmail, renderEmail, outbox };
