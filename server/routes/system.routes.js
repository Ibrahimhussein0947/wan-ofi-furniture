const express = require('express');
const { z } = require('zod');
const { requirePermission, requireStaff } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { uploadImages, parseMultipartJson } = require('../middleware/upload');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParam, listQuery, objectId } = require('../validators/common');
const opsV = require('../validators/operations.validator');
const financeV = require('../validators/finance.validator');
const system = require('../controllers/system.controller');

const id = validate({ params: idParam });
const list = validate({ query: listQuery });

const notifications = express.Router();
notifications.get('/', list, system.listNotifications);
notifications.get('/unread', system.unreadCounts);
notifications.post('/read-all', system.markAllRead);
notifications.post('/:id/read', id, system.markRead);

const messages = express.Router();
messages.get('/', system.conversations);
messages.get('/contacts', system.contacts);
messages.get('/:userId', validate({ params: z.object({ userId: objectId }) }), system.thread);
messages.post('/', uploadImages('attachments', { maxCount: 4, folder: 'messages' }), parseMultipartJson, validate({ body: opsV.message }), system.sendMessage);

const auditLogs = express.Router();
auditLogs.get('/', requirePermission(P.AUDIT_READ), list, system.auditLogs);

const settings = express.Router();
settings.get('/', requirePermission(P.SETTINGS_MANAGE), system.getSettings);
settings.patch('/', requirePermission(P.SETTINGS_MANAGE), validate({ body: financeV.settings }), system.updateSettings);

const search = express.Router();
search.get('/', requireStaff, system.search);

// Generic image uploads for staff (category images, avatars, etc.).
const uploads = express.Router();
const folders = ['categories', 'misc', 'avatars'];
folders.forEach((folder) => uploads.post(`/${folder}`, requireStaff, uploadImages('images', { maxCount: 6, folder }), system.upload));

const branchBody = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,12}$/, 'Use 2-12 letters, numbers or dashes'),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(30).optional(),
  isActive: z.boolean().optional(),
});
const branches = express.Router();
branches.get('/', requireStaff, system.listBranches);
branches.post('/', requirePermission(P.SETTINGS_MANAGE), validate({ body: branchBody }), system.createBranch);
branches.patch('/:id', requirePermission(P.SETTINGS_MANAGE), id, validate({ body: branchBody.partial() }), system.updateBranch);
branches.delete('/:id', requirePermission(P.SETTINGS_MANAGE), id, system.deleteBranch);

module.exports = { notifications, messages, auditLogs, settings, search, uploads, branches };
