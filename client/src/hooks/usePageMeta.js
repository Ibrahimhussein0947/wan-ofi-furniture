import { useEffect } from 'react';

const SITE = 'Wan Ofi Furniture';
const DEFAULT_DESCRIPTION = 'Wan Ofi Furniture — handcrafted furniture and custom designs from our Bale Robe workshop.';

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Sets the page title, description and social-share (Open Graph) tags so each
 * storefront page is indexed and previewed with its own text and image.
 */
export default function usePageMeta({ title, description, image } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE}` : SITE;
    const desc = (description || DEFAULT_DESCRIPTION).replace(/\s+/g, ' ').trim().slice(0, 160);
    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', window.location.href);
    if (image) setMeta('property', 'og:image', new URL(image, window.location.origin).href);
  }, [title, description, image]);
}
