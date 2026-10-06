import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-gradient-to-br from-walnut-800 to-walnut-950 text-white hover:from-walnut-700 hover:to-walnut-900 shadow-md hover:shadow-lift',
  accent:
    'bg-gradient-to-br from-brass-300 to-brass-500 text-walnut-950 hover:from-brass-200 hover:to-brass-400 shadow-glow-sm hover:shadow-glow',
  secondary:
    'border border-stone-300 bg-white text-stone-800 hover:border-brass-400 hover:bg-brass-50/60 hover:text-walnut-900 shadow-sm',
  ghost: 'text-stone-700 hover:bg-walnut-50 hover:text-walnut-900',
  danger: 'bg-gradient-to-br from-red-500 to-red-700 text-white hover:from-red-400 hover:to-red-600 shadow-md',
  success: 'bg-gradient-to-br from-sage-500 to-sage-700 text-white hover:from-sage-500 hover:to-sage-600 shadow-md',
  outlineLight: 'border border-white/40 text-white hover:border-brass-300/70 hover:bg-white/10',
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
    'inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100',
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
