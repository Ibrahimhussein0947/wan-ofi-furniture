const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

// Unguessable file names: uploads are served publicly but cannot be enumerated.
const randomName = (ext) => `${Date.now().toString(36)}-${crypto.randomBytes(16).toString('hex')}${ext}`;

const localDriver = {
  async save(buffer, { folder, ext }) {
    const dir = path.join(UPLOAD_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });
    const name = randomName(ext);
    await fs.writeFile(path.join(dir, name), buffer);
    return `/uploads/${folder}/${name}`;
  },
  async remove(url) {
    if (!url || !url.startsWith('/uploads/')) return;
    const target = path.normalize(path.join(UPLOAD_ROOT, url.replace('/uploads/', '')));
    if (!target.startsWith(UPLOAD_ROOT)) return;
    await fs.unlink(target).catch(() => {});
  },
};

let s3Client;
function getS3() {
  if (!s3Client) {
    // Loaded lazily so local development never needs AWS configuration.
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: env.S3_REGION || 'auto',
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    });
  }
  return s3Client;
}

const s3Driver = {
  async save(buffer, { folder, ext, mimetype }) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const key = `${folder}/${randomName(ext)}`;
    await getS3().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: buffer, ContentType: mimetype }));
    return `${(env.S3_PUBLIC_URL || '').replace(/\/$/, '')}/${key}`;
  },
  async remove(url) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const base = (env.S3_PUBLIC_URL || '').replace(/\/$/, '');
    if (!url || !url.startsWith(base)) return;
    await getS3()
      .send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: url.slice(base.length + 1) }))
      .catch(() => {});
  },
};

const driver = env.STORAGE_DRIVER === 's3' ? s3Driver : localDriver;

module.exports = {
  UPLOAD_ROOT,
  saveFile: (buffer, meta) => driver.save(buffer, meta),
  removeFile: (url) => driver.remove(url),
};
