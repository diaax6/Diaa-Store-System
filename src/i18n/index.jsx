/**
 * i18n/index.js — Language Context + Hook
 *
 * Usage:
 *   const { lang, t, dir, switchLang } = useLang();
 *   t('nav_dashboard')  →  'الرئيسية' | 'Dashboard'
 */
import { createContext, useContext, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ar from './ar';
import en from './en';

// ── Supported languages ──────────────────────────────────────────
export const SUPPORTED_LANGS = ['ar', 'en'];
export const DEFAULT_LANG    = 'ar';

// ── Translations map ─────────────────────────────────────────────
const TRANSLATIONS = { ar, en };

// ── Helpers ──────────────────────────────────────────────────────
export const getStoredLang = () => {
    try {
        const s = localStorage.getItem('ds_lang');
        return SUPPORTED_LANGS.includes(s) ? s : DEFAULT_LANG;
    } catch { return DEFAULT_LANG; }
};

export const setStoredLang = (lang) => {
    try { localStorage.setItem('ds_lang', lang); } catch {}
};

// ── Context ──────────────────────────────────────────────────────
export const LangContext = createContext({
    lang: DEFAULT_LANG,
    dir:  'rtl',
    t:    (key) => key,
    switchLang: () => {},
});

/**
 * LangProvider — reads lang from URL param (:lang) and syncs
 * document.documentElement attributes. Must be rendered inside
 * a route that provides the :lang param.
 */
export function LangProvider({ children }) {
    const { lang: urlLang } = useParams();
    const navigate          = useNavigate();

    // Resolve the active language
    const lang = SUPPORTED_LANGS.includes(urlLang) ? urlLang : DEFAULT_LANG;
    const dir  = lang === 'ar' ? 'rtl' : 'ltr';

    // ── Sync document attributes ─────────────────────────────────
    useEffect(() => {
        document.documentElement.lang = lang;
        document.documentElement.dir  = dir;
        setStoredLang(lang);
    }, [lang, dir]);

    // ── Translation function ──────────────────────────────────────
    const t = useMemo(() => {
        const dict = TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANG];
        return (key, fallback) => dict[key] ?? fallback ?? key;
    }, [lang]);

    // ── Language switcher ─────────────────────────────────────────
    /**
     * switchLang() navigates to the same page under the other language prefix.
     * e.g., /ar/sales → /en/sales
     */
    const switchLang = () => {
        const nextLang = lang === 'ar' ? 'en' : 'ar';
        // Replace the leading /:lang segment in the current pathname
        const currentPath = window.location.pathname;
        const withoutPrefix = currentPath.replace(/^\/(ar|en)/, '') || '/';
        const basePage = withoutPrefix === '/' ? '/dashboard' : withoutPrefix;
        navigate(`/${nextLang}${basePage}`, { replace: false });
    };

    return (
        <LangContext.Provider value={{ lang, dir, t, switchLang }}>
            {children}
        </LangContext.Provider>
    );
}

/** Hook: use inside any component inside LangProvider */
export const useLang = () => useContext(LangContext);
