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

// Documents (worker files): PDFs, Word files and photos/scans of paper documents.
const DOCUMENT_TYPES = {
  ...IMAGE_TYPES,
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};
const DOCUMENT_SIGNATURES = {
  ...SIGNATURES,
  'application/pdf': (b) => b.slice(0, 5).toString('ascii') === '%PDF-',
  'application/msword': (b) => b.slice(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (b) => b.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
};

const documentMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 20 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!DOCUMENT_TYPES[file.mimetype]?.includes(ext)) {
      return cb(ApiError.badRequest('Only PDF, Word (DOC/DOCX) or image (JPG, PNG, WEBP, GIF) files are allowed.'));
    }
    return cb(null, true);
  },
});

/** Accepts one document in `field`, checks its content matches its type, and leaves it on `req.file` (not stored). */
const uploadDocument = (field) => [
  (req, res, next) =>
    documentMulter.single(field)(req, res, (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest(`Files must be ${env.MAX_UPLOAD_MB} MB or smaller.`));
      return next(err);
    }),
  (req, _res, next) => {
    if (!req.file) return next(ApiError.badRequest('Choose a file to upload.'));
    if (!DOCUMENT_SIGNATURES[req.file.mimetype]?.(req.file.buffer)) return next(ApiError.badRequest('File content does not match its type.'));
    return next();
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

module.exports = { uploadImages, uploadDocument, parseMultipartJson, IMAGE_TYPES, DOCUMENT_TYPES };
