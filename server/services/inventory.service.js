const { Product, Material, InventoryTransaction } = require('../models');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');
const { INVENTORY_TX_TYPES: T } = require('../config/constants');
const { notifyRoles } = require('./notification.service');
const { ROLES, WORKER_ROLES } = require('../config/constants');

const EXTRA_COUNTERS = {
  PRODUCT: { [T.SALE]: 'soldQuantity', [T.DAMAGED]: 'damagedQuantity', [T.RETURN]: 'soldQuantity' },
  MATERIAL: {},
};

/**
 * The only way stock changes. Applies a signed quantity change atomically (a decrease
 * succeeds only if enough stock exists at write time) and writes the matching ledger entry.
 * Returns { item, lowStock, crossedLowStock }.
 */
async function adjustStock({ itemType, itemId, delta, type, reference = {}, note, unitCost, userId, session }) {
  if (!delta) throw ApiError.badRequest('Quantity must not be zero.');
  const Model = itemType === 'PRODUCT' ? Product : Material;
  const change = round2(delta);

  const inc = { quantity: change };
  const counter = EXTRA_COUNTERS[itemType][type];
  if (counter) inc[counter] = type === T.RETURN ? -Math.abs(change) : Math.abs(change);

  const filter = { _id: itemId };
  if (change < 0) filter.quantity = { $gte: Math.abs(change) };

  const before = await Model.findById(itemId).select('quantity minStock name').session(session).lean();
  if (!before) throw ApiError.notFound(`${itemType === 'PRODUCT' ? 'Product' : 'Material'} not found.`);

  const item = await Model.findOneAndUpdate(filter, { $inc: inc }, { new: true, session });
  if (!item) {
    throw ApiError.conflict(`Insufficient inventory for ${before.name}. Available: ${before.quantity}, requested: ${Math.abs(change)}.`);
  }
  if (item.soldQuantity < 0) {
    item.soldQuantity = 0;
    await item.save({ session });
  }
  // $inc on floats can leave tiny residues (e.g. 2.9999999); normalise.
  if (item.quantity !== round2(item.quantity)) {
    item.quantity = round2(item.quantity);
    await item.save({ session });
  }

  await InventoryTransaction.create(
    [
      {
        itemType,
        product: itemType === 'PRODUCT' ? itemId : undefined,
        material: itemType === 'MATERIAL' ? itemId : undefined,
        type,
        quantity: change,
        balanceAfter: item.quantity,
        unitCost,
        referenceModel: reference.model,
        referenceId: reference.id,
        referenceNumber: reference.number,
        note,
        createdBy: userId,
      },
    ],
    { session }
  );

  const lowStock = item.quantity <= item.minStock;
  const crossedLowStock = lowStock && before.quantity > before.minStock;
  return { item, lowStock, crossedLowStock };
}

async function sendLowStockAlert(itemType, item) {
  const isMaterial = itemType === 'MATERIAL';
  return notifyRoles(
    { roles: [ROLES.OWNER], workerRoles: isMaterial ? [WORKER_ROLES.SUPERVISOR] : [] },
    {
      type: 'LOW_STOCK',
      title: `Low stock: ${item.name}`,
      message: `${item.name} is at ${item.quantity}${isMaterial ? ` ${item.unit}` : ''} (minimum ${item.minStock}).`,
      link: isMaterial ? `/app/materials?lowStock=true` : `/app/inventory`,
      data: { itemType, itemId: item._id },
    }
  );
}

/** Registers low-stock alerts to fire once the surrounding transaction commits. */
function alertIfCrossed(result, itemType, afterCommit) {
  if (result.crossedLowStock) afterCommit(() => sendLowStockAlert(itemType, result.item));
}

const MANUAL_TYPES = {
  STOCK_IN: 1,
  STOCK_OUT: -1,
  DAMAGED: -1,
  RETURN: 1,
  ADJUSTMENT: 0, // sign given by the caller
};

module.exports = { adjustStock, alertIfCrossed, sendLowStockAlert, MANUAL_TYPES };
