import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Scissors } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';

export const TopBar: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation();

  const isCurrent = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-charcoal-dark/95 backdrop-blur-md border-b border-charcoal-border px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-charcoal-surface border border-gold/40 flex items-center justify-center text-gold group-hover:border-gold transition-colors">
            <Scissors className="w-5 h-5 -rotate-45" />
          </div>
          <div>
            <h1 className="text-base font-bold text-silver-highlight group-hover:text-gold transition-colors leading-tight">
              {t.common.salonName}
            </h1>
            <p className="text-[11px] text-silver tracking-wide">
              {t.common.appTitle}
            </p>
          </div>
        </Link>

        {/* Navigation links for testing all 7 screens */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
          <Link
            to="/"
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
              isCurrent('/') ? 'text-gold bg-charcoal-surface' : 'text-silver hover:text-silver-highlight'
            }`}
          >
            {t.nav.home}
          </Link>
          <Link
            to="/join"
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
              isCurrent('/join') ? 'text-gold bg-charcoal-surface' : 'text-silver hover:text-silver-highlight'
            }`}
          >
            {t.nav.join}
          </Link>
          <Link
            to="/status/demo"
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
              location.pathname.startsWith('/status') ? 'text-gold bg-charcoal-surface' : 'text-silver hover:text-silver-highlight'
            }`}
          >
            {t.nav.status}
          </Link>
          <Link
            to="/reception"
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
              isCurrent('/reception') ? 'text-gold bg-charcoal-surface' : 'text-silver hover:text-silver-highlight'
            }`}
          >
            {t.nav.reception}
          </Link>
          <Link
            to="/barber/rahul"
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
              location.pathname.startsWith('/barber') ? 'text-gold bg-charcoal-surface' : 'text-silver hover:text-silver-highlight'
            }`}
          >
            {t.nav.barber}
          </Link>
          <Link
            to="/display"
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
              isCurrent('/display') ? 'text-gold bg-charcoal-surface' : 'text-silver hover:text-silver-highlight'
            }`}
          >
            {t.nav.display}
          </Link>
          <Link
            to="/admin"
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
              isCurrent('/admin') ? 'text-gold bg-charcoal-surface' : 'text-silver hover:text-silver-highlight'
            }`}
          >
            {t.nav.admin}
          </Link>
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
};
