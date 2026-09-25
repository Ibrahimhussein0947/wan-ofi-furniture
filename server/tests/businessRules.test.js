const { calcOrderTotals, calcBalance, isLowStock, paymentStatusFor, round2 } = require('../utils/money');
const { canMoveToStage, hasPermission, PERMISSIONS } = require('../config/permissions');

describe('business rules', () => {
  test('TOTAL = subtotal - discount (+ delivery fee)', () => {
    const items = [
      { quantity: 2, unitPrice: 15000 },
      { quantity: 1, unitPrice: 20000 },
    ];
    expect(calcOrderTotals({ items, discount: 5000 })).toEqual({ subtotal: 50000, tax: 0, total: 45000, balance: 45000 });
    // Tax applies after the discount: (50,000 - 5,000) × 18% = 8,100.
    expect(calcOrderTotals({ items, discount: 5000, taxRate: 18 })).toMatchObject({ tax: 8100, total: 53100 });
    expect(calcOrderTotals({ items, discount: 5000, deliveryFee: 10000 }).total).toBe(55000);
  });

  test('REMAINING BALANCE = total - paid, never negative', () => {
    expect(calcBalance(50000, 20000)).toBe(30000);
    expect(calcBalance(50000, 50000)).toBe(0);
    expect(calcBalance(50000, 60000)).toBe(0);
    expect(calcOrderTotals({ items: [{ quantity: 1, unitPrice: 50000 }], amountPaid: 20000 }).balance).toBe(30000);
  });

  test('LOW STOCK = quantity <= minimumStock', () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(4, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
  });

  test('payment status follows amounts paid', () => {
    expect(paymentStatusFor(100, 0)).toBe('UNPAID');
    expect(paymentStatusFor(100, 40)).toBe('PARTIAL');
    expect(paymentStatusFor(100, 100)).toBe('PAID');
  });

  test('money rounding avoids floating point drift', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(calcOrderTotals({ items: [{ quantity: 3, unitPrice: 0.1 }] }).subtotal).toBe(0.3);
  });

  test('worker positions can only move jobs to their own stages', () => {
    const carpenter = { role: 'WORKER', workerRole: 'CARPENTER' };
    const painter = { role: 'WORKER', workerRole: 'PAINTER' };
    const supervisor = { role: 'WORKER', workerRole: 'SUPERVISOR' };
    expect(canMoveToStage(carpenter, 'IN_PRODUCTION')).toBe(true);
    expect(canMoveToStage(carpenter, 'FINISHING')).toBe(false);
    expect(canMoveToStage(painter, 'QUALITY_CHECK')).toBe(true);
    expect(canMoveToStage(painter, 'IN_PRODUCTION')).toBe(false);
    expect(canMoveToStage(supervisor, 'CANCELLED')).toBe(true);
    expect(canMoveToStage({ role: 'ACCOUNTANT' }, 'IN_PRODUCTION')).toBe(false);
  });

  test('accountants cannot manage settings or users; owners can do everything', () => {
    const accountant = { role: 'ACCOUNTANT' };
    expect(hasPermission(accountant, PERMISSIONS.PAYMENTS_WRITE)).toBe(true);
    expect(hasPermission(accountant, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    expect(hasPermission(accountant, PERMISSIONS.USERS_WRITE)).toBe(false);
    expect(hasPermission({ role: 'OWNER' }, PERMISSIONS.SETTINGS_MANAGE)).toBe(true);
    expect(hasPermission({ role: 'CUSTOMER' }, PERMISSIONS.ORDERS_READ)).toBe(false);
  });
});
