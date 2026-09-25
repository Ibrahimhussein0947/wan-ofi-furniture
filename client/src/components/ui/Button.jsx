import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-walnut-800 text-white hover:bg-walnut-900 shadow-sm',
  accent: 'bg-brass-500 text-walnut-950 hover:bg-brass-400 shadow-sm',
  secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 shadow-sm',
  ghost: 'text-stone-700 hover:bg-stone-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  success: 'bg-sage-600 text-white hover:bg-sage-700 shadow-sm',
  outlineLight: 'border border-white/40 text-white hover:bg-white/10',
};

const SIZES = {
  xs: 'h-7 px-2 text-xs gap-1',
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  xl: 'h-14 px-6 text-base gap-3',
  icon: 'h-9 w-9 justify-center',
};

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, to, href, className, children, disabled, type = 'button', block, ...props },
  ref
) {
  const classes = clsx(
    'inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className
  );
  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon && <Icon className={size === 'xl' || size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden />}
      {children}
      {IconRight && <IconRight className="h-4 w-4" aria-hidden />}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
});

export default Button;
