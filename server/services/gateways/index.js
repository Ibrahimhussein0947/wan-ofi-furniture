const env = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Mobile-money gateways. Each exposes:
 *   initiate(intent)      → asks the provider to push a payment prompt to the customer's phone
 *   parseCallback(body)   → { reference, success, providerReference, amount, reason }
 */

// Simulated provider for development and tests: the customer "approves" after a short delay.
// Phone numbers ending in 0000 simulate a declined payment.
const sandbox = {
  name: 'sandbox',
  async initiate(intent, { onSimulatedCallback } = {}) {
    const success = !intent.phone.endsWith('0000');
    if (onSimulatedCallback) {
      const delay = env.isTest ? 0 : 4000;
      setTimeout(() => {
        onSimulatedCallback({
          reference: intent.reference,
          transactionstatus: success ? 'success' : 'failure',
          amount: String(intent.amount),
          reference_id: `SBX${Date.now()}`,
          message: success ? 'Approved by customer' : 'Customer declined the payment',
        }).catch((err) => logger.error('Sandbox callback failed:', err.message));
      }, delay).unref?.();
    }
    return { providerReference: `SBX-${intent.reference}` };
  },
  parseCallback(body) {
    return {
      reference: body.reference,
      success: body.transactionstatus === 'success',
      providerReference: body.reference_id,
      amount: Number(body.amount),
      reason: body.message,
    };
  },
};

// Chapa (Ethiopia): Telebirr, CBE Birr, Amole, M-PESA and Bybils.
// The callback URL is registered in the Chapa merchant portal:
//   https://<api-host>/api/payments/webhooks/chapa/<PAYMENT_WEBHOOK_SECRET>
const CHAPA_HOSTS = {
  sandbox: { auth: 'https://auth-sandbox.chapa.co', api: 'https://sandbox.chapa.co' },
  production: { auth: 'https://auth.chapa.co', api: 'https://api.chapa.co' },
};
const CHAPA_NETWORKS = { TELEBIRR: 'Telebirr', CBE_BIRR: 'CBEBirr', AMOLE: 'Amole', MPESA: 'Mpesa', BYBILS: 'Bybils' };
let chapaToken = null;

async function chapaAuth() {
  if (chapaToken && chapaToken.expires > Date.now() + 60000) return chapaToken.value;
  const res = await fetch(`${CHAPA_HOSTS[env.CHAPA_ENV].auth}/AppRegistration/GenerateToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appName: env.CHAPA_APP_NAME, clientId: env.CHAPA_CLIENT_ID, clientSecret: env.CHAPA_CLIENT_SECRET }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.accessToken) throw new Error(`Chapa authentication failed (${res.status})`);
  chapaToken = { value: json.data.accessToken, expires: Date.now() + 55 * 60 * 1000 };
  return chapaToken.value;
}

const chapa = {
  name: 'chapa',
  async initiate(intent) {
    const token = await chapaAuth();
    const res = await fetch(`${CHAPA_HOSTS[env.CHAPA_ENV].api}/chapa/mno/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-API-Key': env.CHAPA_API_KEY },
      body: JSON.stringify({
        accountNumber: intent.phone.replace(/^\+/, ''),
        amount: String(intent.amount),
        currency: intent.currency,
        externalId: intent.reference,
        provider: CHAPA_NETWORKS[intent.network],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error(json.message || `Chapa checkout failed (${res.status})`);
    return { providerReference: json.transactionId };
  },
  parseCallback(body) {
    return {
      reference: body.utilityref || body.externalId,
      success: String(body.transactionstatus).toLowerCase() === 'success',
      providerReference: body.reference || body.fspReferenceId,
      amount: Number(body.amount),
      reason: body.message,
    };
  },
};

const GATEWAYS = { sandbox, chapa };

function activeGateway() {
  return GATEWAYS[env.PAYMENT_PROVIDER] || null;
}

module.exports = { activeGateway, GATEWAYS, CHAPA_NETWORKS };
