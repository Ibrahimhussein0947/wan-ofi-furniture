const path = require('path');
const { z } = require('zod');

const isTest = process.env.NODE_ENV === 'test';
if (!isTest) require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5050),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().default(7),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  MAX_UPLOAD_MB: z.coerce.number().default(5),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  // Public URL of the web app, used in email links (defaults to the first CLIENT_URL).
  APP_URL: z.string().optional(),
  // Outgoing email: console (logs, for development) | smtp
  EMAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  EMAIL_FROM: z.string().default('Wan Ofi Furniture <no-reply@wanofi.com>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Outgoing SMS: console | africastalking
  SMS_DRIVER: z.enum(['console', 'africastalking']).default('console'),
  AT_USERNAME: z.string().optional(),
  AT_API_KEY: z.string().optional(),
  AT_SENDER_ID: z.string().optional(),
  // Online payments: manual (staff record/verify) | sandbox (simulated mobile money) | azampay
  PAYMENT_PROVIDER: z.enum(['manual', 'sandbox', 'azampay']).default('manual'),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  AZAMPAY_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  AZAMPAY_APP_NAME: z.string().optional(),
  AZAMPAY_CLIENT_ID: z.string().optional(),
  AZAMPAY_CLIENT_SECRET: z.string().optional(),
  AZAMPAY_API_KEY: z.string().optional(),
  ENABLE_CRON: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
});

// Tests run against an in-memory database with fixed throwaway secrets.
const testOverrides = isTest
  ? {
      MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1/placeholder',
      JWT_SECRET: 'test-access-secret-test-access-secret-000',
      JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-00',
      STORAGE_DRIVER: 'local',
      ENABLE_CRON: 'false',
      EMAIL_DRIVER: 'console',
      SMS_DRIVER: 'console',
      PAYMENT_PROVIDER: 'sandbox',
      PAYMENT_WEBHOOK_SECRET: 'test-webhook-secret',
      APP_URL: 'http://localhost:5173',
    }
  : {};

const parsed = schema.safeParse({ ...process.env, ...testOverrides });

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}\nSee server/.env.example`);
  process.exit(1);
}

const env = parsed.data;
env.isProduction = env.NODE_ENV === 'production';
env.isTest = env.NODE_ENV === 'test';
env.APP_URL = (env.APP_URL || env.CLIENT_URL.split(',')[0]).replace(/\/$/, '');

if (env.isProduction) {
  const problems = [];
  if (env.PAYMENT_PROVIDER === 'sandbox') problems.push('PAYMENT_PROVIDER=sandbox simulates payments and must not be used in production');
  if (env.PAYMENT_PROVIDER !== 'manual' && !env.PAYMENT_WEBHOOK_SECRET) problems.push('PAYMENT_WEBHOOK_SECRET is required for online payments');
  if (env.EMAIL_DRIVER === 'smtp' && !env.SMTP_HOST) problems.push('SMTP_HOST is required when EMAIL_DRIVER=smtp');
  if (problems.length) {
    // eslint-disable-next-line no-console
    console.error(`Invalid production configuration:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
}

module.exports = env;
