import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useT } from '../../i18n/LanguageContext';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_MB = 5;

/**
 * Image selector with previews and client-side type/size checks (the server
 * re-validates everything). `capture` opens the camera directly on phones.
 */
export default function ImagePicker({ files, onChange, max = 6, label = 'Add photos', capture = false, large = false, className }) {
  const t = useT();
  const inputRef = useRef(null);
  const [previews, setPreviews] = useState([]);
  const list = useMemo(() => files || [], [files]);

  useEffect(() => {
    const urls = list.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [list]);

  const add = (selected) => {
    const accepted = [];
    for (const f of selected) {
      if (!ALLOWED.includes(f.type)) toast.error(`${f.name}: only JPG, PNG, WEBP or GIF images.`);
      else if (f.size > MAX_MB * 1024 * 1024) toast.error(`${f.name} is larger than ${MAX_MB} MB.`);
      else accepted.push(f);
    }
    const next = [...list, ...accepted].slice(0, max);
    if (list.length + accepted.length > max) toast.error(`You can attach up to ${max} images.`);
    onChange(next);
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        {previews.map((url, i) => (
          <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-stone-200">
            <img src={url} alt={`Selected ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(list.filter((_, idx) => idx !== i))}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
              aria-label={t('Remove image')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {list.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-stone-300 text-stone-500 transition hover:border-walnut-400 hover:text-walnut-700',
              large ? 'h-28 w-full text-base' : 'h-20 w-20 text-xs'
            )}
          >
            {capture ? <Camera className={large ? 'h-7 w-7' : 'h-5 w-5'} /> : <ImagePlus className={large ? 'h-7 w-7' : 'h-5 w-5'} />}
            {label}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(',')}
        multiple={max > 1}
        capture={capture ? 'environment' : undefined}
        className="hidden"
        onChange={(e) => {
          add([...e.target.files]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
