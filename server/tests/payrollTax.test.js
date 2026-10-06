const { models, createUser, api } = require('./helpers');

const month = () => new Date().toISOString().slice(0, 7);

describe('worker tax payroll', () => {
  test('the admin assigns a tax rate and payroll withholds it, tracking the level reached', async () => {
    const owner = await createUser('OWNER');
    const worker = await createUser('WORKER', { workerRole: 'CARPENTER' });
    const profile = await models.Worker.findOne({ user: worker.user._id });
    await models.Worker.updateOne({ _id: profile._id }, { wageType: 'MONTHLY', wageRate: 10000 });

    // The administrator gives the worker a 10% tax.
    const set = await api(owner.token).patch(`/api/workers/${profile._id}`, { taxRate: 10 });
    expect(set.status).toBe(200);
    expect((await models.Worker.findById(profile._id)).taxRate).toBe(10);

    const rowOf = async () => (await api(owner.token).get(`/api/workers/payroll?month=${month()}`)).body.data.rows.find((r) => r.worker._id === String(profile._id));

    // Nothing paid yet: the system counts the month's pay, tax is withheld and none of it is reached.
    expect(await rowOf()).toMatchObject({ earned: 10000, tax: 1000, net: 9000, paid: 0, due: 9000, taxWithheld: 0, taxRemaining: 1000 });

    // Half the net wage paid → half of the tax reached, half still due.
    await api(owner.token).post('/api/payments/worker', { worker: String(profile._id), amount: 4500, method: 'CASH', kind: 'WAGE', payPeriod: month() });
    expect(await rowOf()).toMatchObject({ paid: 4500, due: 4500, taxWithheld: 500, taxRemaining: 500 });

    // Paying the rest of the net wage reaches 100% of the tax and closes the month.
    await api(owner.token).post('/api/payments/worker', { worker: String(profile._id), amount: 4500, method: 'CASH', kind: 'WAGE', payPeriod: month() });
    expect(await rowOf()).toMatchObject({ paid: 9000, due: 0, taxWithheld: 1000, taxRemaining: 0 });
  });

  test('a worker without a tax rate keeps the previous behaviour: due = earned − paid', async () => {
    const owner = await createUser('OWNER');
    const worker = await createUser('WORKER', { workerRole: 'UPHOLSTERER' });
    const profile = await models.Worker.findOne({ user: worker.user._id });
    await models.Worker.updateOne({ _id: profile._id }, { wageType: 'MONTHLY', wageRate: 5000 });
    const monthNow = month();

    const rowOf = async () => (await api(owner.token).get(`/api/workers/payroll?month=${monthNow}`)).body.data.rows.find((r) => r.worker._id === String(profile._id));

    // No tax assigned → net equals earnings and there is no tax to reach.
    expect(await rowOf()).toMatchObject({ taxRate: 0, tax: 0, earned: 5000, net: 5000, paid: 0, due: 5000, taxWithheld: 0, taxRemaining: 0 });

    // Paying part of it simply reduces what is due.
    await api(owner.token).post('/api/payments/worker', { worker: String(profile._id), amount: 2000, method: 'CASH', kind: 'WAGE', payPeriod: monthNow });
    expect(await rowOf()).toMatchObject({ paid: 2000, due: 3000, taxWithheld: 0, taxRemaining: 0 });
  });

  test('the tax rate is validated between 0 and 100', async () => {
    const owner = await createUser('OWNER');
    const worker = await createUser('WORKER', { workerRole: 'PAINTER' });
    const profile = await models.Worker.findOne({ user: worker.user._id });
    expect((await api(owner.token).patch(`/api/workers/${profile._id}`, { taxRate: 150 })).status).toBe(400);
    expect((await api(owner.token).patch(`/api/workers/${profile._id}`, { taxRate: -5 })).status).toBe(400);
    expect((await api(owner.token).patch(`/api/workers/${profile._id}`, { taxRate: 12.5 })).status).toBe(200);
    expect((await models.Worker.findById(profile._id)).taxRate).toBe(12.5);
  });

  test('workers cannot change their own tax or read payroll', async () => {
    const worker = await createUser('WORKER', { workerRole: 'CARPENTER' });
    const profile = await models.Worker.findOne({ user: worker.user._id });
    expect((await api(worker.token).patch(`/api/workers/${profile._id}`, { taxRate: 0 })).status).toBe(403);
    expect((await api(worker.token).get(`/api/workers/payroll?month=${month()}`)).status).toBe(403);
  });
});
