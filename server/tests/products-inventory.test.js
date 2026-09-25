const { api, createUser, createCatalog, models } = require('./helpers');

describe('products', () => {
  let owner;
  let category;

  beforeAll(async () => {
    owner = await createUser('OWNER');
    category = await models.Category.create({ name: 'Beds', slug: 'beds' });
  });

  const productBody = (over = {}) => ({
    name: 'Serengeti Bed',
    sku: 'BED-001',
    category: String(category._id),
    price: 1500000,
    costPrice: 800000,
    sellingPrice: 1400000,
    quantity: 3,
    minStock: 1,
    colors: ['Walnut'],
    ...over,
  });

  test('owner creates a product; opening stock is recorded as an inventory transaction', async () => {
    const res = await api(owner.token).post('/api/products', productBody());
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('serengeti-bed');
    const tx = await models.InventoryTransaction.findOne({ product: res.body.data._id });
    expect(tx).toMatchObject({ type: 'STOCK_IN', quantity: 3, balanceAfter: 3 });
  });

  test('SKU must be unique and selling below cost needs explicit confirmation', async () => {
    expect((await api(owner.token).post('/api/products', productBody())).status).toBe(409);
    const loss = await api(owner.token).post('/api/products', productBody({ sku: 'BED-002', sellingPrice: 700000 }));
    expect(loss.status).toBe(400);
    expect(loss.body.message).toMatch(/below cost/);
  });

  test('stock cannot be edited directly through a product update', async () => {
    const created = await api(owner.token).post('/api/products', productBody({ sku: 'BED-003' }));
    await api(owner.token).patch(`/api/products/${created.body.data._id}`, { quantity: 999, name: 'Renamed Bed' });
    const product = await models.Product.findById(created.body.data._id);
    expect(product.quantity).toBe(3);
    expect(product.name).toBe('Renamed Bed');
  });

  test('public listing filters by category, price and search', async () => {
    const res = await api().get(`/api/products?category=beds&minPrice=1000000&search=serengeti`);
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1 });
    expect(res.body.data.every((p) => p.sellingPrice >= 1000000)).toBe(true);
    expect(res.body.data[0].availability).toBe('IN_STOCK');
  });

  test('workers cannot create products', async () => {
    const worker = await createUser('WORKER', { workerRole: 'CARPENTER' });
    expect((await api(worker.token).post('/api/products', productBody({ sku: 'BED-009' }))).status).toBe(403);
  });
});

describe('inventory', () => {
  let owner;
  beforeAll(async () => {
    owner = await createUser('OWNER');
  });

  test('every manual stock change is ledgered and stock-out cannot go negative', async () => {
    const { wood } = await createCatalog();
    const out = await api(owner.token).post('/api/inventory/adjust', { itemType: 'MATERIAL', itemId: String(wood._id), type: 'STOCK_OUT', quantity: 30, note: 'Used for repairs' });
    expect(out.status).toBe(200);
    expect(out.body.data.quantity).toBe(70);

    const tooMuch = await api(owner.token).post('/api/inventory/adjust', { itemType: 'MATERIAL', itemId: String(wood._id), type: 'STOCK_OUT', quantity: 500, note: 'Too much' });
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.message).toMatch(/Insufficient inventory/);

    const txs = await models.InventoryTransaction.find({ material: wood._id });
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ quantity: -30, balanceAfter: 70 });
    expect((await models.Material.findById(wood._id)).quantity).toBe(70);
  });

  test('a reason is required for stock changes', async () => {
    const { wood } = await createCatalog();
    const res = await api(owner.token).post('/api/inventory/adjust', { itemType: 'MATERIAL', itemId: String(wood._id), type: 'STOCK_IN', quantity: 5, note: '' });
    expect(res.status).toBe(400);
  });

  test('crossing the minimum stock level raises a low-stock alert', async () => {
    const { glue } = await createCatalog();
    await api(owner.token).post('/api/inventory/adjust', { itemType: 'MATERIAL', itemId: String(glue._id), type: 'STOCK_OUT', quantity: 8, note: 'Workshop use' });
    const alert = await models.Notification.findOne({ recipient: owner.user._id, type: 'LOW_STOCK' });
    expect(alert.title).toMatch(/Glue/);
    const low = await api(owner.token).get('/api/materials?lowStock=true');
    expect(low.body.data.some((m) => String(m._id) === String(glue._id) && m.isLowStock)).toBe(true);
  });

  test('receiving a purchase order adds stock and increases what we owe the supplier', async () => {
    const { wood } = await createCatalog();
    const supplier = await models.Supplier.create({ name: 'Timber Co' });
    const po = await api(owner.token).post('/api/purchases', { supplier: String(supplier._id), items: [{ material: String(wood._id), quantity: 50, unitCost: 1200 }] });
    expect(po.status).toBe(201);
    expect(po.body.data.total).toBe(60000);

    const partial = await api(owner.token).post(`/api/purchases/${po.body.data._id}/receive`, { items: [{ itemId: po.body.data.items[0]._id, quantity: 20 }] });
    expect(partial.body.data.status).toBe('PARTIALLY_RECEIVED');
    expect((await models.Material.findById(wood._id)).quantity).toBe(120);
    expect((await models.Supplier.findById(supplier._id)).balance).toBe(24000);

    const rest = await api(owner.token).post(`/api/purchases/${po.body.data._id}/receive`, {});
    expect(rest.body.data.status).toBe('RECEIVED');
    expect((await models.Supplier.findById(supplier._id)).balance).toBe(60000);

    const over = await api(owner.token).post('/api/payments/supplier', { supplier: String(supplier._id), amount: 70000, method: 'CASH' });
    expect(over.status).toBe(400);
    const pay = await api(owner.token).post('/api/payments/supplier', { supplier: String(supplier._id), purchaseOrder: po.body.data._id, amount: 60000, method: 'BANK_TRANSFER' });
    expect(pay.status).toBe(201);
    expect((await models.Supplier.findById(supplier._id)).balance).toBe(0);
    expect(await models.FinancialTransaction.countDocuments({ type: 'SUPPLIER_PAYMENT', supplier: supplier._id })).toBe(1);
  });

  test('BOM calculation reports shortages', async () => {
    const { product } = await createCatalog();
    const res = await api(owner.token).get(`/api/bom/${product._id}/calculate?quantity=10`);
    expect(res.status).toBe(200);
    const wood = res.body.data.lines.find((l) => l.name === 'Wood');
    expect(wood).toMatchObject({ required: 200, available: 100, shortage: 100 });
    expect(res.body.data.canProduce).toBe(false);
  });
});
