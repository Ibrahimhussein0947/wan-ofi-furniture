import { describe, expect, test } from 'vitest';
import { label, money, setCurrency, daysUntil } from '../utils/format';
import { productSchema } from '../pages/staff/catalog/ProductForm';
import { registerSchema } from '../pages/auth/Register';
import { customRequestSchema } from '../pages/public/CustomFurniture';
import { WORKER_STAGE_PERMISSIONS, STAGE_TRANSITIONS } from '../utils/constants';

describe('formatting', () => {
  test('money uses the business currency', () => {
    setCurrency('TZS');
    expect(money(50000)).toBe('TZS 50,000');
    expect(money(1250000, { compact: true })).toBe('TZS 1.3M');
  });
  test('status labels are human readable', () => {
    expect(label('IN_PRODUCTION')).toBe('In production');
    expect(label(undefined)).toBe('—');
  });
  test('daysUntil counts whole days', () => {
    expect(daysUntil(new Date(Date.now() + 2.5 * 86400000))).toBe(3);
    expect(daysUntil(null)).toBeNull();
  });
});

describe('form validation mirrors the server rules', () => {
  const base = { name: 'Bed', sku: 'BED-1', category: 'x', price: 100, costPrice: 60, sellingPrice: 90, unit: 'cm', status: 'ACTIVE', isFeatured: false, madeToOrder: true };

  test('selling below cost is rejected unless explicitly allowed', () => {
    expect(productSchema.safeParse(base).success).toBe(true);
    const loss = productSchema.safeParse({ ...base, sellingPrice: 50 });
    expect(loss.success).toBe(false);
    expect(loss.error.issues[0].path).toEqual(['sellingPrice']);
    expect(productSchema.safeParse({ ...base, sellingPrice: 50, allowLoss: true }).success).toBe(true);
  });

  test('SKU format and negative prices', () => {
    expect(productSchema.safeParse({ ...base, sku: 'bad sku!' }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, costPrice: -1 }).success).toBe(false);
  });

  test('registration requires a strong, confirmed password', () => {
    const ok = { name: 'Jane', email: 'jane@test.com', password: 'Secret123', confirm: 'Secret123' };
    expect(registerSchema.safeParse(ok).success).toBe(true);
    expect(registerSchema.safeParse({ ...ok, password: 'secretsecret', confirm: 'secretsecret' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, confirm: 'Different1' }).success).toBe(false);
  });

  test('custom requests need a description and a future date', () => {
    const ok = { furnitureType: 'Sofa', description: 'A three seater sofa', unit: 'cm', quantity: 1, deliveryMethod: 'DELIVERY' };
    expect(customRequestSchema.safeParse(ok).success).toBe(true);
    expect(customRequestSchema.safeParse({ ...ok, description: 'short' }).success).toBe(false);
    expect(customRequestSchema.safeParse({ ...ok, requiredDate: '2000-01-01' }).success).toBe(false);
  });
});

describe('production rules', () => {
  test('quality control cannot be skipped from any stage', () => {
    Object.values(STAGE_TRANSITIONS).forEach((targets) => expect(targets).not.toContain('READY_FOR_DELIVERY'));
  });
  test('carpenters cannot finish or inspect', () => {
    expect(WORKER_STAGE_PERMISSIONS.CARPENTER).not.toContain('FINISHING');
    expect(WORKER_STAGE_PERMISSIONS.CARPENTER).not.toContain('QUALITY_CHECK');
  });
});
