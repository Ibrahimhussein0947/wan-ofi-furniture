import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Award, Hammer, PencilRuler, Quote, ShieldCheck, Truck, Clock, Phone, Mail, MapPin } from 'lucide-react';
import Button from '../../components/ui/Button';
import ProductCard from '../../components/ProductCard';
import ProductImage from '../../components/ProductImage';
import { Skeleton } from '../../components/ui/States';
import { categoriesApi, productsApi } from '../../api/endpoints';
import { usePublicSettings } from '../../components/SettingsLoader';

function ProductGrid({ query }) {
  if (query.isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {query.data?.items?.map((p) => (
        <ProductCard key={p._id} product={p} />
      ))}
    </div>
  );
}

function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass-600">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-walnut-950 sm:text-4xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

const WHY = [
  [Hammer, 'Handcrafted locally', 'Every piece is built by skilled carpenters in our Dar es Salaam workshop.'],
  [Award, 'Premium hardwoods', 'Mahogany, mninga and seasoned timber chosen for strength and beauty.'],
  [PencilRuler, 'Made to measure', 'Tell us your dimensions, colours and fabrics — we build exactly that.'],
  [ShieldCheck, 'Quality inspected', 'A 10-point quality check before anything leaves the workshop.'],
  [Truck, 'Delivery & installation', 'Our team delivers and installs across Dar es Salaam and beyond.'],
  [Clock, 'Track your order', 'Follow production from first cut to delivery in your account.'],
];

const TESTIMONIALS = [
  ['Amina H.', 'Masaki', 'Our king bed is stunning and solid. I loved seeing progress photos while it was being built.'],
  ['Kilimanjaro Hotels', 'Moshi', 'They furnished our dining hall on time and on budget. The quality has held up beautifully.'],
  ['John M.', 'Mikocheni', 'The custom sofa fits our living room perfectly. Clear pricing and flexible payments.'],
];

export default function Home() {
  const featured = useQuery({ queryKey: ['products', 'featured'], queryFn: () => productsApi.list({ featured: 'true', limit: 4 }) });
  const popular = useQuery({ queryKey: ['products', 'popular'], queryFn: () => productsApi.list({ sort: 'popular', limit: 4 }) });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list().then((r) => r.items) });
  const { data: company } = usePublicSettings();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-walnut-950 text-white">
        <div className="absolute inset-0 opacity-30" aria-hidden>
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brass-500 blur-3xl" />
          <div className="absolute -bottom-40 left-10 h-96 w-96 rounded-full bg-walnut-600 blur-3xl" />
        </div>
        <div className="container-page relative grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brass-300/30 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-brass-200">
              Crafted in Tanzania
            </p>
            <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Furniture made to <span className="text-brass-300">live with</span>, for a lifetime.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-walnut-100/80">
              Solid-wood beds, sofas, dining sets and office furniture — or a piece designed entirely around your space.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/products" variant="accent" size="lg" iconRight={ArrowRight}>
                Shop the collection
              </Button>
              <Button to="/custom-furniture" variant="outlineLight" size="lg">
                Request custom furniture
              </Button>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
              {[
                ['12+', 'Years crafting'],
                ['2,500+', 'Pieces delivered'],
                ['4.8★', 'Customer rating'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-display text-2xl font-semibold text-brass-200">{v}</dd>
                  <dd className="text-xs text-walnut-200/70">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              <ProductImage name="Kilimanjaro Sofa" className="aspect-[4/5] rounded-3xl" iconClassName="h-24 w-24" />
              <div className="space-y-4 pt-10">
                <ProductImage name="Zanzibar Bed" className="aspect-square rounded-3xl" iconClassName="h-20 w-20" />
                <ProductImage name="Dining Table" className="aspect-square rounded-3xl" iconClassName="h-20 w-20" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="container-page py-16">
        <SectionTitle
          eyebrow="Featured"
          title="Signature pieces"
          action={
            <Link to="/products?featured=true" className="link inline-flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <ProductGrid query={featured} />
      </section>

      {/* Categories */}
      <section className="bg-white py-16">
        <div className="container-page">
          <SectionTitle eyebrow="Browse" title="Shop by category" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.data
              ?.filter((c) => c.productCount > 0 || c.slug === 'custom-furniture')
              .slice(0, 10)
              .map((c) => (
                <Link
                  key={c._id}
                  to={c.slug === 'custom-furniture' ? '/custom-furniture' : `/products?category=${c.slug}`}
                  className="group overflow-hidden rounded-2xl border border-walnut-100 bg-[#fbf8f4] transition hover:shadow-lift"
                >
                  <ProductImage name={c.name} className="aspect-[4/3] transition group-hover:scale-105" iconClassName="h-10 w-10" />
                  <div className="p-3">
                    <p className="font-medium text-walnut-950">{c.name}</p>
                    <p className="text-xs text-stone-500">{c.slug === 'custom-furniture' ? 'Designed for you' : `${c.productCount} design${c.productCount === 1 ? '' : 's'}`}</p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* Popular */}
      <section className="container-page py-16">
        <SectionTitle eyebrow="Customer favourites" title="Popular right now" />
        <ProductGrid query={popular} />
      </section>

      {/* Custom furniture */}
      <section className="container-page pb-16">
        <div className="grid overflow-hidden rounded-3xl bg-walnut-900 text-white lg:grid-cols-2">
          <div className="p-8 sm:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass-300">Custom furniture</p>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Can't find it? We'll build it.</h2>
            <p className="mt-4 text-walnut-100/80">Share your measurements, photos and ideas. Our designers send a detailed quote, and you follow every stage of production online.</p>
            <ol className="mt-6 space-y-3 text-sm">
              {['Send your request with measurements & photos', 'Receive a price proposal within 48 hours', 'Approve and pay a deposit — production begins', 'Quality check, delivery and installation'].map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brass-500 text-xs font-bold text-walnut-950">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <Button to="/custom-furniture" variant="accent" size="lg" className="mt-8" iconRight={ArrowRight}>
              Start your design
            </Button>
          </div>
          <ProductImage name="Custom Wardrobe" className="min-h-[260px]" iconClassName="h-28 w-28" />
        </div>
      </section>

      {/* Why us */}
      <section className="bg-white py-16">
        <div className="container-page">
          <SectionTitle eyebrow="Why Wan Ofi" title="Why customers choose us" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map(([Icon, title, text]) => (
              <div key={title} className="rounded-2xl border border-walnut-100 p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brass-50 text-brass-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-walnut-950">{title}</h3>
                <p className="mt-1.5 text-sm text-stone-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container-page py-16">
        <SectionTitle eyebrow="Testimonials" title="What our customers say" />
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map(([name, place, text]) => (
            <figure key={name} className="rounded-2xl bg-white p-6 shadow-card">
              <Quote className="h-7 w-7 text-brass-400" />
              <blockquote className="mt-3 text-stone-700">{text}</blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-walnut-900">
                {name} <span className="font-normal text-stone-500">· {place}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="bg-walnut-50 py-16">
        <div className="container-page grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold text-walnut-950">Visit our showroom</h2>
            <p className="mt-3 text-stone-600">See the craftsmanship up close, feel the fabrics and talk to our designers.</p>
            <ul className="mt-6 space-y-3 text-stone-700">
              <li className="flex gap-3">
                <MapPin className="h-5 w-5 text-brass-600" /> {company?.companyAddress || 'Dar es Salaam, Tanzania'}
              </li>
              <li className="flex gap-3">
                <Phone className="h-5 w-5 text-brass-600" /> {company?.companyPhone || '+255 700 000 000'}
              </li>
              <li className="flex gap-3">
                <Mail className="h-5 w-5 text-brass-600" /> {company?.companyEmail || 'info@wanofi.com'}
              </li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-8 shadow-card">
            <h3 className="font-display text-xl font-semibold text-walnut-950">Have a question?</h3>
            <p className="mt-2 text-sm text-stone-600">Send us a message and we'll respond within one business day.</p>
            <Button to="/contact" className="mt-5" iconRight={ArrowRight}>
              Contact us
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
