const mongoose = require('mongoose');

const MAX_LIMIT = 100;

function parsePagination(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

function buildPagination(page, limit, total) {
  const pages = Math.max(Math.ceil(total / limit), 1);
  return { page, limit, total, pages, hasNext: page < pages, hasPrev: page > 1 };
}

// "-createdAt" or "name" → { createdAt: -1 }; only whitelisted fields are honoured.
function parseSort(sort, allowed = [], fallback = { createdAt: -1 }) {
  if (!sort || typeof sort !== 'string') return fallback;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  if (!allowed.includes(field)) return fallback;
  return { [field]: desc ? -1 : 1 };
}

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function searchFilter(search, fields) {
  if (!search || typeof search !== 'string' || !search.trim()) return {};
  const regex = new RegExp(escapeRegex(search.trim().slice(0, 100)), 'i');
  return { $or: fields.map((f) => ({ [f]: regex })) };
}

function dateRangeFilter(field, from, to) {
  const range = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      // A bare date ("2026-05-31") means the whole day.
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(to))) d.setUTCHours(23, 59, 59, 999);
      range.$lte = d;
    }
  }
  return Object.keys(range).length ? { [field]: range } : {};
}

const isObjectId = (v) => typeof v === 'string' && mongoose.Types.ObjectId.isValid(v) && /^[a-f\d]{24}$/i.test(v);

// Copies simple equality filters from the query string, validating ObjectIds.
function pickFilters(query, fields, idFields = []) {
  const filter = {};
  for (const f of fields) {
    const value = query[f];
    if (value === undefined || value === '' || typeof value !== 'string') continue;
    if (idFields.includes(f)) {
      if (isObjectId(value)) filter[f] = value;
    } else {
      filter[f] = value.includes(',') ? { $in: value.split(',') } : value;
    }
  }
  return filter;
}

async function paginate(Model, filter, query, { sort, populate, select, allowedSort = [], lean = true } = {}) {
  const { page, limit, skip } = parsePagination(query);
  let q = Model.find(filter)
    .sort(parseSort(query.sort, allowedSort, sort || { createdAt: -1 }))
    .skip(skip)
    .limit(limit);
  if (select) q = q.select(select);
  if (populate) q = q.populate(populate);
  if (lean) q = q.lean();
  const [items, total] = await Promise.all([q, Model.countDocuments(filter)]);
  return { items, pagination: buildPagination(page, limit, total) };
}

module.exports = {
  parsePagination,
  buildPagination,
  parseSort,
  escapeRegex,
  searchFilter,
  dateRangeFilter,
  pickFilters,
  isObjectId,
  paginate,
};
