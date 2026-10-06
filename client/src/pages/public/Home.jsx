import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Award, Hammer, PencilRuler, Quote, ShieldCheck, Truck, Clock, Phone, Mail, MapPin } from 'lucide-react';
import Button from '../../components/ui/Button';
import ProductCard from '../../components/ProductCard';
import ProductImage from '../../components/ProductImage';
import { Skeleton } from '../../components/ui/States';
import { categoriesApi, productsApi } from '../../api/endpoints';
import { usePublicSettings } from '../../components/SettingsLoader';
import { useT } from '../../i18n/LanguageContext';
import usePageMeta from '../../hooks/usePageMeta';

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
    <div className="stagger grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
        <p className="eyebrow-gradient text-sm font-semibold uppercase tracking-[0.2em]">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-walnut-950 sm:text-4xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// Photos from Unsplash (free for commercial use under the Unsplash License).
const unsplash = (id, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const WHY = [
  [Hammer, 'Handcrafted locally', 'Every piece is built by skilled carpenters in our Addis Ababa workshop.', unsplash('photo-1659930087003-2d64e33181f7')],
  [Award, 'Premium hardwoods', 'Eucalyptus, acacia and seasoned timber chosen for strength and beauty.', unsplash('photo-1677338003679-b422eb979c5d')],
  [PencilRuler, 'Made to measure', 'Tell us your dimensions, colours and fabrics — we build exactly that.', unsplash('photo-1626081063434-79a2169791b1')],
  [ShieldCheck, 'Quality inspected', 'A 10-point quality check before anything leaves the workshop.', unsplash('photo-1590529989936-f6efdf774c23')],
  [Truck, 'Delivery & installation', 'Our team delivers and installs across Addis Ababa and beyond.', unsplash('photo-1657049199023-87fb439d47c5')],
  [Clock, 'Track your order', 'Follow production from first cut to delivery in your account.', unsplash('photo-1597960194599-22929afc25b1')],
];

const TESTIMONIALS = [
  ['Amina H.', 'Bole', 'Our king bed is stunning and solid. I loved seeing progress photos while it was being built.'],
  ['Ibrahim Hussein', '', 'They furnished our dining hall on time and on budget. The quality has held up beautifully.'],
  ['Abdul Rahman', '', 'The custom sofa fits our living room perfectly. Clear pricing and flexible payments.'],
];

export default function Home() {
  const t = useT();
  usePageMeta({ description: t('Solid-wood beds, sofas, dining sets and office furniture — or a piece designed entirely around your space.') });
  const featured = useQuery({ queryKey: ['products', 'featured'], queryFn: () => productsApi.list({ featured: 'true', limit: 4 }) });
  const popular = useQuery({ queryKey: ['products', 'popular'], queryFn: () => productsApi.list({ sort: 'popular', limit: 4 }) });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list().then((r) => r.items) });
  const { data: company } = usePublicSettings();

  return (
    <>
      {/* Hero */}
      <section className="theme-static aurora relative overflow-hidden bg-gradient-to-br from-walnut-950 via-walnut-900 to-walnut-950 text-white">
        <div className="absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute -right-32 -top-32 h-96 w-96 animate-float rounded-full bg-brass-500 blur-3xl" />
          <div className="absolute -bottom-40 left-10 h-96 w-96 animate-float-slow rounded-full bg-walnut-600 blur-3xl" />
          <div className="absolute left-1/3 top-1/4 h-72 w-72 animate-float-slow rounded-full bg-brass-600/30 blur-3xl" />
        </div>
        <div className="container-page relative grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="mb-4 inline-flex animate-pulse-soft items-center gap-2 rounded-full border border-brass-300/40 bg-gradient-to-r from-brass-400/20 via-white/5 to-transparent px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-brass-200">
              {t('Crafted in Ethiopia')}
            </p>
            <h1 className="animate-fade-in-up font-display text-4xl font-semibold leading-tight [animation-delay:80ms] sm:text-5xl lg:text-6xl">
              {t('Furniture made to ')}<span className="gradient-text">{t('live with')}</span>{t(', for a lifetime.')}
            </h1>
            <p className="mt-5 max-w-xl animate-fade-in-up text-lg text-walnut-100/80 [animation-delay:160ms]">
              {t('Solid-wood beds, sofas, dining sets and office furniture — or a piece designed entirely around your space.')}
            </p>
            <div className="mt-8 flex animate-fade-in-up flex-wrap gap-3 [animation-delay:240ms]">
              <Button to="/products" variant="accent" size="lg" iconRight={ArrowRight}>
                {t('Shop the collection')}
              </Button>
              <Button to="/custom-furniture" variant="outlineLight" size="lg">
                {t('Request custom furniture')}
              </Button>
            </div>
            <dl className="mt-10 grid max-w-md animate-fade-in-up grid-cols-3 gap-6 border-t border-white/10 pt-6 [animation-delay:320ms]">
              {[
                ['12+', 'Years crafting'],
                ['2,500+', 'Pieces delivered'],
                ['4.8★', 'Customer rating'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{t(l)}</dt>
                  <dd className="font-display text-2xl font-semibold text-brass-200">{v}</dd>
                  <dd className="text-xs text-walnut-200/70">{t(l)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              <ProductImage src={unsplash('photo-1687180498602-5a1046defaa4', 900)} name="Simien Sofa" className="aspect-[4/5] w-full animate-float rounded-3xl shadow-lift" iconClassName="h-24 w-24" />
              <div className="animate-float-slow space-y-4 pt-10">
                <ProductImage src={unsplash('photo-1505693416388-ac5ce068fe85')} name="Lalibela Bed" className="aspect-square w-full rounded-3xl shadow-lift" iconClassName="h-20 w-20" />
                <ProductImage src={unsplash('photo-1730104231026-46e3cf7c3141')} name="Dining Table" className="aspect-square w-full rounded-3xl shadow-lift" iconClassName="h-20 w-20" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="container-page py-16">
        <SectionTitle
          eyebrow={t('Featured')}
          title={t('Signature pieces')}
          action={
            <Link to="/products?featured=true" className="link inline-flex items-center gap-1">
              {t('View all')} <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <ProductGrid query={featured} />
      </section>

      {/* Categories */}
      <section className="bg-white py-16">
        <div className="container-page">
          <SectionTitle eyebrow={t('Browse')} title={t('Shop by category')} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.data
              ?.filter((c) => c.productCount > 0 || c.slug === 'custom-furniture')
              .slice(0, 10)
              .map((c) => (
                <Link
                  key={c._id}
                  to={c.slug === 'custom-furniture' ? '/custom-furniture' : `/products?category=${c.slug}`}
                  className="group overflow-hidden rounded-2xl border border-walnut-100 bg-canvas transition duration-300 hover:-translate-y-1 hover:border-brass-300/70 hover:shadow-lift"
                >
                  <ProductImage src={c.image} name={c.name} className="aspect-[4/3] w-full transition group-hover:scale-105" iconClassName="h-10 w-10" />
                  <div className="p-3">
                    <p className="font-medium text-walnut-950">{t(c.name)}</p>
                    <p className="text-xs text-stone-500">{c.slug === 'custom-furniture' ? t('Designed for you') : c.productCount === 1 ? t('1 design') : t('{count} designs', { count: c.productCount })}</p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* Popular */}
      <section className="container-page py-16">
        <SectionTitle eyebrow={t('Customer favourites')} title={t('Popular right now')} />
        <ProductGrid query={popular} />
      </section>

      {/* Custom furniture */}
      <section className="container-page pb-16">
        <div className="theme-static aurora relative grid overflow-hidden rounded-3xl bg-gradient-to-br from-walnut-900 via-walnut-950 to-walnut-900 text-white shadow-lift lg:grid-cols-2">
          <div className="p-8 sm:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass-300">{t('Custom furniture')}</p>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{t("Can't find it? We'll build it.")}</h2>
            <p className="mt-4 text-walnut-100/80">{t('Share your measurements, photos and ideas. Our designers send a detailed quote, and you follow every stage of production online.')}</p>
            <ol className="mt-6 space-y-3 text-sm">
              {['Send your request with measurements & photos', 'Receive a price proposal within 48 hours', 'Approve and pay a deposit — production begins', 'Quality check, delivery and installation'].map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brass-300 to-brass-500 text-xs font-bold text-walnut-950 shadow-glow-sm">{i + 1}</span>
                  {t(s)}
                </li>
              ))}
            </ol>
            <Button to="/custom-furniture" variant="accent" size="lg" className="sheen relative mt-8 overflow-hidden" iconRight={ArrowRight}>
              {t('Start your design')}
            </Button>
          </div>
          <ProductImage src={unsplash('photo-1649361811423-a55616f7ab11', 1200)} name="Custom Wardrobe" className="h-full min-h-[260px] w-full" iconClassName="h-28 w-28" />
        </div>
      </section>

      {/* Why us */}
      <section className="bg-white py-16">
        <div className="container-page">
          <SectionTitle eyebrow={t('Why Wan Ofi')} title={t('Why customers choose us')} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map(([Icon, title, text, image]) => (
              <div key={title} className="group overflow-hidden rounded-2xl border border-walnut-100 bg-white transition duration-300 hover:-translate-y-1 hover:border-brass-200 hover:shadow-lift">
                <div className="aspect-[16/9] overflow-hidden">
                  <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <div className="relative p-6 pt-8">
                  <div className="absolute -top-6 left-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brass-100 to-brass-50 text-brass-700 shadow-sm ring-1 ring-brass-200/60">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-walnut-950">{t(title)}</h3>
                  <p className="mt-1.5 text-sm text-stone-600">{t(text)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container-page py-16">
        <SectionTitle eyebrow={t('Testimonials')} title={t('What our customers say')} />
        <div className="stagger grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map(([name, place, text]) => (
            <figure key={name} className="card-hover rounded-2xl border-walnut-100 p-6">
              <Quote className="h-7 w-7 text-brass-400" />
              <blockquote className="mt-3 text-stone-700">{t(text)}</blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-walnut-900">
                {name} {place && <span className="font-normal text-stone-500">· {place}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="bg-walnut-50 py-16">
        <div className="container-page grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold text-walnut-950">{t('Visit our showroom')}</h2>
            <p className="mt-3 text-stone-600">{t('See the craftsmanship up close, feel the fabrics and talk to our designers.')}</p>
            <ul className="mt-6 space-y-3 text-stone-700">
              <li className="flex gap-3">
                <MapPin className="h-5 w-5 text-brass-600" /> {company?.companyAddress || 'Addis Ababa, Ethiopia'}
              </li>
              <li className="flex gap-3">
                <Phone className="h-5 w-5 text-brass-600" /> {company?.companyPhone || '+251 900 000 000'}
              </li>
              <li className="flex gap-3">
                <Mail className="h-5 w-5 text-brass-600" /> {company?.companyEmail || 'info@wanofi.com'}
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-walnut-100 bg-white p-8 shadow-card transition duration-300 hover:shadow-lift">
            <h3 className="font-display text-xl font-semibold text-walnut-950">{t('Have a question?')}</h3>
            <p className="mt-2 text-sm text-stone-600">{t("Send us a message and we'll respond within one business day.")}</p>
            <Button to="/contact" className="mt-5" iconRight={ArrowRight}>
              {t('Contact us')}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
