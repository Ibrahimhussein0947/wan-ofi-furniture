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
const productImages = require('./productImages');
const categoryImages = require('./categoryImages');
const { clearSettingsCache } = require('../services/settings.service');
const { QC_CHECK_ITEMS } = require('../config/constants');
const reviewService = require('../services/review.service');

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
    { name: 'Wondafrash Wanofi', email: 'owner@wanofi.com', role: 'OWNER', phone: '+251 911 000 001' },
    { name: 'Hana Tesfaye', email: 'accountant@wanofi.com', role: 'ACCOUNTANT', phone: '+251 911 000 002' },
    { name: 'Yohannes Bekele', email: 'accountant2@wanofi.com', role: 'ACCOUNTANT', phone: '+251 911 000 003' },
    { name: 'Dawit Alemu', email: 'supervisor@wanofi.com', role: 'WORKER', workerRole: 'SUPERVISOR', phone: '+251 912 000 010', wage: 800000, taxRate: 10 },
    { name: 'Abebe Kebede', email: 'carpenter@wanofi.com', role: 'WORKER', workerRole: 'CARPENTER', phone: '+251 912 000 011', wage: 450000, taxRate: 10 },
    { name: 'Tesfaye Girma', email: 'carpenter2@wanofi.com', role: 'WORKER', workerRole: 'CARPENTER', phone: '+251 912 000 012', wage: 420000, taxRate: 10 },
    { name: 'Almaz Haile', email: 'upholsterer@wanofi.com', role: 'WORKER', workerRole: 'UPHOLSTERER', phone: '+251 912 000 013', wage: 430000, taxRate: 10 },
    { name: 'Solomon Desta', email: 'assembler@wanofi.com', role: 'WORKER', workerRole: 'ASSEMBLER', phone: '+251 912 000 014', wage: 380000, taxRate: 10 },
    { name: 'Mekdes Tadesse', email: 'painter@wanofi.com', role: 'WORKER', workerRole: 'PAINTER', phone: '+251 912 000 015', wage: 380000, taxRate: 10 },
    { name: 'Sara Mengistu', email: 'designer@wanofi.com', role: 'WORKER', workerRole: 'DESIGNER', phone: '+251 912 000 016', wage: 600000, taxRate: 10 },
    { name: 'Kaleb Worku', email: 'installer@wanofi.com', role: 'WORKER', workerRole: 'INSTALLER', phone: '+251 912 000 017', wage: 2000, wageType: 'HOURLY', taxRate: 5 },
    { name: 'Tigist Assefa', email: 'finisher@wanofi.com', role: 'WORKER', workerRole: 'FINISHER', phone: '+251 912 000 018', wage: 25000, wageType: 'PER_JOB', taxRate: 0 },
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
        wageType: s.wageType || 'MONTHLY',
        wageRate: s.wage,
        taxRate: s.taxRate || 0,
        skills: [],
      });
    }
    users[s.email.split('@')[0]] = user;
  }

  const customerData = [
    ['Amina Hassan', 'amina@example.com', '+251 913 100 201', 'Bole', 'Addis Ababa'],
    ['John Getachew', 'john@example.com', '+251 913 100 202', 'Megenagna', 'Addis Ababa'],
    ['Fatma Ally', 'fatma@example.com', '+251 913 100 203', 'Abay', 'Bahir Dar'],
    ['Emmanuel Wolde', 'emmanuel@example.com', '+251 913 100 204', 'Piassa', 'Addis Ababa'],
    ['Halima Yusuf', 'halima@example.com', '+251 913 100 205', 'Sarbet', 'Addis Ababa'],
    ['Simien Hotels Ltd', 'procurement@simienhotels.example.com', '+251 913 100 206', 'Kenema', 'Bahir Dar'],
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
        address: { street, city, country: 'Ethiopia' },
        company: i === 5 ? 'Simien Hotels Ltd' : undefined,
        source: 'ONLINE',
      })
    );
  }
  for (const [name, phone] of [
    ['Said Ahmed', '+251 930 300 401'],
    ['Marta Kebede', '+251 930 300 402'],
  ]) {
    customers.push(
      await Customer.create({
        customerCode: await nextNumber('CUS', { yearly: false, pad: 5 }),
        name,
        phone,
        address: { street: 'Summit', city: 'Addis Ababa', country: 'Ethiopia' },
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
    categories[name] = await Category.create({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description, image: categoryImages[name], sortOrder: i });
  }

  const supplierData = [
    ['Eucalyptus Timber Supplies', 'Getachew Assefa', '+251 11 211 0001', ['Eucalyptus', 'Acacia', 'Pine'], 'Net 30'],
    ['Horn Boards & Plywood', 'Rahel Wolde', '+251 11 211 0002', ['MDF', 'Plywood'], 'Net 14'],
    ['Soft Living Foam Ltd', 'Mulugeta Alemayehu', '+251 11 211 0003', ['Foam', 'Fabric', 'Leather'], 'Net 30'],
    ['Merkato Hardware Centre', 'Abel Tadesse', '+251 11 211 0004', ['Screws', 'Nails', 'Hinges', 'Handles', 'Glue'], 'Cash on delivery'],
    ['Tizita Paints', 'Liya Kebede', '+251 11 211 0005', ['Paint', 'Varnish'], 'Net 7'],
  ];
  const suppliers = [];
  for (const [name, contactPerson, phone, materialsSupplied, paymentTerms] of supplierData) {
    suppliers.push(await Supplier.create({ name, contactPerson, phone, email: `${name.split(' ')[0].toLowerCase()}@supplier.example.com`, address: 'Addis Ababa', materialsSupplied, paymentTerms }));
  }

  // [name, code, category, unit, qty, min, unitCost, supplierIndex]
  const materialData = [
    ['Eucalyptus Timber', 'WD-EUC', 'WOOD', 'piece', 180, 40, 28000, 0],
    ['Acacia Timber', 'WD-ACA', 'WOOD', 'piece', 120, 30, 24000, 0],
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
    ['Lalibela King Bed', 'BED-LAL-K', 'Beds', 94000, 55000, 89000, 2, 1, 14, true, true, ['Walnut', 'Natural', 'Espresso'], ['Eucalyptus'], [193, 120, 213], { 'WD-EUC': 14, 'BD-PLY': 2, 'HW-SCR': 120, 'AD-GLU': 1, 'FN-VRN': 2 }],
    ['Simien Queen Bed', 'BED-SIM-Q', 'Beds', 90000, 51000, 84000, 3, 1, 12, false, true, ['Natural', 'Walnut'], ['Acacia'], [160, 110, 205], { 'WD-ACA': 10, 'BD-PLY': 2, 'HW-SCR': 100, 'FN-VRN': 1.5 }],
    ['Ras Dashen 3-Seater Sofa', 'SOF-RDS-3', 'Sofas', 100000, 54000, 92000, 1, 1, 16, true, true, ['Charcoal', 'Beige', 'Navy'], ['Acacia', 'Fabric', 'Foam'], [220, 90, 95], { 'WD-ACA': 20, 'FM-HD': 5, 'FB-UPH': 8, 'HW-NAL': 100, 'AD-GLU': 2 }],
    ['Oromia L-Shaped Sectional', 'SOF-ORO-L', 'Sofas', 100000, 62000, 100000, 0, 0, 21, true, true, ['Grey', 'Brown'], ['Acacia', 'Leather', 'Foam'], [300, 90, 180], { 'WD-ACA': 30, 'FM-HD': 8, 'LT-GEN': 12, 'HW-NAL': 180, 'AD-GLU': 3 }],
    ['Harar Accent Chair', 'CHR-HAR', 'Chairs', 70000, 35000, 66000, 6, 2, 7, false, true, ['Mustard', 'Teal', 'Grey'], ['Eucalyptus', 'Fabric'], [75, 85, 80], { 'WD-EUC': 3, 'FM-HD': 1, 'FB-UPH': 2, 'HW-NAL': 40 }],
    ['Mekelle Dining Chair', 'CHR-MEK', 'Chairs', 55000, 26000, 50000, 24, 8, 5, false, true, ['Natural', 'Walnut'], ['Acacia'], [45, 95, 50], { 'WD-ACA': 1.5, 'HW-SCR': 16, 'FN-VRN': 0.2 }],
    ['Awash Coffee Table', 'TBL-AWA-C', 'Tables', 71000, 32000, 64000, 5, 2, 6, true, true, ['Walnut', 'Natural'], ['Eucalyptus'], [120, 45, 60], { 'WD-EUC': 3, 'HW-SCR': 24, 'FN-VRN': 0.5 }],
    ['Hawassa Side Table', 'TBL-HAW-S', 'Tables', 56000, 24000, 50000, 8, 3, 4, false, true, ['Natural', 'Black'], ['Pine'], [45, 55, 45], { 'WD-PIN': 1.5, 'HW-SCR': 12, 'FN-PNT': 0.3 }],
    ['Axum 3-Door Wardrobe', 'WRD-AXU-3', 'Wardrobes', 92000, 50000, 86000, 1, 1, 14, true, true, ['White', 'Walnut', 'Grey'], ['MDF', 'Eucalyptus'], [150, 210, 60], { 'BD-MDF': 6, 'WD-EUC': 4, 'HW-HNG': 6, 'HW-HDL': 3, 'HW-SCR': 150, 'FN-PNT': 2 }],
    ['Gondar Storage Cabinet', 'CAB-GON', 'Cabinets', 78000, 39000, 72000, 3, 1, 8, false, true, ['White', 'Oak'], ['MDF'], [90, 120, 45], { 'BD-MDF': 3, 'HW-HNG': 4, 'HW-HDL': 2, 'HW-SCR': 80, 'FN-PNT': 1 }],
    ['Executive Office Desk', 'OFF-EXE-D', 'Office Furniture', 88000, 48000, 81000, 2, 1, 10, true, true, ['Espresso', 'Walnut'], ['Eucalyptus', 'MDF'], [180, 76, 85], { 'WD-EUC': 5, 'BD-MDF': 2, 'HW-HDL': 3, 'HW-SCR': 90, 'FN-VRN': 1 }],
    ['Ergo Office Chair', 'OFF-ERG-C', 'Office Furniture', 67000, 37000, 62000, 10, 4, 0, false, false, ['Black'], ['Mesh', 'Steel'], [65, 120, 65], null],
    ['Bahir Dar 6-Seater Dining Set', 'DIN-BDR-6', 'Dining Furniture', 100000, 55000, 94000, 1, 1, 18, true, true, ['Natural', 'Walnut'], ['Acacia'], [180, 76, 95], { 'WD-ACA': 22, 'HW-SCR': 200, 'AD-GLU': 2, 'FN-VRN': 3 }],
    ['Jimma Sideboard', 'DIN-JIM-S', 'Dining Furniture', 83000, 44000, 78000, 2, 1, 10, false, true, ['Walnut', 'White'], ['Eucalyptus', 'MDF'], [160, 85, 45], { 'WD-EUC': 4, 'BD-MDF': 2, 'HW-HNG': 4, 'HW-HDL': 4, 'FN-VRN': 1 }],
    ['Adama TV Stand', 'TV-ADA-180', 'TV Stands', 77000, 39000, 73000, 4, 2, 7, true, true, ['Walnut', 'Black', 'White'], ['MDF', 'Acacia'], [180, 50, 45], { 'BD-MDF': 2, 'WD-ACA': 2, 'HW-HNG': 2, 'HW-HDL': 2, 'FN-PNT': 1 }],
    ['Konso Bookshelf', 'OTH-KON-B', 'Other', 70000, 32000, 65000, 3, 1, 6, false, true, ['Natural', 'White'], ['Pine'], [90, 180, 35], { 'WD-PIN': 6, 'HW-SCR': 60, 'FN-PNT': 1 }],
  ];
  // Solid frames and case goods carry 2 years; chairs and office seating 1 year.
  const warrantyFor = (cat) =>
    ['Chairs', 'Office Furniture'].includes(cat)
      ? { warrantyMonths: 12, warrantyTerms: 'Covers joints, frame and mechanisms under normal use.' }
      : { warrantyMonths: 24, warrantyTerms: 'Covers the frame, joinery and hardware. Fabric and finish wear are not covered.' };
  const products = {};
  for (const [name, sku, cat, price, costPrice, sellingPrice, qty, minStock, days, isFeatured, madeToOrder, colors, mats, dims, bom] of productData) {
    const product = await Product.create({
      name,
      sku,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''),
      category: categories[cat]._id,
      description: `${name} — handcrafted in our Addis Ababa workshop from carefully selected ${mats.join(' and ').toLowerCase()}. Built to last with solid joinery and a hand-applied finish. Available in ${colors.join(', ')}.`,
      price,
      costPrice,
      sellingPrice,
      quantity: 0,
      minStock,
      materials: mats,
      dimensions: { width: dims[0], height: dims[1], depth: dims[2], unit: 'cm' },
      colors,
      sizes: [],
      images: productImages[sku] || [],
      productionTimeDays: days,
      isFeatured,
      madeToOrder,
      ...warrantyFor(cat),
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

async function createPromotions(owner) {
  const { Promotion } = models;
  const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await Promotion.create([
    { code: 'WELCOME10', description: '10% off your first order (up to 10,000)', type: 'PERCENT', value: 10, maxDiscount: 10000, perCustomerLimit: 1, createdBy: owner._id },
    { code: 'HOLIDAY5000', description: '5,000 off orders of 60,000 or more', type: 'FIXED', value: 5000, minSubtotal: 60000, endsAt: in30, usageLimit: 100, perCustomerLimit: 1, createdBy: owner._id },
    { code: 'MESKEL2025', description: 'Last year’s Meskel offer (expired)', type: 'PERCENT', value: 15, endsAt: new Date('2025-10-01'), isActive: false, createdBy: owner._id },
  ]);
}

// Reviews come only from customers whose orders were delivered, so ratings are earned.
const REVIEW_TEXT = [
  [5, 'Beautiful and solid', 'Exactly as pictured and very well built. The delivery team set it up carefully.'],
  [5, 'Worth every birr', 'Excellent finish and joinery. We get compliments from every visitor.'],
  [4, 'Very happy', 'Great quality. Delivery took a few days longer than expected, but they kept us updated.'],
  [5, 'Comfortable and stylish', 'The fabric feels premium and the frame is sturdy. Highly recommended.'],
  [4, 'Good value', 'Well made and looks modern. I would order from Wan Ofi again.'],
  [3, 'Nice, small issue', 'Looks good, but one drawer needed adjusting. Their team fixed it quickly.'],
];

async function createReviews() {
  const { Order: OrderModel, Review } = models;
  const delivered = await OrderModel.find({ status: { $in: ['DELIVERED', 'COMPLETED'] } }).sort({ createdAt: 1 }).lean();
  let n = 0;
  const touched = new Set();
  for (const order of delivered) {
    for (const item of order.items) {
      if (!item.product || n % 4 === 3) {
        n += 1;
        continue; // not every customer leaves a review
      }
      const [rating, title, comment] = REVIEW_TEXT[n % REVIEW_TEXT.length];
      n += 1;
      const exists = await Review.exists({ product: item.product, customer: order.customer });
      if (exists) continue;
      const review = await Review.create({ product: item.product, customer: order.customer, order: order._id, rating, title, comment });
      const at = new Date(new Date(order.updatedAt).getTime() + 3 * 24 * 3600 * 1000);
      await Review.collection.updateOne({ _id: review._id }, { $set: { createdAt: at, updatedAt: at } });
      touched.add(String(item.product));
    }
  }
  for (const id of touched) await reviewService.refreshProductRating(new mongoose.Types.ObjectId(id));
}

// Workers on finished jobs log a few work sessions each (3–8 h), for hourly pay and labour costing.
async function logJobHours() {
  const jobs = await models.ProductionJob.find({ actualCompletionDate: { $ne: null }, 'laborLog.0': { $exists: false } }).select('assignedWorkers startDate actualCompletionDate createdAt').lean();
  let n = 0;
  const ops = jobs.map((job) => {
    const from = new Date(job.startDate || job.createdAt).getTime();
    const to = new Date(job.actualCompletionDate).getTime();
    const laborLog = job.assignedWorkers.flatMap((worker) =>
      [0, 1, 2].map((k) => {
        n += 1;
        return { worker, hours: 3 + ((n * 7) % 11) / 2, date: new Date(from + ((to - from) * (k + 1)) / 4), note: k === 0 ? 'Cutting and preparation' : k === 1 ? 'Assembly' : 'Finishing' };
      })
    );
    return { updateOne: { filter: { _id: job._id }, update: { $set: { laborLog } } } };
  });
  if (ops.length) await models.ProductionJob.bulkWrite(ops);
}

async function seed({ password, log = console.log } = {}) {
  const pw = password || process.env.SEED_DEFAULT_PASSWORD || 'Password123!';
  process.env.MUTE_OUTBOUND = '1';
  log('Resetting database…');
  await resetDatabase();
  const branches = {
    hq: await Branch.create({ name: 'Bole Showroom & Workshop', code: 'ADD', address: 'Bole, Addis Ababa', phone: '+251 911 000 001' }),
    bahirdar: await Branch.create({ name: 'Bahir Dar Showroom', code: 'BDR', address: 'Abay Road, Bahir Dar', phone: '+251 911 000 050' }),
  };
  // Ethiopia VAT is 15%.
  await Setting.create({
    key: 'global',
    taxRate: 15,
    defaultBranch: branches.hq._id,
    paymentInstructions: 'Transfer to one of the accounts below, then submit the transaction reference from your order page. Our accounts team confirms it shortly.',
    bankAccounts: [
      { type: 'BANK', bankName: 'Commercial Bank of Ethiopia', accountName: 'Wan Ofi Furniture Ltd', accountNumber: '0150-000000-00', branch: 'Bole', isActive: true },
      { type: 'BANK', bankName: 'Awash Bank', accountName: 'Wan Ofi Furniture Ltd', accountNumber: '0123-456789-00', branch: 'Mexico', isActive: true },
      { type: 'MOBILE_WALLET', bankName: 'Telebirr', accountName: 'Wan Ofi Furniture', accountNumber: '0900 000 000', notes: 'Ask for the merchant PIN at the showroom', isActive: true },
    ],
  });

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
    [0, [['BED-LAL-K', 1, 'Walnut'], ['TBL-HAW-S', 2, 'Natural']], 330, [0.5, 0.5], 'COMPLETED'],
    [1, [['SOF-RDS-3', 1, 'Charcoal']], 300, [0.4, 0.6], 'COMPLETED'],
    [5, [['CHR-MEK', 12, 'Walnut'], ['DIN-BDR-6', 2, 'Walnut']], 270, [0.5, 0.5], 'COMPLETED'],
    [2, [['WRD-AXU-3', 1, 'White']], 240, [1], 'COMPLETED'],
    [3, [['OFF-EXE-D', 1, 'Espresso'], ['OFF-ERG-C', 2, 'Black']], 210, [1], 'COMPLETED'],
    [4, [['TV-ADA-180', 1, 'Walnut'], ['TBL-AWA-C', 1, 'Walnut']], 180, [0.5, 0.5], 'COMPLETED'],
    [6, [['CHR-HAR', 2, 'Teal']], 150, [1], 'COMPLETED'],
    [0, [['CAB-GON', 1, 'White']], 120, [0.5, 0.3], 'DELIVERED_DEBT'],
    [5, [['BED-SIM-Q', 4, 'Natural'], ['OTH-KON-B', 2, 'Natural']], 95, [0.5, 0.2], 'DELIVERED_DEBT'],
    [1, [['DIN-JIM-S', 1, 'Walnut']], 70, [0.5], 'READY'],
    [2, [['SOF-ORO-L', 1, 'Grey']], 40, [0.4], 'QUALITY_CHECK'],
    [3, [['BED-LAL-K', 1, 'Espresso']], 25, [0.4], 'ASSEMBLY'],
    [7, [['SOF-RDS-3', 1, 'Beige']], 18, [0.5], 'IN_PRODUCTION'],
    [4, [['WRD-AXU-3', 1, 'Walnut']], 12, [0.4], 'MATERIALS_READY'],
    [5, [['DIN-BDR-6', 1, 'Natural']], 6, [0.4], 'APPROVED'],
    [0, [['CHR-HAR', 1, 'Mustard']], 3, [], 'PENDING'],
    [3, [['TBL-AWA-C', 1, 'Natural']], 1, [], 'PENDING'],
  ];

  // A year of regular, fully paid showroom sales collected by the customer.
  const regulars = [
    ['CHR-MEK', 6, 'Natural'],
    ['TBL-AWA-C', 1, 'Walnut'],
    ['BED-SIM-Q', 1, 'Natural'],
    ['SOF-RDS-3', 1, 'Navy'],
    ['TV-ADA-180', 1, 'Black'],
    ['CAB-GON', 1, 'Oak'],
    ['OFF-EXE-D', 1, 'Walnut'],
    ['TBL-HAW-S', 2, 'Black'],
    ['DIN-JIM-S', 1, 'White'],
    ['CHR-HAR', 2, 'Grey'],
    ['OTH-KON-B', 1, 'White'],
    ['WRD-AXU-3', 1, 'Grey'],
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
    // Customers in the north are served by the Bahir Dar showroom.
    if ([2, 5].includes(ci)) await Order.updateOne({ _id: order._id }, { $set: { branch: branches.bahirdar._id } });
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
        const workers = items.some(([sku]) => sku.startsWith('SOF') || sku.startsWith('CHR-HAR')) ? team.sofa : team.wood;
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
  const cancelled = await orderService.createOrder({ customer: customers[1]._id, items: [{ product: products['TBL-HAW-S']._id, quantity: 1 }] }, actorOf(await User.findById(customers[1].user)));
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
    { furnitureType: 'Kitchen island', description: 'Kitchen island with granite top and storage on both sides, including 2 drawers.', dimensions: { width: 180, height: 90, depth: 90, unit: 'cm' }, preferredMaterial: 'Eucalyptus', preferredColor: 'Natural', quantity: 1, budget: 2500000, requiredDate: new Date(Date.now() + 45 * DAY) },
    customers[4]._id,
    actorOf(halima)
  );
  await customRequests.startReview(quoted._id, 'Checking granite availability', actorOf(users.designer));
  await customRequests.saveEstimate(quoted._id, { materialCost: 1100000, laborCost: 600000, otherCost: 150000, productionDays: 21 }, actorOf(users.designer));
  await customRequests.sendQuote(quoted._id, { quotedPrice: 2450000, quoteNotes: 'Includes granite top, soft-close drawers and delivery within Addis Ababa.' }, ownerActor);

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
    ['UTILITIES', 280000, 'Electricity (EEU) and water'],
    ['TRANSPORT', 160000, 'Fuel for delivery truck'],
    ['MARKETING', 120000, 'Instagram and radio adverts'],
    ['MAINTENANCE', 90000, 'Machine servicing'],
  ];
  const workers = await Worker.find().populate('user', 'name');
  for (let month = 11; month >= 0; month -= 1) {
    for (const [category, base, description] of expenseTemplates) {
      if (category === 'MAINTENANCE' && month % 3) continue;
      const amount = Math.round(base * (0.85 + Math.random() * 0.3));
      const expense = await expenseService.createExpense({ category, amount, description, method: 'BANK_TRANSFER', vendor: category === 'RENT' ? 'Bole Properties' : undefined }, ownerActor);
      if (category === 'RENT') {
        const aru = await expenseService.createExpense({ category, amount: Math.round(amount * 0.4), description: 'Bahir Dar showroom rent', method: 'BANK_TRANSFER', vendor: 'Abay Estates', branch: String(branches.bahirdar._id) }, ownerActor);
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
      // Pay the net wage — the tax withheld from the gross stays with the business.
      const net = Math.round(worker.wageRate * (1 - (worker.taxRate || 0) / 100));
      const { payment } = await paymentService.recordWorkerPayment({ worker: worker._id, amount: net, method: 'BANK_TRANSFER', kind: 'WAGE', period: paidAt.toLocaleString('en', { month: 'long', year: 'numeric' }) }, accActor);
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
  await messageService.sendMessage(users.carpenter, { receiver: users.supervisor._id, body: 'The eucalyptus delivery has some warped pieces, should I set them aside?' });
  await messageService.sendMessage(users.accountant, { receiver: owner._id, body: 'Monthly payroll has been processed. Please review the CNC router expense.' });

  log('Adding promo codes…');
  await createPromotions(owner);

  log('Adding customer reviews…');
  await createReviews();
  await logJobHours();

  delete process.env.MUTE_OUTBOUND;
  log('Seed complete.');
  return { password: pw };
}

module.exports = { seed, resetDatabase, createReviews, logJobHours };
