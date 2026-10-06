import { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useT } from '../i18n/LanguageContext';
import { errorMessage } from '../api/client';

/** Heart toggle for saving a product. Hidden for staff accounts. */
export default function WishlistButton({ productId, name, className, withLabel = false }) {
  const t = useT();
  const { user } = useAuth();
  const { has, toggle } = useWishlist();
  const [busy, setBusy] = useState(false);
  if (user && user.role !== 'CUSTOMER') return null;
  const saved = has(productId);

  const onClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const nowSaved = await toggle(productId);
      toast.success(nowSaved ? t('Saved to your wishlist') : t('Removed from your wishlist'));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? t('Remove {name} from wishlist', { name }) : t('Save {name} to wishlist', { name })}
      className={clsx(
        'inline-flex items-center gap-2 transition disabled:opacity-60',
        withLabel
          ? 'rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:border-walnut-400'
          : 'rounded-full bg-white/90 p-2 text-walnut-800 shadow-sm backdrop-blur hover:scale-110',
        className
      )}
    >
      <Heart className={clsx('h-4 w-4', saved && 'fill-red-500 text-red-500')} aria-hidden />
      {withLabel && (saved ? t('Saved') : t('Save'))}
    </button>
  );
}
