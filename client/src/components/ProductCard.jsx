import { Link } from 'react-router-dom';
import { ShoppingBag, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductImage from './ProductImage';
import WishlistButton from './WishlistButton';
import { StatusBadge } from './ui/Badge';
import { money } from '../utils/format';
import { useCart } from '../context/CartContext';
import { useT } from '../i18n/LanguageContext';

export default function ProductCard({ product }) {
  const t = useT();
  const { add } = useCart();
  const discounted = product.price > product.sellingPrice;
  const canBuy = product.availability !== 'OUT_OF_STOCK';

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-walnut-100 bg-white transition duration-300 hover:-translate-y-1.5 hover:border-brass-300/60 hover:shadow-lift">
      <Link to={`/products/${product.slug || product._id}`} className="relative block aspect-[4/3] overflow-hidden">
        <ProductImage src={product.images?.[0]} name={product.name} className="h-full w-full transition duration-500 group-hover:scale-110" />
        {/* Warm gradient washes in over the image on hover. */}
        <span
          className="theme-static pointer-events-none absolute inset-0 bg-gradient-to-t from-walnut-950/50 via-walnut-950/5 to-transparent opacity-0 transition duration-500 group-hover:opacity-100"
          aria-hidden
        />
        {discounted && (
          <span className="absolute left-3 top-3 rounded-full bg-gradient-to-br from-brass-300 to-brass-500 px-2.5 py-0.5 text-xs font-semibold text-walnut-950 shadow-glow-sm">
            {t('Save {pct}%', { pct: Math.round(((product.price - product.sellingPrice) / product.price) * 100) })}
          </span>
        )}
      </Link>
      <WishlistButton productId={product._id} name={product.name} className="absolute right-3 top-3 z-10" />
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-brass-700">{product.category && t(product.category.name)}</p>
        <Link to={`/products/${product.slug || product._id}`} className="mt-1 font-display text-lg font-semibold leading-snug text-walnut-950 hover:text-walnut-700">
          {product.name}
        </Link>
        {product.dimensions?.width > 0 && (
          <p className="mt-0.5 text-xs text-stone-500">
            {product.dimensions.width} × {product.dimensions.depth || product.dimensions.length || '–'} × {product.dimensions.height || '–'} {product.dimensions.unit || 'cm'}
          </p>
        )}
        {product.rating > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
            <Star className="h-3.5 w-3.5 fill-brass-400 text-brass-400" /> {product.rating.toFixed(1)}
            {product.reviewCount > 0 && <span className="text-stone-400">({product.reviewCount})</span>}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <p className="text-lg font-semibold text-walnut-900">{money(product.sellingPrice)}</p>
            {discounted && <p className="text-xs text-stone-400 line-through">{money(product.price)}</p>}
            {product.availability && <StatusBadge status={product.availability} className="mt-1" />}
          </div>
          <button
            type="button"
            disabled={!canBuy}
            onClick={() => {
              add(product, { color: product.colors?.[0] });
              toast.success(t('{name} added to cart', { name: product.name }));
            }}
            className="rounded-full bg-gradient-to-br from-walnut-800 to-walnut-950 p-2.5 text-white shadow-md transition duration-300 hover:scale-110 hover:from-brass-400 hover:to-brass-500 hover:text-walnut-950 hover:shadow-glow-sm disabled:opacity-40 disabled:hover:scale-100"
            aria-label={t('Add {name} to cart', { name: product.name })}
          >
            <ShoppingBag className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
