const { Product, Material, InventoryTransaction, Branch } = require('../models');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');
const { INVENTORY_TX_TYPES: T } = require('../config/constants');
const { notifyRoles } = require('./notification.service');
const { ROLES, WORKER_ROLES } = require('../config/constants');

const EXTRA_COUNTERS = {
  PRODUCT: { [T.SALE]: 'soldQuantity', [T.DAMAGED]: 'damagedQuantity', [T.RETURN]: 'soldQuantity' },
  MATERIAL: {},
};

/** The branch stock belongs to when none is given: the configured default, else the first branch. */
async function defaultBranchId(session) {
  const { getSettings } = require('./settings.service');
  const settings = await getSettings();
  if (settings.defaultBranch) return settings.defaultBranch;
  const first = await Branch.findOne({ isActive: true }).sort({ createdAt: 1 }).select('_id').session(session || null).lean();
  return first?._id || null;
}

const sameId = (a, b) => String(a) === String(b);

/**
 * The only way stock changes. Applies a signed quantity change to one branch's stock
 * atomically (a decrease succeeds only if that branch has enough at write time), keeps the
 * company-wide total in step, and writes the matching ledger entry.
 * Returns { item, lowStock, crossedLowStock }.
 */
async function adjustStock({ itemType, itemId, delta, type, reference = {}, note, unitCost, userId, session, branch }) {
  if (!delta) throw ApiError.badRequest('Quantity must not be zero.');
  const Model = itemType === 'PRODUCT' ? Product : Material;
  const change = round2(delta);
  const fallback = await defaultBranchId(session);
  // With no branches set up, stock is a single company-wide count (as before branches existed).
  const branchId = branch || fallback || null;

  const inc = { quantity: change };
  const counter = EXTRA_COUNTERS[itemType][type];
  if (counter) inc[counter] = type === T.RETURN ? -Math.abs(change) : Math.abs(change);

  let before = await Model.findById(itemId).select('quantity minStock name branchStock').session(session).lean();
  if (!before) throw ApiError.notFound(`${itemType === 'PRODUCT' ? 'Product' : 'Material'} not found.`);
  // Stock recorded before branches were tracked belongs to the default branch.
  if (branchId && !before.branchStock?.length && before.quantity > 0 && fallback) {
    await Model.updateOne({ _id: itemId, 'branchStock.0': { $exists: false } }, { $set: { branchStock: [{ branch: fallback, quantity: before.quantity }] } }, { session });
    before = await Model.findById(itemId).select('quantity minStock name branchStock').session(session).lean();
  }
  const atBranch = (before.branchStock || []).find((b) => sameId(b.branch, branchId))?.quantity || 0;

  let item;
  if (!branchId) {
    const filter = change < 0 ? { _id: itemId, quantity: { $gte: Math.abs(change) - 1e-9 } } : { _id: itemId };
    item = await Model.findOneAndUpdate(filter, { $inc: inc }, { new: true, session });
    if (!item) throw ApiError.conflict(`Insufficient inventory for ${before.name}. Available: ${before.quantity}, requested: ${Math.abs(change)}.`);
  } else if (change < 0) {
    item = await Model.findOneAndUpdate(
      { _id: itemId, branchStock: { $elemMatch: { branch: branchId, quantity: { $gte: Math.abs(change) - 1e-9 } } } },
      { $inc: { ...inc, 'branchStock.$.quantity': change } },
      { new: true, session }
    );
    if (!item) {
      const branchName = (await Branch.findById(branchId).select('name').session(session).lean())?.name || 'this branch';
      throw ApiError.conflict(`Insufficient inventory for ${before.name} at ${branchName}. Available: ${atBranch}, requested: ${Math.abs(change)}.`);
    }
  } else {
    item =
      (await Model.findOneAndUpdate({ _id: itemId, 'branchStock.branch': branchId }, { $inc: { ...inc, 'branchStock.$.quantity': change } }, { new: true, session })) ||
      (await Model.findOneAndUpdate({ _id: itemId, 'branchStock.branch': { $ne: branchId } }, { $inc: inc, $push: { branchStock: { branch: branchId, quantity: change } } }, { new: true, session }));
  }
  if (item.soldQuantity < 0) item.soldQuantity = 0;
  // $inc on floats can leave tiny residues (e.g. 2.9999999); normalise.
  item.quantity = round2(item.quantity);
  item.branchStock.forEach((b) => {
    b.quantity = round2(b.quantity);
  });
  if (item.isModified()) await item.save({ session });
  const branchBalance = branchId ? (item.branchStock.find((b) => sameId(b.branch, branchId))?.quantity ?? 0) : undefined;

  await InventoryTransaction.create(
    [
      {
        itemType,
        product: itemType === 'PRODUCT' ? itemId : undefined,
        material: itemType === 'MATERIAL' ? itemId : undefined,
        type,
        quantity: change,
        balanceAfter: item.quantity,
        branch: branchId || undefined,
        branchBalanceAfter: branchBalance,
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

/** Moves stock between branches as a matching out/in pair in one transaction. */
async function transferStock({ itemType, itemId, from, to, quantity, note, userId }) {
  if (sameId(from, to)) throw ApiError.badRequest('Choose two different branches.');
  const { withTransaction } = require('../utils/transaction');
  return withTransaction(async (session) => {
    const [fromBranch, toBranch] = await Promise.all([Branch.findById(from).session(session).lean(), Branch.findById(to).session(session).lean()]);
    if (!fromBranch || !toBranch) throw ApiError.notFound('Branch not found.');
    const text = note ? ` — ${note}` : '';
    await adjustStock({ itemType, itemId, delta: -quantity, type: T.TRANSFER, branch: from, note: `Transfer to ${toBranch.name}${text}`, userId, session });
    const result = await adjustStock({ itemType, itemId, delta: quantity, type: T.TRANSFER, branch: to, note: `Transfer from ${fromBranch.name}${text}`, userId, session });
    return result.item;
  });
}

/** An item's stock at one branch (legacy stock without a branch split counts as the default branch's). */
async function quantityAt(item, branchId) {
  if (!branchId) return item.quantity || 0;
  if (item.branchStock?.length) return item.branchStock.find((b) => sameId(b.branch, branchId))?.quantity || 0;
  return sameId(await defaultBranchId(), branchId) ? item.quantity || 0 : 0;
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

module.exports = { adjustStock, transferStock, quantityAt, defaultBranchId, alertIfCrossed, sendLowStockAlert, MANUAL_TYPES };
