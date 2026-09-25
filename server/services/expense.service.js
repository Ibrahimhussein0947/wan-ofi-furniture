const { Expense } = require('../models');
const { nextNumber } = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { withTransaction } = require('../utils/transaction');
const { EXPENSE_STATUS, AUDIT_ACTIONS, TRANSACTION_TYPES, ROLES } = require('../config/constants');
const { getSettings } = require('./settings.service');
const { recordLedgerEntry } = require('./ledger.service');
const { audit, diff } = require('./audit.service');
const notify = require('./notification.service');

function bookExpense(expense, actor, session) {
  return recordLedgerEntry(
    {
      type: TRANSACTION_TYPES.EXPENSE,
      amount: expense.amount,
      method: expense.method,
      expense: expense._id,
      category: expense.category,
      date: expense.date,
      description: `${expense.category.toLowerCase()}: ${expense.description}`,
      createdBy: actor.user._id,
    },
    session
  );
}

/**
 * Records an expense. Amounts above the owner's threshold wait for owner approval;
 * only approved expenses reach the ledger.
 */
async function createExpense(input, actor) {
  const settings = await getSettings();
  const needsApproval = input.amount > settings.largeExpenseThreshold && actor.user.role !== ROLES.OWNER;
  const expenseNumber = await nextNumber('EXP');

  const expense = await withTransaction(async (session) => {
    const [doc] = await Expense.create(
      [
        {
          ...input,
          branch: input.branch || actor.user.branch || settings.defaultBranch || null,
          expenseNumber,
          status: needsApproval ? EXPENSE_STATUS.PENDING : EXPENSE_STATUS.APPROVED,
          approvedBy: needsApproval ? undefined : actor.user._id,
          approvedAt: needsApproval ? undefined : new Date(),
          createdBy: actor.user._id,
        },
      ],
      { session }
    );
    if (!needsApproval) await bookExpense(doc, actor, session);
    return doc;
  });

  await audit(actor, { action: AUDIT_ACTIONS.CREATE, entity: 'Expense', entityId: expense._id, reference: expense.expenseNumber, amount: expense.amount, description: expense.description });
  const payload = {
    type: needsApproval ? 'APPROVAL_REQUIRED' : 'NEW_EXPENSE',
    title: needsApproval ? `Expense needs approval: ${expense.amount.toLocaleString()} ${settings.currency}` : `New expense: ${expense.amount.toLocaleString()} ${settings.currency}`,
    message: `${expense.category} — ${expense.description}`,
    link: `/app/expenses?status=${expense.status}`,
  };
  if (needsApproval || expense.amount > settings.largeExpenseThreshold) {
    await notify.notifyOwners({ ...payload, type: needsApproval ? 'APPROVAL_REQUIRED' : 'LARGE_EXPENSE' });
  }
  await notify.notifyAccountants(payload);
  return expense;
}

async function decideExpense(expenseId, { approve, reason }, actor) {
  const expense = await withTransaction(async (session) => {
    const doc = await Expense.findOneAndUpdate(
      { _id: expenseId, status: EXPENSE_STATUS.PENDING },
      {
        $set: approve
          ? { status: EXPENSE_STATUS.APPROVED, approvedBy: actor.user._id, approvedAt: new Date() }
          : { status: EXPENSE_STATUS.REJECTED, rejectionReason: reason, approvedBy: actor.user._id, approvedAt: new Date() },
      },
      { new: true, session }
    );
    if (!doc) throw ApiError.badRequest('This expense is not awaiting approval.');
    if (approve) await bookExpense(doc, actor, session);
    return doc;
  });
  await audit(actor, {
    action: AUDIT_ACTIONS.APPROVAL,
    entity: 'Expense',
    entityId: expense._id,
    reference: expense.expenseNumber,
    amount: expense.amount,
    description: approve ? 'Expense approved' : `Expense rejected: ${reason || ''}`,
  });
  await notify.notifyUsers([expense.createdBy], {
    type: 'GENERAL',
    title: `Expense ${expense.expenseNumber} ${approve ? 'approved' : 'rejected'}`,
    message: approve ? expense.description : reason || expense.description,
    link: '/app/expenses',
  });
  return expense;
}

/** Only descriptive fields of a booked expense may change; amounts are corrected by a new entry. */
async function updateExpense(expenseId, changes, actor) {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw ApiError.notFound('Expense not found.');
  const editable = expense.status === EXPENSE_STATUS.PENDING ? ['description', 'vendor', 'reference', 'category', 'amount', 'date', 'method'] : ['description', 'vendor', 'reference'];
  const blocked = Object.keys(changes).filter((k) => changes[k] !== undefined && !editable.includes(k));
  if (blocked.length) throw ApiError.badRequest(`Approved expenses cannot change: ${blocked.join(', ')}. Record a correcting entry instead.`);
  const before = expense.toObject();
  Object.assign(expense, changes);
  await expense.save();
  await audit(actor, { action: AUDIT_ACTIONS.UPDATE, entity: 'Expense', entityId: expense._id, reference: expense.expenseNumber, changes: diff(before, expense.toObject(), editable) });
  return expense;
}

async function deleteExpense(expenseId, actor) {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw ApiError.notFound('Expense not found.');
  if (expense.status === EXPENSE_STATUS.APPROVED) throw ApiError.badRequest('Approved expenses are part of the books and cannot be deleted.');
  await expense.softDelete(actor.user._id);
  await audit(actor, { action: AUDIT_ACTIONS.DELETE, entity: 'Expense', entityId: expense._id, reference: expense.expenseNumber, amount: expense.amount });
}

module.exports = { createExpense, decideExpense, updateExpense, deleteExpense };
