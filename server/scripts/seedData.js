/* eslint-disable no-console */
/**
 * Realistic development data. Orders, payments, production and deliveries are created
 * through the real services, so ledgers, stock movements and notifications are consistent.
 * Dates are then shifted into the past so charts and reports have history.
 */
const mongoose = require('mongoose');
const models = require('../models');
const { nextNumber } = require('../models/Counter');
const { adjustStock } = require('../services/inventory.service');
const orderService = require('../services/order.service');
const paymentService = require('../services/payment.service');
const production = require('../services/production.service');
const quality = require('../services/quality.service');
const deliveryService = require('../services/delivery.service');
const expenseService = require('../services/expense.service');
const purchaseService = require('../services/purchase.service');
const customRequests = require('../services/customRequest.service');
const invoiceService = require('../services/invoice.service');
const messageService = require('../services/message.service');
const { clearSettingsCache } = require('../services/settings.service');
const { QC_CHECK_ITEMS } = require('../config/constants');

const {
  User,
  Customer,
  Worker,
  Category,
  Product,
  Material,
  Supplier,
  BillOfMaterials,
  Order,
  Payment,
  FinancialTransaction,
  Expense,
  ProductionJob,
  Setting,
  Branch,
} = models;

const DAY = 24 * 3600 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const actorOf = (user) => ({ user, ip: '127.0.0.1', userAgent: 'seed-script' });

async function resetDatabase() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  clearSettingsCache();
}

async function createUsers(password, branches) {
  const staff = [
    { name: 'Hamisi Wanofi', email: 'owner@wanofi.com', role: 'OWNER', phone: '+255 712 000 001' },
    { name: 'Grace Mushi', email: 'accountant@wanofi.com', role: 'ACCOUNTANT', phone: '+255 712 000 002' },
    { name: 'Peter Kimaro', email: 'accountant2@wanofi.com', role: 'ACCOUNTANT', phone: '+255 712 000 003' },
    { name: 'Joseph Mrema', email: 'supervisor@wanofi.com', role: 'WORKER', workerRole: 'SUPERVISOR', phone: '+255 713 000 010', wage: 800000 },
    { name: 'Ally Juma', email: 'carpenter@wanofi.com', role: 'WORKER', workerRole: 'CARPENTER', phone: '+255 713 000 011', wage: 450000 },
    { name: 'Baraka Said', email: 'carpenter2@wanofi.com', role: 'WORKER', workerRole: 'CARPENTER', phone: '+255 713 000 012', wage: 420000 },
    { name: 'Neema Lyimo', email: 'upholsterer@wanofi.com', role: 'WORKER', workerRole: 'UPHOLSTERER', phone: '+255 713 000 013', wage: 430000 },
    { name: 'Daudi Mollel', email: 'assembler@wanofi.com', role: 'WORKER', workerRole: 'ASSEMBLER', phone: '+255 713 000 014', wage: 380000 },
    { name: 'Rehema Omary', email: 'painter@wanofi.com', role: 'WORKER', workerRole: 'PAINTER', phone: '+255 713 000 015', wage: 380000 },
    { name: 'Salma Nyerere', email: 'designer@wanofi.com', role: 'WORKER', workerRole: 'DESIGNER', phone: '+255 713 000 016', wage: 600000 },
    { name: 'Musa Kweka', email: 'installer@wanofi.com', role: 'WORKER', workerRole: 'INSTALLER', phone: '+255 713 000 017', wage: 350000 },
    { name: 'Zawadi Temba', email: 'finisher@wanofi.com', role: 'WORKER', workerRole: 'FINISHER', phone: '+255 713 000 018', wage: 360000 },
  ];
  const users = {};
  for (const s of staff) {
    const user = await User.create({ name: s.name, email: s.email, phone: s.phone, password, role: s.role, workerRole: s.workerRole || null, lastLoginAt: daysAgo(1), emailVerified: true, branch: branches.hq._id });
    if (s.role === 'WORKER') {
      await Worker.create({
        user: user._id,
        employeeCode: await nextNumber('EMP', { yearly: false, pad: 4 }),
        position: s.workerRole,
        phone: s.phone,
        hireDate: daysAgo(400 + Math.floor(Math.random() * 600)),
        wageType: 'MONTHLY',
        wageRate: s.wage,
        skills: [],
      });
    }
    users[s.email.split('@')[0]] = user;
  }

  const customerData = [
    ['Amina Hassan', 'amina@example.com', '+255 754 100 201', 'Masaki', 'Dar es Salaam'],
    ['John Mwakyusa', 'john@example.com', '+255 754 100 202', 'Mikocheni', 'Dar es Salaam'],
    ['Fatma Ally', 'fatma@example.com', '+255 754 100 203', 'Njiro', 'Arusha'],
    ['Emmanuel Shayo', 'emmanuel@example.com', '+255 754 100 204', 'Kijitonyama', 'Dar es Salaam'],
    ['Halima Kombo', 'halima@example.com', '+255 754 100 205', 'Mbezi Beach', 'Dar es Salaam'],
    ['Kilimanjaro Hotels Ltd', 'procurement@kilihotels.example.com', '+255 754 100 206', 'Shanty Town', 'Moshi'],
  ];
  const customers = [];
  for (const [i, [name, email, phone, street, city]] of customerData.entries()) {
    const user = await User.create({ name, email, phone, password, role: 'CUSTOMER', emailVerified: true });
    customers.push(
      await Customer.create({
        user: user._id,
        customerCode: await nextNumber('CUS', { yearly: false, pad: 5 }),
        name,
        email,
        phone,
        address: { street, city, country: 'Tanzania' },
        company: i === 5 ? 'Kilimanjaro Hotels Ltd' : undefined,
        source: 'ONLINE',
      })
    );
  }
  for (const [name, phone] of [
    ['Said Mfinanga', '+255 767 300 401'],
    ['Mary Kessy', '+255 767 300 402'],
  ]) {
    customers.push(
      await Customer.create({
        customerCode: await nextNumber('CUS', { yearly: false, pad: 5 }),
        name,
        phone,
        address: { street: 'Sinza', city: 'Dar es Salaam', country: 'Tanzania' },
        source: 'WALK_IN',
      })
    );
  }
  return { users, customers };
}

async function createCatalog(owner) {
  const categoryNames = [
    ['Beds', 'Solid wood and upholstered beds'],
    ['Sofas', 'Comfortable sofas and sectionals'],
    ['Chairs', 'Dining, accent and lounge chairs'],
    ['Tables', 'Coffee, side and work tables'],
    ['Wardrobes', 'Built-in and free-standing wardrobes'],
    ['Cabinets', 'Storage and display cabinets'],
    ['Office Furniture', 'Desks, office chairs and conference tables'],
    ['Dining Furniture', 'Dining sets and sideboards'],
    ['TV Stands', 'Media consoles and TV units'],
    ['Custom Furniture', 'Made to your exact design'],
    ['Other', 'Everything else'],
  ];
  const categories = {};
  for (const [i, [name, description]] of categoryNames.entries()) {
    categories[name] = await Category.create({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description, sortOrder: i });
  }

  const supplierData = [
    ['Mninga Timber Supplies', 'Hassan Kibwana', '+255 22 211 0001', ['Mahogany', 'Mninga', 'Pine'], 'Net 30'],
    ['Coastal Boards & Plywood', 'Rose Mtui', '+255 22 211 0002', ['MDF', 'Plywood'], 'Net 14'],
    ['Soft Living Foam Ltd', 'Iddi Mnyampala', '+255 22 211 0003', ['Foam', 'Fabric', 'Leather'], 'Net 30'],
    ['Kariakoo Hardware Centre', 'Omari Chande', '+255 22 211 0004', ['Screws', 'Nails', 'Hinges', 'Handles', 'Glue'], 'Cash on delivery'],
    ['Rangi Bora Paints', 'Lucy Massawe', '+255 22 211 0005', ['Paint', 'Varnish'], 'Net 7'],
  ];
  const suppliers = [];
  for (const [name, contactPerson, phone, materialsSupplied, paymentTerms] of supplierData) {
    suppliers.push(await Supplier.create({ name, contactPerson, phone, email: `${name.split(' ')[0].toLowerCase()}@supplier.example.com`, address: 'Dar es Salaam', materialsSupplied, paymentTerms }));
  }

  // [name, code, category, unit, qty, min, unitCost, supplierIndex]
  const materialData = [
    ['Mahogany Timber', 'WD-MAH', 'WOOD', 'piece', 180, 40, 28000, 0],
    ['Mninga Timber', 'WD-MNG', 'WOOD', 'piece', 120, 30, 24000, 0],
    ['Pine Timber', 'WD-PIN', 'WOOD', 'piece', 60, 50, 12000, 0],
    ['MDF Board 18mm', 'BD-MDF', 'BOARD', 'sheet', 45, 15, 55000, 1],
    ['Plywood 12mm', 'BD-PLY', 'BOARD', 'sheet', 38, 12, 48000, 1],
    ['High Density Foam', 'FM-HD', 'FOAM', 'unit', 40, 10, 35000, 2],
    ['Upholstery Fabric', 'FB-UPH', 'FABRIC', 'meter', 150, 40, 18000, 2],
    ['Genuine Leather', 'LT-GEN', 'LEATHER', 'meter', 25, 10, 65000, 2],
    ['Wood Paint', 'FN-PNT', 'FINISH', 'litre', 40, 10, 22000, 4],
    ['Clear Varnish', 'FN-VRN', 'FINISH', 'litre', 30, 8, 26000, 4],
    ['Wood Glue', 'AD-GLU', 'ADHESIVE', 'litre', 25, 6, 9000, 3],
    ['Wood Screws', 'HW-SCR', 'HARDWARE', 'piece', 4000, 800, 50, 3],
    ['Nails 2"', 'HW-NAL', 'HARDWARE', 'piece', 6000, 1000, 20, 3],
    ['Cabinet Handles', 'HW-HDL', 'HARDWARE', 'piece', 150, 40, 3500, 3],
    ['Hinges', 'HW-HNG', 'HARDWARE', 'piece', 60, 60, 2500, 3],
    ['Packaging Wrap', 'PK-WRP', 'PACKAGING', 'roll', 20, 5, 30000, 3],
  ];
  const materials = {};
  for (const [name, code, category, unit, qty, minStock, unitCost, s] of materialData) {
    const material = await Material.create({ name, code, category, unit, quantity: 0, minStock, unitCost, supplier: suppliers[s]._id, purchaseDate: daysAgo(90) });
    await adjustStock({ itemType: 'MATERIAL', itemId: material._id, delta: qty, type: 'STOCK_IN', unitCost, note: 'Opening stock', userId: owner._id });
    materials[code] = material;
  }

  // [name, sku, category, price, cost, selling, qty, min, days, featured, madeToOrder, colors, materials, dims, bom]
  const productData = [
    ['Zanzibar King Bed', 'BED-ZNZ-K', 'Beds', 1950000, 1150000, 1850000, 2, 1, 14, true, true, ['Walnut', 'Natural', 'Espresso'], ['Mahogany'], [193, 120, 213], { 'WD-MAH': 14, 'BD-PLY': 2, 'HW-SCR': 120, 'AD-GLU': 1, 'FN-VRN': 2 }],
    ['Serengeti Queen Bed', 'BED-SER-Q', 'Beds', 1450000, 820000, 1350000, 3, 1, 12, false, true, ['Natural', 'Walnut'], ['Mninga'], [160, 110, 205], { 'WD-MNG': 10, 'BD-PLY': 2, 'HW-SCR': 100, 'FN-VRN': 1.5 }],
    ['Kilimanjaro 3-Seater Sofa', 'SOF-KIL-3', 'Sofas', 2400000, 1300000, 2200000, 1, 1, 16, true, true, ['Charcoal', 'Beige', 'Navy'], ['Mninga', 'Fabric', 'Foam'], [220, 90, 95], { 'WD-MNG': 20, 'FM-HD': 5, 'FB-UPH': 8, 'HW-NAL': 100, 'AD-GLU': 2 }],
    ['Masai L-Shaped Sectional', 'SOF-MAS-L', 'Sofas', 3900000, 2250000, 3600000, 0, 0, 21, true, true, ['Grey', 'Brown'], ['Mninga', 'Leather', 'Foam'], [300, 90, 180], { 'WD-MNG': 30, 'FM-HD': 8, 'LT-GEN': 12, 'HW-NAL': 180, 'AD-GLU': 3 }],
    ['Pemba Accent Chair', 'CHR-PEM', 'Chairs', 480000, 240000, 450000, 6, 2, 7, false, true, ['Mustard', 'Teal', 'Grey'], ['Mahogany', 'Fabric'], [75, 85, 80], { 'WD-MAH': 3, 'FM-HD': 1, 'FB-UPH': 2, 'HW-NAL': 40 }],
    ['Mikumi Dining Chair', 'CHR-MIK', 'Chairs', 180000, 85000, 165000, 24, 8, 5, false, true, ['Natural', 'Walnut'], ['Mninga'], [45, 95, 50], { 'WD-MNG': 1.5, 'HW-SCR': 16, 'FN-VRN': 0.2 }],
    ['Tanganyika Coffee Table', 'TBL-TAN-C', 'Tables', 420000, 190000, 380000, 5, 2, 6, true, true, ['Walnut', 'Natural'], ['Mahogany'], [120, 45, 60], { 'WD-MAH': 3, 'HW-SCR': 24, 'FN-VRN': 0.5 }],
    ['Ruaha Side Table', 'TBL-RUA-S', 'Tables', 190000, 80000, 170000, 8, 3, 4, false, true, ['Natural', 'Black'], ['Pine'], [45, 55, 45], { 'WD-PIN': 1.5, 'HW-SCR': 12, 'FN-PNT': 0.3 }],
    ['Uhuru 3-Door Wardrobe', 'WRD-UHU-3', 'Wardrobes', 1650000, 900000, 1550000, 1, 1, 14, true, true, ['White', 'Walnut', 'Grey'], ['MDF', 'Mahogany'], [150, 210, 60], { 'BD-MDF': 6, 'WD-MAH': 4, 'HW-HNG': 6, 'HW-HDL': 3, 'HW-SCR': 150, 'FN-PNT': 2 }],
    ['Mafia Storage Cabinet', 'CAB-MAF', 'Cabinets', 690000, 350000, 640000, 3, 1, 8, false, true, ['White', 'Oak'], ['MDF'], [90, 120, 45], { 'BD-MDF': 3, 'HW-HNG': 4, 'HW-HDL': 2, 'HW-SCR': 80, 'FN-PNT': 1 }],
    ['Executive Office Desk', 'OFF-EXE-D', 'Office Furniture', 1250000, 680000, 1150000, 2, 1, 10, true, true, ['Espresso', 'Walnut'], ['Mahogany', 'MDF'], [180, 76, 85], { 'WD-MAH': 5, 'BD-MDF': 2, 'HW-HDL': 3, 'HW-SCR': 90, 'FN-VRN': 1 }],
    ['Ergo Office Chair', 'OFF-ERG-C', 'Office Furniture', 380000, 210000, 350000, 10, 4, 0, false, false, ['Black'], ['Mesh', 'Steel'], [65, 120, 65], null],
    ['Arusha 6-Seater Dining Set', 'DIN-ARU-6', 'Dining Furniture', 2750000, 1500000, 2550000, 1, 1, 18, true, true, ['Natural', 'Walnut'], ['Mninga'], [180, 76, 95], { 'WD-MNG': 22, 'HW-SCR': 200, 'AD-GLU': 2, 'FN-VRN': 3 }],
    ['Tabora Sideboard', 'DIN-TAB-S', 'Dining Furniture', 980000, 520000, 920000, 2, 1, 10, false, true, ['Walnut', 'White'], ['Mahogany', 'MDF'], [160, 85, 45], { 'WD-MAH': 4, 'BD-MDF': 2, 'HW-HNG': 4, 'HW-HDL': 4, 'FN-VRN': 1 }],
    ['Dodoma TV Stand', 'TV-DOD-180', 'TV Stands', 720000, 360000, 680000, 4, 2, 7, true, true, ['Walnut', 'Black', 'White'], ['MDF', 'Mninga'], [180, 50, 45], { 'BD-MDF': 2, 'WD-MNG': 2, 'HW-HNG': 2, 'HW-HDL': 2, 'FN-PNT': 1 }],
    ['Kigoma Bookshelf', 'OTH-KIG-B', 'Other', 450000, 210000, 420000, 3, 1, 6, false, true, ['Natural', 'White'], ['Pine'], [90, 180, 35], { 'WD-PIN': 6, 'HW-SCR': 60, 'FN-PNT': 1 }],
  ];
  const products = {};
  for (const [name, sku, cat, price, costPrice, sellingPrice, qty, minStock, days, isFeatured, madeToOrder, colors, mats, dims, bom] of productData) {
    const product = await Product.create({
      name,
      sku,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''),
      category: categories[cat]._id,
      description: `${name} — handcrafted in our Dar es Salaam workshop from carefully selected ${mats.join(' and ').toLowerCase()}. Built to last with solid joinery and a hand-applied finish. Available in ${colors.join(', ')}.`,
      price,
      costPrice,
      sellingPrice,
      quantity: 0,
      minStock,
      materials: mats,
      dimensions: { width: dims[0], height: dims[1], depth: dims[2], unit: 'cm' },
      colors,
      sizes: [],
      productionTimeDays: days,
      isFeatured,
      madeToOrder,
      rating: 4 + Math.round(Math.random() * 10) / 10,
    });
    if (qty > 0) await adjustStock({ itemType: 'PRODUCT', itemId: product._id, delta: qty, type: 'STOCK_IN', unitCost: costPrice, note: 'Opening stock', userId: owner._id });
    if (bom) {
      await BillOfMaterials.create({
        product: product._id,
        items: Object.entries(bom).map(([code, quantity]) => ({ material: materials[code]._id, quantity, wastePercent: code.startsWith('WD') ? 5 : 0 })),
        laborHours: days * 6,
        updatedBy: owner._id,
      });
    }
    products[sku] = product;
  }
  return { categories, suppliers, materials, products };
}

/** Moves an order and everything booked against it back in time. */
async function backdate(order, days) {
  const base = daysAgo(days);
  const shift = Date.now() - base.getTime();
  const o = await Order.findById(order._id);
  o.orderDate = base;
  o.expectedCompletionDate = new Date(o.expectedCompletionDate.getTime() - shift);
  o.statusHistory.forEach((h) => {
    h.changedAt = new Date(h.changedAt.getTime() - shift + Math.random() * 3600 * 1000);
  });
  if (o.completedAt) o.completedAt = new Date(o.completedAt.getTime() - shift + 20 * DAY);
  await o.save();
  await Order.collection.updateOne({ _id: o._id }, { $set: { createdAt: base } });
  const payments = await Payment.find({ order: o._id });
  for (const [i, p] of payments.entries()) {
    const paidAt = new Date(base.getTime() + (i === 0 ? 0 : Math.min(days - 1, 10 + i * 5)) * DAY);
    await Payment.updateOne({ _id: p._id }, { $set: { paidAt } });
    await FinancialTransaction.updateMany({ payment: p._id }, { $set: { date: paidAt } });
  }
  await FinancialTransaction.updateMany({ order: o._id, type: { $in: ['SALE', 'DISCOUNT'] } }, { $set: { date: base } });
  const jobs = await ProductionJob.find({ order: o._id });
  for (const job of jobs) {
    job.expectedCompletionDate = o.expectedCompletionDate;
    if (job.startDate) job.startDate = new Date(base.getTime() + 2 * DAY);
    // Most jobs finish a little early; roughly one in five runs late.
    if (job.actualCompletionDate) {
      const slack = Math.random() < 0.2 ? 2 * DAY : -Math.ceil(Math.random() * 3) * DAY;
      job.actualCompletionDate = new Date(Math.min(o.expectedCompletionDate.getTime() + slack, Date.now() - DAY));
    }
    await job.save();
    await ProductionJob.collection.updateOne({ _id: job._id }, { $set: { createdAt: base } });
  }
}

/** Buys whatever a job is short of from each material's supplier (purchase order + receipt). */
async function restockFor(job, ownerActor) {
  for (const line of job.requiredMaterials) {
    const material = await Material.findById(line.material);
    const outstanding = line.quantityRequired - line.quantityIssued;
    if (material.quantity >= outstanding) continue;
    const quantity = Math.ceil(outstanding - material.quantity + material.minStock * 2);
    const po = await purchaseService.createPurchaseOrder(
      { supplier: material.supplier, items: [{ material: material._id, quantity, unitCost: material.unitCost }] },
      ownerActor
    );
    await purchaseService.receivePurchaseOrder(po._id, {}, ownerActor);
  }
}

async function advanceJobs(orderId, toStage, { owner, supervisor, workers }) {
  const ownerActor = actorOf(owner);
  const jobs = await ProductionJob.find({ order: orderId });
  const order = ['APPROVED', 'MATERIALS_READY', 'IN_PRODUCTION', 'ASSEMBLY', 'FINISHING', 'QUALITY_CHECK', 'READY_FOR_DELIVERY'];
  const target = order.indexOf(toStage);
  for (const job of jobs) {
    await production.assignWorkers(job._id, { workerIds: workers.map((w) => w._id), supervisorId: supervisor._id }, ownerActor);
    if (target >= 1) {
      const fresh = await ProductionJob.findById(job._id);
      await restockFor(fresh, ownerActor);
      if (fresh.requiredMaterials.length) await production.issueMaterials(job._id, {}, ownerActor);
      else await production.updateStage(job._id, { stage: 'MATERIALS_READY' }, ownerActor).catch(() => {});
    }
    for (const stage of ['IN_PRODUCTION', 'ASSEMBLY', 'FINISHING', 'QUALITY_CHECK']) {
      if (order.indexOf(stage) > target) break;
      await production.updateStage(job._id, { stage, note: 'Progress update' }, ownerActor);
    }
    if (target >= order.indexOf('READY_FOR_DELIVERY')) {
      const qc = await models.QualityCheck.findOne({ job: job._id, status: 'PENDING' });
      const checklist = Object.fromEntries(QC_CHECK_ITEMS.map((k) => [k, { passed: true }]));
      await quality.submitInspection(qc._id, { checklist, status: 'PASSED', notes: 'All checks passed' }, actorOf(supervisor));
    }
  }
}

async function seed({ password, log = console.log } = {}) {
  const pw = password || process.env.SEED_DEFAULT_PASSWORD || 'Password123!';
  process.env.MUTE_OUTBOUND = '1';
  log('Resetting database…');
  await resetDatabase();
  const branches = {
    hq: await Branch.create({ name: 'Mikocheni Showroom & Workshop', code: 'DSM', address: 'Mikocheni, Dar es Salaam', phone: '+255 712 000 001' }),
    arusha: await Branch.create({ name: 'Arusha Showroom', code: 'ARU', address: 'Njiro Road, Arusha', phone: '+255 712 000 050' }),
  };
  // Tanzania VAT is 18%.
  await Setting.create({ key: 'global', taxRate: 18, defaultBranch: branches.hq._id });

  log('Creating users, customers and workers…');
  const { users, customers } = await createUsers(pw, branches);
  const owner = users.owner;
  const accountant = users.accountant;
  const ownerActor = actorOf(owner);
  const accActor = actorOf(accountant);

  log('Creating catalog, materials, suppliers and BOMs…');
  const { products, suppliers, materials } = await createCatalog(owner);

  const team = {
    owner,
    supervisor: users.supervisor,
    sofa: [users.upholsterer, users.carpenter2],
    wood: [users.carpenter, users.assembler, users.painter],
  };

  log('Creating orders and running the workflow…');
  // [customerIdx, items [[sku, qty, color]], daysAgo, pay fractions, finalStage]
  const scenarios = [
    [0, [['BED-ZNZ-K', 1, 'Walnut'], ['TBL-RUA-S', 2, 'Natural']], 330, [0.5, 0.5], 'COMPLETED'],
    [1, [['SOF-KIL-3', 1, 'Charcoal']], 300, [0.4, 0.6], 'COMPLETED'],
    [5, [['CHR-MIK', 12, 'Walnut'], ['DIN-ARU-6', 2, 'Walnut']], 270, [0.5, 0.5], 'COMPLETED'],
    [2, [['WRD-UHU-3', 1, 'White']], 240, [1], 'COMPLETED'],
    [3, [['OFF-EXE-D', 1, 'Espresso'], ['OFF-ERG-C', 2, 'Black']], 210, [1], 'COMPLETED'],
    [4, [['TV-DOD-180', 1, 'Walnut'], ['TBL-TAN-C', 1, 'Walnut']], 180, [0.5, 0.5], 'COMPLETED'],
    [6, [['CHR-PEM', 2, 'Teal']], 150, [1], 'COMPLETED'],
    [0, [['CAB-MAF', 1, 'White']], 120, [0.5, 0.3], 'DELIVERED_DEBT'],
    [5, [['BED-SER-Q', 4, 'Natural'], ['OTH-KIG-B', 2, 'Natural']], 95, [0.5, 0.2], 'DELIVERED_DEBT'],
    [1, [['DIN-TAB-S', 1, 'Walnut']], 70, [0.5], 'READY'],
    [2, [['SOF-MAS-L', 1, 'Grey']], 40, [0.4], 'QUALITY_CHECK'],
    [3, [['BED-ZNZ-K', 1, 'Espresso']], 25, [0.4], 'ASSEMBLY'],
    [7, [['SOF-KIL-3', 1, 'Beige']], 18, [0.5], 'IN_PRODUCTION'],
    [4, [['WRD-UHU-3', 1, 'Walnut']], 12, [0.4], 'MATERIALS_READY'],
    [5, [['DIN-ARU-6', 1, 'Natural']], 6, [0.4], 'APPROVED'],
    [0, [['CHR-PEM', 1, 'Mustard']], 3, [], 'PENDING'],
    [3, [['TBL-TAN-C', 1, 'Natural']], 1, [], 'PENDING'],
  ];

  // A year of regular, fully paid showroom sales collected by the customer.
  const regulars = [
    ['CHR-MIK', 6, 'Natural'],
    ['TBL-TAN-C', 1, 'Walnut'],
    ['BED-SER-Q', 1, 'Natural'],
    ['SOF-KIL-3', 1, 'Navy'],
    ['TV-DOD-180', 1, 'Black'],
    ['CAB-MAF', 1, 'Oak'],
    ['OFF-EXE-D', 1, 'Walnut'],
    ['TBL-RUA-S', 2, 'Black'],
    ['DIN-TAB-S', 1, 'White'],
    ['CHR-PEM', 2, 'Grey'],
    ['OTH-KIG-B', 1, 'White'],
    ['WRD-UHU-3', 1, 'Grey'],
  ];
  for (let i = 0; i < 52; i += 1) {
    const [sku, qty, color] = regulars[i % regulars.length];
    scenarios.push([i % customers.length, [[sku, qty, color]], 358 - i * 7, [1], 'COMPLETED', true]);
  }
  // Oldest first, so order numbers follow the calendar.
  scenarios.sort((a, b) => b[2] - a[2]);

  for (const [ci, items, ago, pays, target, pickup] of scenarios) {
    const customer = customers[ci];
    const custUser = customer.user ? await User.findById(customer.user) : owner;
    const isStaffOrder = !customer.user;
    let order = await orderService.createOrder(
      {
        customer: customer._id,
        items: items.map(([sku, quantity, color]) => ({ product: products[sku]._id, quantity, color })),
        deliveryMethod: ci === 6 || pickup ? 'PICKUP' : 'DELIVERY',
        deliveryAddress: customer.address,
        discount: isStaffOrder ? 20000 : undefined,
      },
      actorOf(custUser),
      { isStaff: isStaffOrder }
    );
    // Customers in the north are served by the Arusha showroom.
    if ([2, 5].includes(ci)) await Order.updateOne({ _id: order._id }, { $set: { branch: branches.arusha._id } });
    await invoiceService.issueInvoice(order._id, {}, accActor);

    for (const fraction of pays) {
      order = await Order.findById(order._id);
      if (order.balance <= 0) break;
      const amount = fraction === pays[pays.length - 1] && pays.reduce((s, f) => s + f, 0) >= 0.999 ? order.balance : Math.round(order.total * fraction);
      await paymentService.recordCustomerPayment(
        { order: order._id, amount: Math.min(amount, order.balance), method: ['CASH', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'CARD'][Math.floor(Math.random() * 4)], reference: `REF${Math.floor(Math.random() * 1e6)}` },
        accActor
      );
      order = await Order.findById(order._id);
      // Build before collecting the final payment, like the real workflow.
      if (order.status !== 'PENDING' && ['COMPLETED', 'DELIVERED_DEBT', 'READY'].includes(target) && order.productionStatus !== 'NOT_REQUIRED' && order.status !== 'READY') {
        const workers = items.some(([sku]) => sku.startsWith('SOF') || sku.startsWith('CHR-PEM')) ? team.sofa : team.wood;
        await advanceJobs(order._id, 'READY_FOR_DELIVERY', { owner, supervisor: team.supervisor, workers });
      }
    }

    order = await Order.findById(order._id);
    if (!['COMPLETED', 'DELIVERED_DEBT', 'READY', 'PENDING'].includes(target) && order.status !== 'PENDING') {
      const workers = items.some(([sku]) => sku.startsWith('SOF')) ? team.sofa : team.wood;
      await advanceJobs(order._id, target, { owner, supervisor: team.supervisor, workers });
    }

    order = await Order.findById(order._id);
    if (['COMPLETED', 'DELIVERED_DEBT'].includes(target) && order.status === 'READY') {
      if (order.deliveryMethod === 'PICKUP') {
        await orderService.changeStatus(order._id, { status: 'DELIVERED', note: 'Collected from showroom' }, ownerActor);
      } else {
        const { Setting: S } = models;
        if (target === 'DELIVERED_DEBT') await S.updateOne({ key: 'global' }, { $set: { requireFullPaymentBeforeDelivery: false } });
        clearSettingsCache();
        const delivery = await deliveryService.scheduleDelivery({ order: order._id, scheduledDate: daysAgo(Math.max(ago - 20, 1)), deliveryPerson: users.installer._id }, ownerActor);
        await deliveryService.updateDelivery(delivery._id, { status: 'OUT_FOR_DELIVERY' }, actorOf(users.installer));
        await deliveryService.updateDelivery(delivery._id, { status: 'DELIVERED', receivedBy: customer.name }, actorOf(users.installer));
        await S.updateOne({ key: 'global' }, { $set: { requireFullPaymentBeforeDelivery: true } });
        clearSettingsCache();
      }
    }
    await backdate(order, ago);
  }

  // One cancelled order (before production).
  const cancelled = await orderService.createOrder({ customer: customers[1]._id, items: [{ product: products['TBL-RUA-S']._id, quantity: 1 }] }, actorOf(await User.findById(customers[1].user)));
  await orderService.cancelOrder(cancelled._id, { reason: 'Customer changed their mind' }, actorOf(await User.findById(customers[1].user)), { asCustomer: true });
  await backdate(cancelled, 60);

  log('Recording a production problem and a material request…');
  const activeJob = await ProductionJob.findOne({ stage: 'ASSEMBLY' });
  if (activeJob) {
    await production.reportProblem(activeJob._id, { description: 'Headboard joint slightly misaligned — needs re-cutting.', severity: 'MEDIUM' }, actorOf(team.wood[0]));
    await production.requestMaterials(activeJob._id, { material: materials['AD-GLU']._id, quantity: 1, reason: 'Extra glue for re-cut joint' }, actorOf(team.wood[0]));
    await production.addNote(activeJob._id, 'Frame assembled, waiting on headboard fix.', actorOf(team.wood[1]));
  }

  log('Creating custom furniture requests…');
  const amina = await User.findById(customers[0].user);
  const halima = await User.findById(customers[4].user);
  await customRequests.submitRequest(
    { furnitureType: 'Floating wall shelves', description: 'Three floating walnut shelves for a living room wall, hidden brackets.', dimensions: { width: 120, height: 4, depth: 25, unit: 'cm' }, preferredMaterial: 'Walnut', quantity: 3, budget: 450000 },
    customers[0]._id,
    actorOf(amina)
  );
  const quoted = await customRequests.submitRequest(
    { furnitureType: 'Kitchen island', description: 'Kitchen island with granite top and storage on both sides, including 2 drawers.', dimensions: { width: 180, height: 90, depth: 90, unit: 'cm' }, preferredMaterial: 'Mahogany', preferredColor: 'Natural', quantity: 1, budget: 2500000, requiredDate: new Date(Date.now() + 45 * DAY) },
    customers[4]._id,
    actorOf(halima)
  );
  await customRequests.startReview(quoted._id, 'Checking granite availability', actorOf(users.designer));
  await customRequests.saveEstimate(quoted._id, { materialCost: 1100000, laborCost: 600000, otherCost: 150000, productionDays: 21 }, actorOf(users.designer));
  await customRequests.sendQuote(quoted._id, { quotedPrice: 2450000, quoteNotes: 'Includes granite top, soft-close drawers and delivery within Dar es Salaam.' }, ownerActor);

  log('Recording purchases, expenses and payroll…');
  const po = await purchaseService.createPurchaseOrder(
    { supplier: suppliers[3]._id, items: [{ material: materials['HW-HNG']._id, quantity: 100, unitCost: 2400 }, { material: materials['HW-HDL']._id, quantity: 50, unitCost: 3400 }], expectedDate: daysAgo(-3) },
    ownerActor
  );
  await purchaseService.receivePurchaseOrder(po._id, {}, ownerActor);
  await paymentService.recordSupplierPayment({ supplier: suppliers[3]._id, purchaseOrder: po._id, amount: 200000, method: 'BANK_TRANSFER' }, accActor);
  const po2 = await purchaseService.createPurchaseOrder({ supplier: suppliers[2]._id, items: [{ material: materials['LT-GEN']._id, quantity: 30, unitCost: 64000 }], expectedDate: daysAgo(-7) }, ownerActor);
  await purchaseService.receivePurchaseOrder(po2._id, { items: [{ itemId: po2.items[0]._id, quantity: 10 }] }, ownerActor);

  const expenseTemplates = [
    ['RENT', 1500000, 'Workshop and showroom rent'],
    ['UTILITIES', 280000, 'Electricity (TANESCO) and water'],
    ['TRANSPORT', 160000, 'Fuel for delivery truck'],
    ['MARKETING', 120000, 'Instagram and radio adverts'],
    ['MAINTENANCE', 90000, 'Machine servicing'],
  ];
  const workers = await Worker.find().populate('user', 'name');
  for (let month = 11; month >= 0; month -= 1) {
    for (const [category, base, description] of expenseTemplates) {
      if (category === 'MAINTENANCE' && month % 3) continue;
      const amount = Math.round(base * (0.85 + Math.random() * 0.3));
      const expense = await expenseService.createExpense({ category, amount, description, method: 'BANK_TRANSFER', vendor: category === 'RENT' ? 'Mikocheni Properties' : undefined }, ownerActor);
      if (category === 'RENT') {
        const aru = await expenseService.createExpense({ category, amount: Math.round(amount * 0.4), description: 'Arusha showroom rent', method: 'BANK_TRANSFER', vendor: 'Njiro Estates', branch: String(branches.arusha._id) }, ownerActor);
        const arusaDate = new Date(new Date().getFullYear(), new Date().getMonth() - month, 3);
        if (arusaDate < new Date()) {
          await Expense.updateOne({ _id: aru._id }, { $set: { date: arusaDate } });
          await FinancialTransaction.updateMany({ expense: aru._id }, { $set: { date: arusaDate } });
        }
      }
      const date = new Date(new Date().getFullYear(), new Date().getMonth() - month, 5 + Math.floor(Math.random() * 20));
      if (date > new Date()) date.setTime(Date.now() - DAY);
      await Expense.updateOne({ _id: expense._id }, { $set: { date } });
      await FinancialTransaction.updateMany({ expense: expense._id }, { $set: { date } });
    }
    for (const worker of workers) {
      const paidAt = new Date(new Date().getFullYear(), new Date().getMonth() - month, 28);
      if (paidAt > new Date()) continue;
      const { payment } = await paymentService.recordWorkerPayment({ worker: worker._id, amount: worker.wageRate, method: 'BANK_TRANSFER', kind: 'WAGE', period: paidAt.toLocaleString('en', { month: 'long', year: 'numeric' }) }, accActor);
      await Payment.updateOne({ _id: payment._id }, { $set: { paidAt } });
      await FinancialTransaction.updateMany({ payment: payment._id }, { $set: { date: paidAt } });
    }
  }
  // A large expense waiting for owner approval.
  await expenseService.createExpense({ category: 'EQUIPMENT', amount: 4800000, description: 'New CNC router for precision cutting', vendor: 'Machinery Hub Ltd', method: 'BANK_TRANSFER' }, accActor);

  // Water damage in the store leaves leather below its minimum level (shows the low-stock alert).
  const leather = await Material.findById(materials['LT-GEN']._id);
  const writeOff = leather.quantity - Math.max(leather.minStock - 4, 0);
  if (writeOff > 0) {
    await adjustStock({ itemType: 'MATERIAL', itemId: leather._id, delta: -writeOff, type: 'DAMAGED', note: 'Water damage in store room', userId: owner._id });
  }

  log('Adding messages…');
  const john = await User.findById(customers[1].user);
  await messageService.sendMessage(john, { receiver: owner._id, body: 'Hello, can I get the sideboard in a darker walnut finish?' });
  await messageService.sendMessage(owner, { receiver: john._id, body: 'Hi John, yes — we can do espresso walnut at no extra cost. It will be ready in about a week.' });
  await messageService.sendMessage(users.carpenter, { receiver: users.supervisor._id, body: 'The mahogany delivery has some warped pieces, should I set them aside?' });
  await messageService.sendMessage(users.accountant, { receiver: owner._id, body: 'Monthly payroll has been processed. Please review the CNC router expense.' });

  delete process.env.MUTE_OUTBOUND;
  log('Seed complete.');
  return { password: pw };
}

module.exports = { seed, resetDatabase };
