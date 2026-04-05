import React, { createContext, useContext, useState, useEffect } from 'react';
import { t as translateFn, setLanguage as setLangGlobal } from '../services/language.js';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(localStorage.getItem('agri_lang') || 'en');

  useEffect(() => {
    // Keep global language sync for non-React code if any
    setLangGlobal(lang);
  }, [lang]);

  const setLang = (newLang) => {
    setLangState(newLang);
    setLangGlobal(newLang);
  };

  const t = (key) => translateFn(key, lang);

  return (
    <LanguageContext.Provider value={{ lang, currentLang: lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
