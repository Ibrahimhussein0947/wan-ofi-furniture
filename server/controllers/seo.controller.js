const env = require('../config/env');
const { Product, Category } = require('../models');
const { PRODUCT_STATUS } = require('../config/constants');
const { asyncHandler } = require('../utils/http');

const xmlEscape = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

// Lets search engines crawl the storefront but not the account area or staff app.
exports.robots = (_req, res) => {
  res.type('text/plain').send(
    ['User-agent: *', 'Allow: /', 'Disallow: /app', 'Disallow: /account', 'Disallow: /checkout', 'Disallow: /cart', '', `Sitemap: ${env.APP_URL}/sitemap.xml`, ''].join('\n')
  );
};

// Every public page and active product, so new products are discovered without waiting for links.
exports.sitemap = asyncHandler(async (_req, res) => {
  const [products, categories] = await Promise.all([
    Product.find({ status: { $ne: PRODUCT_STATUS.DISCONTINUED } }).select('slug updatedAt').lean(),
    Category.find({ isActive: true }).select('slug updatedAt').lean(),
  ]);
  const url = (path, lastmod, priority) =>
    `  <url><loc>${xmlEscape(env.APP_URL + path)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${priority}</priority></url>`;
  const entries = [
    url('/', null, '1.0'),
    url('/products', null, '0.9'),
    url('/categories', null, '0.7'),
    url('/custom-furniture', null, '0.7'),
    url('/about', null, '0.5'),
    url('/contact', null, '0.5'),
    ...categories.filter((c) => c.slug !== 'custom-furniture').map((c) => url(`/products?category=${c.slug}`, c.updatedAt, '0.6')),
    ...products.map((p) => url(`/products/${p.slug}`, p.updatedAt, '0.8')),
  ];
  res
    .type('application/xml')
    .set('Cache-Control', 'public, max-age=3600')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`);
});
