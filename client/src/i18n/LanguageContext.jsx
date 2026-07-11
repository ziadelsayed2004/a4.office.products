import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import ar from '../locales/ar.json';
import en from '../locales/en.json';

const LanguageContext = createContext({
  locale: 'ar',
  dir: 'rtl',
  changeLanguage: () => {},
  t: () => ''
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const [locale, setLocale] = useState(() => {
    return localStorage.getItem('locale') || 'ar';
  });

  const dir = useMemo(() => (locale === 'ar' ? 'rtl' : 'ltr'), [locale]);

  useEffect(() => {
    localStorage.setItem('locale', locale);
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('dir', dir);
  }, [locale, dir]);

  const changeLanguage = (newLocale) => {
    if (newLocale === 'ar' || newLocale === 'en') {
      setLocale(newLocale);
    }
  };

  const t = (key, replacements = {}) => {
    const keys = key.split('.');
    const dictionary = locale === 'ar' ? ar : en;
    let value = dictionary;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to searching ar.json first, then key name
        let arValue = ar;
        for (const ak of keys) {
          if (arValue && typeof arValue === 'object' && ak in arValue) {
            arValue = arValue[ak];
          } else {
            arValue = null;
            break;
          }
        }
        return typeof arValue === 'string' ? arValue : key;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    let result = value;
    Object.entries(replacements).forEach(([placeholder, val]) => {
      result = result.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), val);
    });

    return result;
  };

  const contextValue = useMemo(() => ({
    locale,
    dir,
    changeLanguage,
    t
  }), [locale, dir]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
