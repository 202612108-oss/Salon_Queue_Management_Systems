import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';
import { Language } from '../../i18n/types.js';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const languages: { code: Language; label: string; native: string }[] = [
    { code: 'en', label: 'EN', native: 'English' },
    { code: 'gu', label: 'ગુ', native: 'ગુજરાતી' },
    { code: 'hi', label: 'हि', native: 'हिन्दी' },
  ];

  return (
    <div className="inline-flex items-center rounded-xl bg-charcoal-dark border border-charcoal-border p-1 text-xs">
      {languages.map((lang) => {
        const isActive = language === lang.code;
        return (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            title={lang.native}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              isActive
                ? 'bg-gold text-charcoal-dark font-bold shadow-sm'
                : 'text-silver hover:text-silver-highlight'
            }`}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
};
