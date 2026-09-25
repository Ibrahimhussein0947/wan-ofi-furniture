const { FinancialTransaction } = require('../models');
const { nextNumber } = require('../models/Counter');
const { TRANSACTION_DIRECTION } = require('../config/constants');
const { round2 } = require('../utils/money');

/**
 * Appends an entry to the general ledger. Ledger entries are immutable; the
 * number is generated before the transaction so retries never collide.
 */
async function recordLedgerEntry(entry, session, transactionNumber) {
  const number = transactionNumber || (await nextNumber('TXN', { pad: 5 }));
  const [doc] = await FinancialTransaction.create(
    [
      {
        ...entry,
        transactionNumber: number,
        amount: round2(entry.amount),
        direction: TRANSACTION_DIRECTION[entry.type],
        date: entry.date || new Date(),
      },
    ],
    { session }
  );
  return doc;
}

module.exports = { recordLedgerEntry };
