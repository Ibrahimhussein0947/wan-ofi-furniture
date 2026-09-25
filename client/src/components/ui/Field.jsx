import { forwardRef, useId } from 'react';
import clsx from 'clsx';

export function Field({ label, error, hint, required, children, className, htmlFor }) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-red-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>
      )}
    </div>
  );
}

function useFieldId(id) {
  const generated = useId();
  return id || generated;
}

export const Input = forwardRef(function Input({ label, error, hint, required, className, containerClassName, id, ...props }, ref) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} error={error} hint={hint} required={required} className={containerClassName} htmlFor={inputId}>
      <input ref={ref} id={inputId} className={clsx('input', error && 'input-error', className)} aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, required, className, containerClassName, id, rows = 3, ...props }, ref) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} error={error} hint={hint} required={required} className={containerClassName} htmlFor={inputId}>
      <textarea ref={ref} id={inputId} rows={rows} className={clsx('input', error && 'input-error', className)} aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, required, className, containerClassName, id, options = [], placeholder, children, ...props }, ref) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} error={error} hint={hint} required={required} className={containerClassName} htmlFor={inputId}>
      <select ref={ref} id={inputId} className={clsx('input pr-8', error && 'input-error', className)} aria-invalid={Boolean(error)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const value = typeof o === 'object' ? o.value : o;
          const text = typeof o === 'object' ? o.label : o;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
        {children}
      </select>
    </Field>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, className, id, ...props }, ref) {
  const inputId = useFieldId(id);
  return (
    <label htmlFor={inputId} className={clsx('inline-flex cursor-pointer items-center gap-2 text-sm text-stone-700', className)}>
      <input ref={ref} id={inputId} type="checkbox" className="h-4 w-4 rounded border-stone-300 text-walnut-700 focus:ring-walnut-300" {...props} />
      {label}
    </label>
  );
});
