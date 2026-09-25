const { Order, Invoice } = require('../models');
const { nextNumber } = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { AUDIT_ACTIONS } = require('../config/constants');
const { getSettings } = require('./settings.service');
const { audit } = require('./audit.service');

/** Issues the invoice for an order, or returns the active one if it already exists. */
async function issueInvoice(orderId, { dueDate, notes } = {}, actor) {
  const order = await Order.findById(orderId).lean();
  if (!order) throw ApiError.notFound('Order not found.');
  if (order.status === 'CANCELLED') throw ApiError.badRequest('Cannot invoice a cancelled order.');

  const existing = await Invoice.findOne({ order: order._id, status: { $ne: 'VOID' } });
  if (existing) return existing;

  const settings = await getSettings();
  const invoice = await Invoice.create({
    invoiceNumber: await nextNumber('INV'),
    order: order._id,
    customer: order.customer,
    lines: order.items.map((i) => ({
      description: [i.name, i.color, i.size].filter(Boolean).join(' — '),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    deliveryFee: order.deliveryFee,
    taxRate: order.taxRate || 0,
    tax: order.tax || 0,
    total: order.total,
    amountPaid: order.amountPaid,
    balance: order.balance,
    status: order.balance <= 0 ? 'PAID' : order.amountPaid > 0 ? 'PARTIALLY_PAID' : 'ISSUED',
    dueDate: dueDate || new Date(Date.now() + settings.invoiceDueDays * 24 * 3600 * 1000),
    notes,
    createdBy: actor?.user?._id,
  });
  if (actor) {
    await audit(actor, { action: AUDIT_ACTIONS.CREATE, entity: 'Invoice', entityId: invoice._id, reference: invoice.invoiceNumber, amount: invoice.total, description: `Invoice for ${order.orderNumber}` });
  }
  return invoice;
}

async function voidInvoice(invoiceId, reason, actor) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw ApiError.notFound('Invoice not found.');
  if (invoice.status === 'VOID') throw ApiError.badRequest('Invoice is already void.');
  invoice.status = 'VOID';
  invoice.notes = [invoice.notes, `VOID: ${reason}`].filter(Boolean).join('\n');
  await invoice.save();
  await audit(actor, { action: AUDIT_ACTIONS.UPDATE, entity: 'Invoice', entityId: invoice._id, reference: invoice.invoiceNumber, description: `Invoice voided: ${reason}` });
  return invoice;
}

module.exports = { issueInvoice, voidInvoice };
