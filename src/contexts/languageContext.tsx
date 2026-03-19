import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AppLanguage,
  LANGUAGE_STORAGE_KEY,
  translateText,
} from "@/src/i18n/translations";

type TranslateParams = Record<string, string | number>;

type LanguageContextType = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  t: (key: string, params?: TranslateParams) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLanguage === "en" || savedLanguage === "ro") {
          setLanguageState(savedLanguage);
        }
      } catch (error) {
        if (__DEV__) {
          console.log("[languageContext] Failed to load language:", error);
        }
      }
    };

    void loadLanguage();
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch (error) {
      if (__DEV__) {
        console.log("[languageContext] Failed to save language:", error);
      }
    }
  }, []);

  const toggleLanguage = useCallback(async () => {
    const nextLanguage: AppLanguage = language === "en" ? "ro" : "en";
    await setLanguage(nextLanguage);
  }, [language, setLanguage]);

  const t = useCallback(
    (key: string, params?: TranslateParams): string =>
      translateText(language, key, params),
    [language],
  );

  const contextValue = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, setLanguage, t, toggleLanguage],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
