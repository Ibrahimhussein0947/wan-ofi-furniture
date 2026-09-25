const { api, createUser, createCatalog, models } = require('./helpers');
const { QC_CHECK_ITEMS } = require('../config/constants');

const allChecks = (passed = true) => Object.fromEntries(QC_CHECK_ITEMS.map((k) => [k, { passed }]));

describe('production workflow', () => {
  let owner;
  let accountant;
  let supervisor;
  let carpenter;
  let painter;
  let outsider;
  let installer;
  let customer;

  beforeAll(async () => {
    owner = await createUser('OWNER');
    accountant = await createUser('ACCOUNTANT');
    supervisor = await createUser('WORKER', { workerRole: 'SUPERVISOR' });
    carpenter = await createUser('WORKER', { workerRole: 'CARPENTER' });
    painter = await createUser('WORKER', { workerRole: 'PAINTER' });
    outsider = await createUser('WORKER', { workerRole: 'CARPENTER' });
    installer = await createUser('WORKER', { workerRole: 'INSTALLER' });
    customer = await createUser('CUSTOMER');
    await models.Setting.create({ key: 'global', depositPercent: 50 });
  });

  async function confirmedJob(quantity = 1) {
    const { product, wood, glue } = await createCatalog({ quantity: 0 });
    const order = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity }], deliveryMethod: 'DELIVERY', deliveryAddress: { city: 'Arusha' } });
    await api(accountant.token).post('/api/payments/customer', { order: order.body.data._id, amount: order.body.data.depositRequired, method: 'CASH' });
    const job = await models.ProductionJob.findOne({ order: order.body.data._id });
    return { job, orderId: order.body.data._id, wood, glue, total: order.body.data.total };
  }

  test('supervisor assigns workers; workers are notified and see only their jobs', async () => {
    const { job } = await confirmedJob();
    const res = await api(supervisor.token).post(`/api/production/${job._id}/assign`, { workerIds: [String(carpenter.user._id), String(painter.user._id)] });
    expect(res.status).toBe(200);
    expect(res.body.data.stage).toBe('APPROVED');
    expect(await models.Notification.countDocuments({ recipient: carpenter.user._id, type: 'JOB_ASSIGNED' })).toBe(1);

    const mine = await api(carpenter.token).get('/api/production');
    expect(mine.body.data.map((j) => j._id)).toContain(String(job._id));
    const theirs = await api(outsider.token).get('/api/production');
    expect(theirs.body.data.map((j) => j._id)).not.toContain(String(job._id));
    expect((await api(outsider.token).get(`/api/production/${job._id}`)).status).toBe(403);

    // Workers see requirements but not the customer's contact details.
    const detail = await api(carpenter.token).get(`/api/production/${job._id}`);
    expect(detail.body.data.customer.phone).toBeUndefined();
  });

  test('workers cannot assign jobs or issue materials', async () => {
    const { job } = await confirmedJob();
    expect((await api(carpenter.token).post(`/api/production/${job._id}/assign`, { workerIds: [] })).status).toBe(403);
    expect((await api(carpenter.token).post(`/api/production/${job._id}/issue-materials`, {})).status).toBe(403);
  });

  test('production cannot start before materials are issued; issuing deducts BOM stock', async () => {
    const { job, wood, glue } = await confirmedJob(2);
    await api(supervisor.token).post(`/api/production/${job._id}/assign`, { workerIds: [String(carpenter.user._id)] });

    const early = await api(carpenter.token).post(`/api/production/${job._id}/stage`, { stage: 'IN_PRODUCTION' });
    expect(early.status).toBe(400);

    const issued = await api(supervisor.token).post(`/api/production/${job._id}/issue-materials`, {});
    expect(issued.status).toBe(200);
    expect(issued.body.data.stage).toBe('MATERIALS_READY');
    expect((await models.Material.findById(wood._id)).quantity).toBe(60);
    expect((await models.Material.findById(glue._id)).quantity).toBe(6);
    expect(await models.InventoryTransaction.countDocuments({ referenceId: job._id, type: 'PRODUCTION_ISSUE' })).toBe(2);

    const started = await api(carpenter.token).post(`/api/production/${job._id}/stage`, { stage: 'IN_PRODUCTION' });
    expect(started.status).toBe(200);
    const order = await models.Order.findById(job.order);
    expect(order.status).toBe('IN_PRODUCTION');
    expect(await models.Notification.exists({ type: 'PRODUCTION_STARTED' })).toBeTruthy();

    // Leftovers go back to stock through the ledger.
    const returned = await api(carpenter.token).post(`/api/production/${job._id}/return-materials`, { items: [{ material: String(wood._id), quantity: 5 }] });
    expect(returned.status).toBe(200);
    expect((await models.Material.findById(wood._id)).quantity).toBe(65);
    const overReturn = await api(carpenter.token).post(`/api/production/${job._id}/return-materials`, { items: [{ material: String(wood._id), quantity: 100 }] });
    expect(overReturn.status).toBe(400);
  });

  test('workers may only move jobs to stages allowed for their position', async () => {
    const { job } = await confirmedJob();
    await api(supervisor.token).post(`/api/production/${job._id}/assign`, { workerIds: [String(carpenter.user._id), String(painter.user._id)] });
    await api(supervisor.token).post(`/api/production/${job._id}/issue-materials`, {});

    const painterStart = await api(painter.token).post(`/api/production/${job._id}/stage`, { stage: 'IN_PRODUCTION' });
    expect(painterStart.status).toBe(403);
    expect((await api(carpenter.token).post(`/api/production/${job._id}/stage`, { stage: 'IN_PRODUCTION' })).status).toBe(200);
    expect((await api(carpenter.token).post(`/api/production/${job._id}/stage`, { stage: 'FINISHING' })).status).toBe(403);
    expect((await api(painter.token).post(`/api/production/${job._id}/stage`, { stage: 'FINISHING' })).status).toBe(200);
    // Skipping quality control is impossible, even for the owner.
    expect((await api(owner.token).post(`/api/production/${job._id}/stage`, { stage: 'READY_FOR_DELIVERY' })).status).toBe(400);
    expect((await api(painter.token).post(`/api/production/${job._id}/stage`, { stage: 'QUALITY_CHECK' })).status).toBe(200);
    expect(await models.QualityCheck.countDocuments({ job: job._id, status: 'PENDING' })).toBe(1);
  });

  test('failed quality control sends the job back for rework; passing makes the order ready', async () => {
    const { job, orderId } = await confirmedJob();
    await api(supervisor.token).post(`/api/production/${job._id}/assign`, { workerIds: [String(carpenter.user._id)] });
    await api(supervisor.token).post(`/api/production/${job._id}/issue-materials`, {});
    await api(supervisor.token).post(`/api/production/${job._id}/stage`, { stage: 'IN_PRODUCTION' });
    await api(supervisor.token).post(`/api/production/${job._id}/stage`, { stage: 'QUALITY_CHECK' });

    let qc = await models.QualityCheck.findOne({ job: job._id, status: 'PENDING' });
    const cannotPass = await api(supervisor.token).post(`/api/quality/${qc._id}/inspect`, { status: 'PASSED', checklist: { ...allChecks(), finishing: { passed: false } } });
    expect(cannotPass.status).toBe(400);

    const failed = await api(supervisor.token).post(`/api/quality/${qc._id}/inspect`, { status: 'REWORK_REQUIRED', checklist: { finishing: { passed: false, note: 'Uneven varnish' } }, notes: 'Re-sand and varnish' });
    expect(failed.status).toBe(200);
    let fresh = await models.ProductionJob.findById(job._id);
    expect(fresh.stage).toBe('IN_PRODUCTION');
    expect(fresh.reworkCount).toBe(1);
    expect(await models.Notification.exists({ recipient: carpenter.user._id, title: /Rework required/ })).toBeTruthy();

    await api(supervisor.token).post(`/api/production/${job._id}/stage`, { stage: 'QUALITY_CHECK' });
    qc = await models.QualityCheck.findOne({ job: job._id, status: 'PENDING' });
    expect(qc.attempt).toBe(2);
    const passed = await api(supervisor.token).post(`/api/quality/${qc._id}/inspect`, { status: 'PASSED', checklist: allChecks() });
    expect(passed.status).toBe(200);
    fresh = await models.ProductionJob.findById(job._id);
    expect(fresh).toMatchObject({ stage: 'READY_FOR_DELIVERY', progress: 100, qcStatus: 'PASSED' });
    expect((await models.Order.findById(orderId)).status).toBe('READY');
  });

  test('full workflow: delivery requires full payment, then the order completes', async () => {
    const { job, orderId, total } = await confirmedJob();
    await api(supervisor.token).post(`/api/production/${job._id}/assign`, { workerIds: [String(carpenter.user._id)] });
    await api(supervisor.token).post(`/api/production/${job._id}/issue-materials`, {});
    await api(supervisor.token).post(`/api/production/${job._id}/stage`, { stage: 'IN_PRODUCTION' });
    await api(supervisor.token).post(`/api/production/${job._id}/stage`, { stage: 'QUALITY_CHECK' });
    const qc = await models.QualityCheck.findOne({ job: job._id, status: 'PENDING' });
    await api(supervisor.token).post(`/api/quality/${qc._id}/inspect`, { status: 'PASSED', checklist: allChecks() });

    const delivery = await api(supervisor.token).post('/api/deliveries', { order: orderId, scheduledDate: new Date(Date.now() + 86400000).toISOString(), deliveryPerson: String(installer.user._id) });
    expect(delivery.status).toBe(201);
    expect(delivery.body.data.status).toBe('SCHEDULED');

    const dispatchUnpaid = await api(installer.token).patch(`/api/deliveries/${delivery.body.data._id}`, { status: 'OUT_FOR_DELIVERY' });
    expect(dispatchUnpaid.status).toBe(400);
    expect(dispatchUnpaid.body.message).toMatch(/remaining balance/);

    const order = await models.Order.findById(orderId);
    await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: order.balance, method: 'BANK_TRANSFER' });
    expect((await models.Order.findById(orderId)).amountPaid).toBe(total);

    expect((await api(installer.token).patch(`/api/deliveries/${delivery.body.data._id}`, { status: 'OUT_FOR_DELIVERY' })).status).toBe(200);
    expect((await models.Order.findById(orderId)).status).toBe('OUT_FOR_DELIVERY');
    const done = await api(installer.token).patch(`/api/deliveries/${delivery.body.data._id}`, { status: 'DELIVERED', receivedBy: 'Customer' });
    expect(done.status).toBe(200);

    const final = await models.Order.findById(orderId);
    expect(final).toMatchObject({ status: 'COMPLETED', deliveryStatus: 'DELIVERED', balance: 0 });
    expect((await models.ProductionJob.findById(job._id)).stage).toBe('DELIVERED');
    expect(await models.Notification.exists({ type: 'DELIVERED' })).toBeTruthy();

    // Customers can follow production progress on their order.
    const view = await api(customer.token).get(`/api/orders/${orderId}`);
    expect(view.body.data.production[0].stage).toBe('DELIVERED');
  });

  test('workers can report problems, request materials and add notes', async () => {
    const { job, glue } = await confirmedJob();
    await api(supervisor.token).post(`/api/production/${job._id}/assign`, { workerIds: [String(carpenter.user._id)] });

    expect((await api(carpenter.token).post(`/api/production/${job._id}/problems`, { description: 'Cracked plank', severity: 'HIGH' })).status).toBe(200);
    expect(await models.Notification.exists({ recipient: supervisor.user._id, type: 'PRODUCTION_PROBLEM' })).toBeTruthy();

    const req = await api(carpenter.token).post(`/api/production/${job._id}/material-requests`, { material: String(glue._id), quantity: 1, reason: 'Extra glue' });
    expect(req.status).toBe(200);
    const requestId = req.body.data.materialRequests[0]._id;
    const approved = await api(supervisor.token).post(`/api/production/${job._id}/material-requests/${requestId}`, { approve: true });
    expect(approved.status).toBe(200);
    expect(approved.body.data.materialRequests[0].status).toBe('ISSUED');

    expect((await api(carpenter.token).post(`/api/production/${job._id}/notes`, { text: 'Frame glued' })).status).toBe(200);
    const board = await api(supervisor.token).get('/api/production/board');
    expect(board.body.data.map((c) => c.key)).toEqual(['PENDING', 'MATERIALS', 'PRODUCTION', 'ASSEMBLY', 'FINISHING', 'QUALITY_CHECK', 'READY', 'COMPLETED']);
  });
});

describe('custom furniture requests', () => {
  let owner;
  let customer;
  beforeAll(async () => {
    owner = await createUser('OWNER');
    customer = await createUser('CUSTOMER');
  });

  test('request → estimate → quote → customer approval creates a custom order', async () => {
    const submitted = await api(customer.token).post('/api/custom-orders', {
      furnitureType: 'Kitchen island',
      description: 'An island with storage on both sides and a granite top.',
      dimensions: { width: 180, height: 90, depth: 90, unit: 'cm' },
      quantity: 1,
      budget: 2000000,
    });
    expect(submitted.status).toBe(201);
    expect(submitted.body.data.status).toBe('SUBMITTED');
    const id = submitted.body.data._id;

    expect((await api(customer.token).post(`/api/custom-orders/${id}/quote`, { quotedPrice: 1 })).status).toBe(403);
    await api(owner.token).post(`/api/custom-orders/${id}/estimate`, { materialCost: 900000, laborCost: 500000, productionDays: 20 });
    const quote = await api(owner.token).post(`/api/custom-orders/${id}/quote`, { quotedPrice: 2200000 });
    expect(quote.body.data).toMatchObject({ status: 'QUOTED', quotedPrice: 2200000 });

    const custView = await api(customer.token).get(`/api/custom-orders/${id}`);
    expect(custView.body.data.estimate).toBeUndefined();

    const approved = await api(customer.token).post(`/api/custom-orders/${id}/respond`, { approve: true });
    expect(approved.status).toBe(200);
    expect(approved.body.data.order.orderType).toBe('CUSTOM');
    expect(approved.body.data.order.items[0].unitCost).toBeUndefined();
    const order = await models.Order.findById(approved.body.data.order._id);
    expect(order).toMatchObject({ subtotal: 2200000, status: 'PENDING' });
    expect((await models.CustomFurnitureRequest.findById(id)).status).toBe('CONVERTED');
  });
});
