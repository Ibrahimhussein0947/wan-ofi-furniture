import { useQueries } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import ProductCard from '../../components/ProductCard';
import Button from '../../components/ui/Button';
import { EmptyState, Skeleton } from '../../components/ui/States';
import { productsApi } from '../../api/endpoints';
import { useWishlist } from '../../context/WishlistContext';
import { useT } from '../../i18n/LanguageContext';
import usePageMeta from '../../hooks/usePageMeta';

export default function Wishlist({ inAccount = false }) {
  const t = useT();
  usePageMeta({ title: t('My wishlist') });
  const { items, localIds, isAccount, loading } = useWishlist();

  // Visitors' favourites are stored as ids in the browser; load each product.
  const guest = useQueries({
    queries: (isAccount ? [] : localIds).map((id) => ({ queryKey: ['product', id], queryFn: () => productsApi.get(id), retry: false })),
  });
  const products = isAccount ? items : guest.filter((q) => q.data).map((q) => q.data);
  const busy = loading || guest.some((q) => q.isLoading);

  return (
    <div className={inAccount ? '' : 'container-page py-10'}>
      <h1 className="font-display text-4xl font-semibold text-walnut-950">{t('My wishlist')}</h1>
      <p className="mt-2 text-stone-600">
        {isAccount ? t('Pieces you saved. They stay in your account on every device.') : t('Pieces you saved on this device. Log in to keep them in your account.')}
      </p>
      <div className="mt-8">
        {busy && !products.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        ) : products.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Heart}
            title={t('Your wishlist is empty')}
            message={t('Tap the heart on any piece to save it here.')}
            action={<Button to="/products">{t('Browse furniture')}</Button>}
          />
        )}
      </div>
    </div>
  );
}
