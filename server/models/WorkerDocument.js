const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Files kept on a worker's record (ID, contract, certificates…). They hold personal data, so the
// file itself lives here in the database and is only sent to authorised staff — never public storage.
const workerDocumentSchema = new mongoose.Schema(
  {
    worker: { type: ObjectId, ref: 'Worker', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: ['ID', 'CONTRACT', 'CERTIFICATE', 'CV', 'MEDICAL', 'OTHER'], default: 'OTHER' },
    fileName: { type: String, required: true, trim: true, maxlength: 200 },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
    notes: { type: String, trim: true, maxlength: 500 },
    uploadedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WorkerDocument', workerDocumentSchema);
