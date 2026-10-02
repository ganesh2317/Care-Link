import { useState, useCallback } from 'react';

/**
 * Giant, accessible action button for the recipient page.
 *
 * - Min height 72px, font 28px — WCAG AAA target
 * - Real <a> for href (tel: links), real <button> for onClick
 * - 800ms debounce to prevent double-tap
 * - Visible focus state
 */
export default function BigButton({
  children,
  onClick,
  href,
  variant = 'primary',
  disabled = false,
  className = '',
}) {
  const [debounced, setDebounced] = useState(false);

  const handleClick = useCallback(
    (e) => {
      if (debounced || disabled) {
        e.preventDefault();
        return;
      }
      setDebounced(true);
      setTimeout(() => setDebounced(false), 800);
      if (onClick) onClick(e);
    },
    [debounced, disabled, onClick]
  );

  const base = [
    'w-full min-h-[72px] px-6 py-5',
    'text-[28px] font-bold leading-tight',
    'rounded-2xl',
    'flex items-center justify-center gap-3 text-center',
    'transition-all duration-200',
    'focus:outline-none focus:ring-4',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'select-none',
    className,
  ].join(' ');

  const variants = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-300 active:scale-[0.98] active:bg-blue-800 shadow-lg shadow-blue-600/25',
    call:
      'bg-green-600 text-white hover:bg-green-700 focus:ring-green-300 active:scale-[0.98] active:bg-green-800 shadow-lg shadow-green-600/25',
    secondary:
      'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400 active:scale-[0.98]',
  };

  const classes = `${base} ${variants[variant] || variants.primary}`;

  if (href) {
    return (
      <a
        href={href}
        onClick={handleClick}
        className={`${classes} no-underline`}
        aria-disabled={debounced || disabled || undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={debounced || disabled}
      className={classes}
    >
      {children}
    </button>
  );
}
