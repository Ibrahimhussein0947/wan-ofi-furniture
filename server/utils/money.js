// All amounts are stored as numbers rounded to 2 decimals to avoid floating-point drift.
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const calcLineTotal = (quantity, unitPrice) => round2(quantity * unitPrice);

// TOTAL = subtotal - discount + tax (+ delivery fee). Tax applies to the discounted goods value.
function calcOrderTotals({ items = [], discount = 0, deliveryFee = 0, amountPaid = 0, taxRate = 0 }) {
  const subtotal = round2(items.reduce((sum, i) => sum + calcLineTotal(i.quantity, i.unitPrice), 0));
  const taxable = Math.max(subtotal - discount, 0);
  const tax = round2((taxable * taxRate) / 100);
  const total = round2(taxable + tax + deliveryFee);
  const balance = round2(Math.max(total - amountPaid, 0));
  return { subtotal, tax, total, balance };
}

// REMAINING BALANCE = total - paid
const calcBalance = (total, paid) => round2(Math.max(total - paid, 0));

function paymentStatusFor(total, paid) {
  if (paid <= 0) return 'UNPAID';
  if (paid + 0.001 >= total) return 'PAID';
  return 'PARTIAL';
}

// LOW STOCK = quantity <= minimumStock
const isLowStock = (quantity, minStock) => Number(quantity) <= Number(minStock);

module.exports = { round2, calcLineTotal, calcOrderTotals, calcBalance, paymentStatusFor, isLowStock };
