import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  highlight?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  highlight = false,
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-7',
  }[padding];

  const highlightBorder = highlight ? 'border-gold/60 ring-1 ring-gold/20' : 'border-charcoal-border';

  return (
    <div
      className={`bg-charcoal-surface rounded-2xl border ${highlightBorder} shadow-lg shadow-black/30 transition-all ${paddingStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
