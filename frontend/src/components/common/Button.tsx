import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl min-h-[44px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gold/50 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
  }[size];

  const variantStyles = {
    primary: 'bg-gold text-charcoal-dark hover:bg-gold-hover shadow-md shadow-gold/10',
    secondary: 'bg-charcoal-surface border border-charcoal-border text-silver-highlight hover:border-gold/40 hover:text-gold',
    outline: 'bg-transparent border border-gold/40 text-gold hover:bg-gold/10 hover:border-gold',
    danger: 'bg-status-danger/20 border border-status-danger/40 text-status-danger hover:bg-status-danger/30',
  }[variant];

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
