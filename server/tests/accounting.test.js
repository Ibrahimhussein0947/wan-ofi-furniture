const { api, createUser, models } = require('./helpers');

describe('accounting', () => {
  let owner;
  let accountant;

  beforeAll(async () => {
    owner = await createUser('OWNER');
    accountant = await createUser('ACCOUNTANT');
    await models.Setting.create({ key: 'global', largeExpenseThreshold: 1000000 });
  });

  test('small expenses are booked immediately', async () => {
    const res = await api(accountant.token).post('/api/expenses', { category: 'UTILITIES', amount: 250000, description: 'Electricity bill', method: 'MOBILE_PAYMENT' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('APPROVED');
    expect(await models.FinancialTransaction.countDocuments({ expense: res.body.data._id, type: 'EXPENSE', direction: 'OUT' })).toBe(1);
  });

  test('large expenses wait for owner approval before reaching the ledger', async () => {
    const res = await api(accountant.token).post('/api/expenses', { category: 'EQUIPMENT', amount: 5000000, description: 'CNC machine', method: 'BANK_TRANSFER' });
    expect(res.body.data.status).toBe('PENDING');
    expect(await models.FinancialTransaction.countDocuments({ expense: res.body.data._id })).toBe(0);
    expect(await models.Notification.exists({ recipient: owner.user._id, type: 'APPROVAL_REQUIRED' })).toBeTruthy();

    expect((await api(accountant.token).post(`/api/expenses/${res.body.data._id}/decision`, { approve: true })).status).toBe(403);
    const approved = await api(owner.token).post(`/api/expenses/${res.body.data._id}/decision`, { approve: true });
    expect(approved.body.data.status).toBe('APPROVED');
    expect(await models.FinancialTransaction.countDocuments({ expense: res.body.data._id })).toBe(1);
  });

  test('booked expenses cannot be deleted or have their amount changed', async () => {
    const res = await api(accountant.token).post('/api/expenses', { category: 'TRANSPORT', amount: 50000, description: 'Fuel' });
    expect((await api(accountant.token).delete(`/api/expenses/${res.body.data._id}`)).status).toBe(400);
    const edit = await api(accountant.token).patch(`/api/expenses/${res.body.data._id}`, { amount: 1 });
    expect(edit.status).toBe(400);
    expect((await api(accountant.token).patch(`/api/expenses/${res.body.data._id}`, { description: 'Diesel for truck' })).status).toBe(200);
  });

  test('worker payments are recorded in the ledger', async () => {
    const worker = await createUser('WORKER', { workerRole: 'CARPENTER' });
    const profile = await models.Worker.findOne({ user: worker.user._id });
    const res = await api(accountant.token).post('/api/payments/worker', { worker: String(profile._id), amount: 600000, method: 'BANK_TRANSFER', period: 'May 2026' });
    expect(res.status).toBe(201);
    expect((await models.Worker.findById(profile._id)).totalPaid).toBe(600000);
    expect(await models.FinancialTransaction.countDocuments({ worker: profile._id, type: 'WORKER_PAYMENT' })).toBe(1);
  });

  test('profit & loss adds income and subtracts costs', async () => {
    await api(accountant.token).post('/api/accounting/income', { amount: 1000000, method: 'CASH', description: 'Sold offcuts' });
    const res = await api(accountant.token).get('/api/reports/profit-loss');
    expect(res.status).toBe(200);
    const { totals } = res.body.data;
    expect(totals.income).toBe(1000000);
    expect(totals.expenses).toBe(250000 + 5000000 + 50000);
    expect(totals.workerPayments).toBe(600000);
    expect(totals.profit).toBe(totals.netIncome - totals.totalCosts);
  });

  test('dashboards are role specific', async () => {
    const ownerDash = await api(owner.token).get('/api/dashboard');
    expect(ownerDash.body.data.role).toBe('OWNER');
    expect(ownerDash.body.data.kpis).toHaveProperty('netProfit');
    expect(ownerDash.body.data.revenueSeries.length).toBeGreaterThanOrEqual(12);

    const accDash = await api(accountant.token).get('/api/dashboard');
    expect(accDash.body.data.kpis).toHaveProperty('outstandingCustomer');
    expect(accDash.body.data.kpis.pendingExpenses).toBe(0);
  });

  test('ledger entries are listed with filters', async () => {
    const res = await api(accountant.token).get('/api/accounting/transactions?type=EXPENSE');
    expect(res.status).toBe(200);
    expect(res.body.data.every((t) => t.type === 'EXPENSE')).toBe(true);
    expect(res.body.pagination.total).toBe(3);
  });
});
