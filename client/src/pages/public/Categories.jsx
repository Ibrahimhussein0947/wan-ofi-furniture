import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProductImage from '../../components/ProductImage';
import { QueryState } from '../../components/ui/States';
import { categoriesApi } from '../../api/endpoints';

export default function Categories() {
  const query = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list().then((r) => r.items) });
  return (
    <div className="container-page py-10">
      <h1 className="font-display text-4xl font-semibold text-walnut-950">Categories</h1>
      <p className="mt-2 text-stone-600">Everything we make, room by room.</p>
      <QueryState query={query}>
        {(categories) => (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <Link
                key={c._id}
                to={c.slug === 'custom-furniture' ? '/custom-furniture' : `/products?category=${c.slug}`}
                className="group overflow-hidden rounded-2xl border border-walnut-100 bg-white transition hover:shadow-lift"
              >
                <ProductImage src={c.image} name={c.name} className="aspect-[16/10] transition duration-500 group-hover:scale-105" iconClassName="h-16 w-16" />
                <div className="p-5">
                  <h2 className="font-display text-xl font-semibold text-walnut-950">{c.name}</h2>
                  <p className="mt-1 text-sm text-stone-600">{c.description}</p>
                  <p className="mt-3 text-sm font-medium text-walnut-700">{c.slug === 'custom-furniture' ? 'Start a custom request →' : `${c.productCount} design${c.productCount === 1 ? '' : 's'} →`}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
