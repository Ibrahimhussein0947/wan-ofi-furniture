import { Award, Hammer, Heart, Leaf } from 'lucide-react';
import Button from '../../components/ui/Button';
import ProductImage from '../../components/ProductImage';

const VALUES = [
  [Hammer, 'Craftsmanship', 'Traditional joinery techniques combined with modern precision tools.'],
  [Leaf, 'Responsible timber', 'We source seasoned hardwoods from licensed Tanzanian suppliers.'],
  [Award, 'Built to last', 'Every piece passes a 10-point inspection before it leaves the workshop.'],
  [Heart, 'Personal service', 'From the first sketch to installation, you deal with real people.'],
];

export default function About() {
  return (
    <>
      <section className="bg-walnut-950 py-20 text-white">
        <div className="container-page max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass-300">About us</p>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">A workshop built on wood, skill and trust.</h1>
          <p className="mt-5 text-lg text-walnut-100/80">
            Wan Ofi Furniture began as a two-person carpentry shop. Today our team of carpenters, upholsterers, painters and designers builds furniture for homes,
            offices and hotels across Tanzania.
          </p>
        </div>
      </section>
      <section className="container-page grid items-center gap-10 py-16 lg:grid-cols-2">
        <ProductImage name="Workshop Table" className="aspect-[4/3] rounded-3xl" iconClassName="h-28 w-28" />
        <div>
          <h2 className="font-display text-3xl font-semibold text-walnut-950">Our story</h2>
          <p className="mt-4 text-stone-700">
            We believe furniture should be made once and enjoyed for decades. That's why we build with solid timber, glue and screw every joint, and hand-finish every
            surface. Whether it's a single accent chair or a full hotel fit-out, the same care goes into each piece.
          </p>
          <p className="mt-3 text-stone-700">Our customers can follow their order online — from materials being issued, through assembly and finishing, to the final quality check.</p>
          <Button to="/products" className="mt-6">
            Explore our work
          </Button>
        </div>
      </section>
      <section className="bg-white py-16">
        <div className="container-page grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(([Icon, title, text]) => (
            <div key={title} className="rounded-2xl border border-walnut-100 p-6">
              <Icon className="h-8 w-8 text-brass-600" />
              <h3 className="mt-4 font-semibold text-walnut-950">{title}</h3>
              <p className="mt-1.5 text-sm text-stone-600">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
