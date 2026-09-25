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

// AzamPay (Tanzania): M-Pesa, Tigo Pesa, Airtel Money, HaloPesa, AzamPesa.
// The callback URL is registered in the AzamPay merchant portal:
//   https://<api-host>/api/payments/webhooks/azampay/<PAYMENT_WEBHOOK_SECRET>
const AZAM_HOSTS = {
  sandbox: { auth: 'https://authenticator-sandbox.azampay.co.tz', api: 'https://sandbox.azampay.co.tz' },
  production: { auth: 'https://authenticator.azampay.co.tz', api: 'https://checkout.azampay.co.tz' },
};
const AZAM_NETWORKS = { MPESA: 'Mpesa', TIGO: 'Tigo', AIRTEL: 'Airtel', HALOPESA: 'Halopesa', AZAMPESA: 'Azampesa' };
let azamToken = null;

async function azamAuth() {
  if (azamToken && azamToken.expires > Date.now() + 60000) return azamToken.value;
  const res = await fetch(`${AZAM_HOSTS[env.AZAMPAY_ENV].auth}/AppRegistration/GenerateToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appName: env.AZAMPAY_APP_NAME, clientId: env.AZAMPAY_CLIENT_ID, clientSecret: env.AZAMPAY_CLIENT_SECRET }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.accessToken) throw new Error(`AzamPay authentication failed (${res.status})`);
  azamToken = { value: json.data.accessToken, expires: Date.now() + 55 * 60 * 1000 };
  return azamToken.value;
}

const azampay = {
  name: 'azampay',
  async initiate(intent) {
    const token = await azamAuth();
    const res = await fetch(`${AZAM_HOSTS[env.AZAMPAY_ENV].api}/azampay/mno/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-API-Key': env.AZAMPAY_API_KEY },
      body: JSON.stringify({
        accountNumber: intent.phone.replace(/^\+/, ''),
        amount: String(intent.amount),
        currency: intent.currency,
        externalId: intent.reference,
        provider: AZAM_NETWORKS[intent.network],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error(json.message || `AzamPay checkout failed (${res.status})`);
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

const GATEWAYS = { sandbox, azampay };

function activeGateway() {
  return GATEWAYS[env.PAYMENT_PROVIDER] || null;
}

module.exports = { activeGateway, GATEWAYS, AZAM_NETWORKS };
