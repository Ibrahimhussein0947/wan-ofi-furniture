import { Link } from 'react-router-dom';
import { ShoppingBag, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductImage from './ProductImage';
import { StatusBadge } from './ui/Badge';
import { money } from '../utils/format';
import { useCart } from '../context/CartContext';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const discounted = product.price > product.sellingPrice;
  const canBuy = product.availability !== 'OUT_OF_STOCK';

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-walnut-100 bg-white transition hover:-translate-y-0.5 hover:shadow-lift">
      <Link to={`/products/${product.slug || product._id}`} className="relative block aspect-[4/3] overflow-hidden">
        <ProductImage src={product.images?.[0]} name={product.name} className="h-full w-full transition duration-500 group-hover:scale-105" />
        {discounted && (
          <span className="absolute left-3 top-3 rounded-full bg-brass-500 px-2.5 py-0.5 text-xs font-semibold text-walnut-950">
            Save {Math.round(((product.price - product.sellingPrice) / product.price) * 100)}%
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-brass-700">{product.category?.name}</p>
        <Link to={`/products/${product.slug || product._id}`} className="mt-1 font-display text-lg font-semibold leading-snug text-walnut-950 hover:text-walnut-700">
          {product.name}
        </Link>
        {product.rating > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
            <Star className="h-3.5 w-3.5 fill-brass-400 text-brass-400" /> {product.rating.toFixed(1)}
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
              toast.success(`${product.name} added to cart`);
            }}
            className="rounded-full bg-walnut-800 p-2.5 text-white transition hover:bg-walnut-900 disabled:opacity-40"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingBag className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
