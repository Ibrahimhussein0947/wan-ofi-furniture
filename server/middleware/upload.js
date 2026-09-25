const path = require('path');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { saveFile } = require('../services/storage.service');
const { clean } = require('./sanitize');

const IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

// Magic-number check: the declared MIME type must match the actual file content.
const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': (b) => b.slice(0, 4).toString('ascii') === 'GIF8',
  'image/webp': (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP',
};

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExts = IMAGE_TYPES[file.mimetype];
  if (!allowedExts || !allowedExts.includes(ext)) {
    return cb(ApiError.badRequest('Only JPG, PNG, WEBP or GIF images are allowed.'));
  }
  return cb(null, true);
};

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 10, fields: 50 },
  fileFilter,
});

/**
 * Accepts up to `maxCount` images in `field`, verifies their content, stores them,
 * and exposes the resulting URLs on `req.uploadedFiles`.
 */
const uploadImages = (field, { maxCount = 6, folder = 'misc' } = {}) => [
  multerInstance.array(field, maxCount),
  async (req, _res, next) => {
    try {
      const files = req.files || [];
      for (const f of files) {
        if (!SIGNATURES[f.mimetype]?.(f.buffer)) throw ApiError.badRequest('File content does not match its type.');
      }
      req.uploadedFiles = await Promise.all(
        files.map((f) =>
          saveFile(f.buffer, { folder, ext: path.extname(f.originalname).toLowerCase(), mimetype: f.mimetype })
        )
      );
      next();
    } catch (err) {
      next(err);
    }
  },
];

// Multipart forms send nested data as a JSON string in a "data" field. Multer parses the
// body after the global sanitizer ran, so it is sanitized again here.
const parseMultipartJson = (req, _res, next) => {
  if (typeof req.body?.data === 'string') {
    try {
      req.body = JSON.parse(req.body.data);
    } catch {
      return next(ApiError.badRequest('Malformed form data.'));
    }
  }
  req.body = clean(req.body || {});
  return next();
};

module.exports = { uploadImages, parseMultipartJson, IMAGE_TYPES };
