import clsx from 'clsx';
import { Armchair, BedDouble, Briefcase, Lamp, Sofa, Table2, Tv, Warehouse } from 'lucide-react';
import { fileUrl } from '../api/client';

const ICONS = [
  [/bed/i, BedDouble],
  [/sofa|sectional/i, Sofa],
  [/chair/i, Armchair],
  [/table|dining/i, Table2],
  [/wardrobe|cabinet|sideboard|bookshelf/i, Warehouse],
  [/desk|office/i, Briefcase],
  [/tv/i, Tv],
];

// Soft gradients so products without photos still look intentional.
const GRADIENTS = [
  'from-brass-100 via-brass-50 to-walnut-200',
  'from-walnut-100 via-walnut-50 to-stone-200',
  'from-brass-50 via-brass-100 to-walnut-300',
  'from-sage-100 via-stone-100 to-walnut-100',
  'from-stone-100 via-brass-50 to-brass-200',
  'from-walnut-200 via-brass-100 to-stone-100',
];

export default function ProductImage({ src, name = '', className, iconClassName = 'h-12 w-12' }) {
  if (src) return <img src={fileUrl(src)} alt={name} loading="lazy" className={clsx('object-cover', className)} />;
  const Icon = ICONS.find(([rx]) => rx.test(name))?.[1] || Lamp;
  const gradient = GRADIENTS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % GRADIENTS.length];
  return (
    <div className={clsx('flex items-center justify-center bg-gradient-to-br', gradient, className)} role="img" aria-label={name}>
      <Icon className={clsx('text-walnut-600/60 drop-shadow-sm transition duration-500 group-hover:scale-110', iconClassName)} strokeWidth={1.25} />
    </div>
  );
}
