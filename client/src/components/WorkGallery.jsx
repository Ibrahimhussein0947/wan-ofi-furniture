import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useT } from "../i18n/LanguageContext";

/** Photo grid of finished work; a photo opens full size with previous/next and keyboard support. */
export default function WorkGallery({ photos, initial = 8 }) {
  const t = useT();
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? photos : photos.slice(0, initial);

  const step = useCallback(
    (dir) =>
      setOpen((i) =>
        i === null ? i : (i + dir + photos.length) % photos.length,
      ),
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, step]);

  return (
    <>
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
        {shown.map((p, i) => (
          <button
            key={p.src}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative block w-full break-inside-avoid overflow-hidden rounded-2xl border border-walnut-100 bg-canvas text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift"
            aria-label={t("View photo: {caption}", { caption: t(p.caption) })}
          >
            <img
              src={p.src}
              alt={t(p.caption)}
              loading="lazy"
              decoding="async"
              className="w-full transition duration-500 group-hover:scale-[1.03]"
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 pt-10 text-sm font-medium text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              {t(p.caption)}
            </span>
          </button>
        ))}
      </div>
      {photos.length > initial && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="link text-sm font-medium"
          >
            {showAll
              ? t("Show fewer")
              : t("Show all {count} photos", { count: photos.length })}
          </button>
        </div>
      )}
      {open !== null &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={t(photos[open].caption)}
          >
            {/* Clicking the dark backdrop closes the photo. */}
            <button
              type="button"
              tabIndex={-1}
              className="absolute inset-0 cursor-default"
              aria-hidden="true"
              onClick={() => setOpen(null)}
            />
            <figure className="relative max-h-full max-w-5xl">
              <img
                src={photos[open].src}
                alt={t(photos[open].caption)}
                className="max-h-[80vh] w-auto rounded-xl object-contain"
              />
              <figcaption className="mt-3 text-center text-sm text-white/90">
                {t(photos[open].caption)}{" "}
                <span className="text-white/50">
                  · {open + 1} / {photos.length}
                </span>
              </figcaption>
            </figure>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label={t("Close")}
            >
              <X className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => step(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-4"
              aria-label={t("Previous photo")}
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-4"
              aria-label={t("Next photo")}
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
