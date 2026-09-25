const { PurchaseOrder, Supplier, Material } = require('../models');
const { nextNumber } = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');
const { withTransaction } = require('../utils/transaction');
const { PURCHASE_STATUS: PS, AUDIT_ACTIONS, INVENTORY_TX_TYPES, TRANSACTION_TYPES } = require('../config/constants');
const { adjustStock } = require('./inventory.service');
const { recordLedgerEntry } = require('./ledger.service');
const { audit } = require('./audit.service');

async function createPurchaseOrder({ supplier, items, expectedDate, notes, status }, actor) {
  const sup = await Supplier.findById(supplier).lean();
  if (!sup) throw ApiError.notFound('Supplier not found.');
  const materials = await Material.find({ _id: { $in: items.map((i) => i.material) } }).lean();
  if (materials.length !== new Set(items.map((i) => String(i.material))).size) throw ApiError.badRequest('Unknown material in purchase order.');

  const lines = items.map((i) => ({
    ...i,
    materialName: materials.find((m) => String(m._id) === String(i.material)).name,
  }));
  const po = await PurchaseOrder.create({
    poNumber: await nextNumber('PO'),
    supplier,
    items: lines,
    total: round2(lines.reduce((s, i) => s + i.quantity * i.unitCost, 0)),
    expectedDate,
    notes,
    status: status === PS.DRAFT ? PS.DRAFT : PS.ORDERED,
    createdBy: actor.user._id,
  });
  await audit(actor, { action: AUDIT_ACTIONS.CREATE, entity: 'PurchaseOrder', entityId: po._id, reference: po.poNumber, amount: po.total, description: `Purchase order to ${sup.name}` });
  return po;
}

/**
 * Receives delivered goods: stock goes up (with ledger entries), the material's
 * unit cost is refreshed, and the supplier balance grows by the value received.
 */
async function receivePurchaseOrder(poId, { items }, actor) {
  return withTransaction(async (session, afterCommit) => {
    const po = await PurchaseOrder.findById(poId).session(session);
    if (!po) throw ApiError.notFound('Purchase order not found.');
    if ([PS.RECEIVED, PS.CANCELLED].includes(po.status)) throw ApiError.badRequest(`Purchase order is already ${po.status.toLowerCase()}.`);

    // Default: receive everything still outstanding.
    const receipts =
      items && items.length
        ? items
        : po.items.map((l) => ({ itemId: l._id, quantity: round2(l.quantity - l.receivedQuantity) })).filter((r) => r.quantity > 0);

    let value = 0;
    for (const { itemId, quantity } of receipts) {
      const line = po.items.id(itemId);
      if (!line) throw ApiError.badRequest('Unknown purchase order line.');
      const outstanding = round2(line.quantity - line.receivedQuantity);
      if (quantity > outstanding + 1e-9) throw ApiError.badRequest(`Cannot receive more ${line.materialName} than ordered (outstanding ${outstanding}).`);
      await adjustStock({
        itemType: 'MATERIAL',
        itemId: line.material,
        delta: quantity,
        type: INVENTORY_TX_TYPES.PURCHASE_RECEIPT,
        unitCost: line.unitCost,
        reference: { model: 'PurchaseOrder', id: po._id, number: po.poNumber },
        note: `Received from ${po.poNumber}`,
        userId: actor.user._id,
        session,
      });
      await Material.updateOne(
        { _id: line.material },
        { $set: { unitCost: line.unitCost, supplier: po.supplier, purchaseDate: new Date() } },
        { session }
      );
      line.receivedQuantity = round2(line.receivedQuantity + quantity);
      value += quantity * line.unitCost;
    }
    value = round2(value);

    const fullyReceived = po.items.every((l) => l.receivedQuantity + 1e-9 >= l.quantity);
    po.status = fullyReceived ? PS.RECEIVED : PS.PARTIALLY_RECEIVED;
    po.receivedValue = round2(po.receivedValue + value);
    if (fullyReceived) po.receivedDate = new Date();
    await po.save({ session });

    await Supplier.updateOne({ _id: po.supplier }, { $inc: { balance: value } }, { session });
    await recordLedgerEntry(
      {
        type: TRANSACTION_TYPES.PURCHASE,
        amount: value,
        supplier: po.supplier,
        purchaseOrder: po._id,
        description: `Materials received on ${po.poNumber}`,
        createdBy: actor.user._id,
      },
      session
    );
    afterCommit(() =>
      audit(actor, {
        action: AUDIT_ACTIONS.INVENTORY_CHANGE,
        entity: 'PurchaseOrder',
        entityId: po._id,
        reference: po.poNumber,
        amount: value,
        description: `Goods received (${fullyReceived ? 'complete' : 'partial'})`,
      })
    );
    return po;
  });
}

async function cancelPurchaseOrder(poId, reason, actor) {
  const po = await PurchaseOrder.findById(poId);
  if (!po) throw ApiError.notFound('Purchase order not found.');
  if (po.items.some((l) => l.receivedQuantity > 0)) throw ApiError.badRequest('Goods have already been received on this purchase order.');
  if (po.amountPaid > 0) throw ApiError.badRequest('This purchase order has payments recorded against it.');
  po.status = PS.CANCELLED;
  po.notes = [po.notes, `Cancelled: ${reason || ''}`].filter(Boolean).join('\n');
  await po.save();
  await audit(actor, { action: AUDIT_ACTIONS.STATUS_CHANGE, entity: 'PurchaseOrder', entityId: po._id, reference: po.poNumber, description: `Cancelled: ${reason || ''}` });
  return po;
}

module.exports = { createPurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder };
