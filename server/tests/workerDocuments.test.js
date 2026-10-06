const { api, createUser, models, request, app, PNG } = require('./helpers');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

describe('worker documents', () => {
  let owner;
  let accountant;
  let worker;

  beforeAll(async () => {
    owner = await createUser('OWNER');
    accountant = await createUser('ACCOUNTANT');
    const carpenter = await createUser('WORKER', { workerRole: 'CARPENTER' });
    worker = await models.Worker.findOne({ user: carpenter.user._id }).lean();
  });

  const upload = (token, file, opts, fields = { title: 'National ID', category: 'ID' }) => {
    const req = request(app).post(`/api/workers/${worker._id}/documents`).set('Authorization', `Bearer ${token}`);
    Object.entries(fields).forEach(([k, v]) => req.field(k, v));
    return file ? req.attach('file', file, opts) : req;
  };

  test('the owner uploads, lists, opens and deletes a worker document', async () => {
    const res = await upload(owner.token, PDF, { filename: 'kebede id.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ title: 'National ID', category: 'ID', fileName: 'kebede id.pdf', mimetype: 'application/pdf', size: PDF.length });
    expect(res.body.data.data).toBeUndefined();
    const docId = res.body.data._id;

    const list = await api(owner.token).get(`/api/workers/${worker._id}/documents`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].uploadedBy.name).toBe(owner.user.name);
    expect(list.body.data[0].data).toBeUndefined();

    const file = await request(app).get(`/api/workers/${worker._id}/documents/${docId}/file?download=1`).set('Authorization', `Bearer ${owner.token}`).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/application\/pdf/);
    expect(file.headers['content-disposition']).toMatch(/^attachment;/);
    expect(file.headers['cache-control']).toMatch(/no-store/);
    expect(Buffer.compare(file.body, PDF)).toBe(0);

    expect((await api(owner.token).delete(`/api/workers/${worker._id}/documents/${docId}`)).status).toBe(200);
    expect(await models.WorkerDocument.countDocuments({ worker: worker._id })).toBe(0);
    expect(await models.AuditLog.countDocuments({ entityId: worker._id, description: /document "National ID"/ })).toBe(2);
  });

  test('photos of documents are accepted; disguised and unsupported files are refused', async () => {
    expect((await upload(owner.token, PNG, { filename: 'contract.png', contentType: 'image/png' }, { title: 'Contract page 1', category: 'CONTRACT' })).status).toBe(201);

    const fake = await upload(owner.token, Buffer.from('MZ not really a pdf'), { filename: 'virus.pdf', contentType: 'application/pdf' });
    expect(fake.status).toBe(400);
    expect(fake.body.message).toMatch(/does not match/);

    const exe = await upload(owner.token, Buffer.from('MZ'), { filename: 'setup.exe', contentType: 'application/octet-stream' });
    expect(exe.status).toBe(400);

    expect((await upload(owner.token, null)).status).toBe(400);
    expect((await upload(owner.token, PDF, { filename: 'a.pdf', contentType: 'application/pdf' }, { title: '' })).status).toBe(400);
  });

  test('only staff who manage workers can see or change documents', async () => {
    const res = await upload(accountant.token, PDF, { filename: 'id.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(403);
    expect((await api(accountant.token).get(`/api/workers/${worker._id}/documents`)).status).toBe(403);
    expect((await request(app).get(`/api/workers/${worker._id}/documents`)).status).toBe(401);
  });
});
