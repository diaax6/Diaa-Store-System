import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { TAB_TO_PATH, getLangAndTabFromPath } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n/index';
import { accountsAPI } from '../services/api';

export default function Sidebar ({ isOpen, onClose }) {
    const { sales, accounts, sections, refreshData } = useData();
    const { user, logout, hasPermission } = useAuth();
    const { lang, t, switchLang } = useLang();
    const navigate = useNavigate();
    const location = useLocation();
    // Derive active tab from URL path
    const { tab: activeTab } = getLangAndTabFromPath(location.pathname);
    const go = (tab) => { navigate(TAB_TO_PATH(lang, tab)); onClose(); };
    const [showQuickPull, setShowQuickPull] = useState(false);
    const [pullResult, setPullResult] = useState(null);
    const [copiedField, setCopiedField] = useState(null);
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('ds_dark_mode') === 'true' || document.documentElement.classList.contains('dark');
        }
        return false;
    });

    // Apply dark mode on mount
    useEffect(() => {
        const saved = localStorage.getItem('ds_dark_mode');
        if (saved === 'true') {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        }
    }, []);

    const toggleDarkMode = () => {
        const newVal = !isDark;
        setIsDark(newVal);
        document.documentElement.classList.toggle('dark', newVal);
        localStorage.setItem('ds_dark_mode', String(newVal));
    };

    // Auto-redirect moderator from dashboard to sales
    useEffect(() => {
        if (user && user.role !== 'admin' && hasPermission('sales') && activeTab === 'dashboard') {
            navigate(TAB_TO_PATH(lang, 'sales'));
        }
    }, [user]);

    const alertsCount = useMemo(() => {
        try {
            let count = 0;
            sales.forEach(sale => {
                if (sale.renewal_stage === 'renewed') return;
                if (!sale.isPaid && Number(sale.remainingAmount) > 0) count++;
                if (sale.expiryDate) {
                    const daysLeft = Math.ceil((new Date(sale.expiryDate) - new Date()) / 86400000);
                    if (daysLeft <= 5) count++;
                }
            });
            return count;
        } catch { return 0; }
    }, [sales, activeTab]);

    // Available counts per section
    const sectionAvailable = useMemo(() => {
        const c = {};
        (accounts || []).filter(a => a.status === 'available').forEach(a => { c[a.productName] = (c[a.productName] || 0) + 1; });
        return c;
    }, [accounts]);

    const totalAvailable = useMemo(() => (accounts || []).filter(a => a.status === 'available').length, [accounts]);

    // Quick pull handler
    const handleQuickPull = async (sectionName) => {
        try {
            const result = await accountsAPI.pullNext(sectionName, user?.username || 'Admin');
            if (result.empty) {
                setPullResult({ empty: true, name: sectionName });
            } else {
                let txt = result.email;
                if (result.password) txt += `\n${result.password}`;
                if (result.twoFA || result.two_fa) txt += `\n${result.twoFA || result.two_fa}`;
                navigator.clipboard.writeText(txt);
                setPullResult({ ...result, name: sectionName });
                await refreshData();
            }
            setTimeout(() => setPullResult(null), 4000);
        } catch (error) {
            console.error(error);
        }
    };

    const copyField = (text, id) => { navigator.clipboard.writeText(text); setCopiedField(id); setTimeout(() => setCopiedField(null), 1500); };

    const allTabs = [
        { id: 'dashboard', label: t('nav_dashboard'), icon: 'fa-chart-pie' },
        { id: 'sales',     label: t('nav_sales'),     icon: 'fa-cart-shopping' },
        { id: 'products',  label: t('nav_products'),  icon: 'fa-boxes-stacked' },
        { id: 'accounts',  label: t('nav_accounts'),  icon: 'fa-server' },
        { id: 'clients',   label: t('nav_clients'),   icon: 'fa-users' },
        { id: 'shifts',    label: t('nav_shifts'),    icon: 'fa-clock' },
        { id: 'reports',   label: t('nav_reports'),   icon: 'fa-chart-line' },
        { id: 'expenses',  label: t('nav_expenses'),  icon: 'fa-wallet' },
        { id: 'wallets',   label: t('nav_wallets'),   icon: 'fa-vault' },
        { id: 'renewals',  label: t('nav_renewals'),  icon: 'fa-bell' },
        { id: 'problems',  label: t('nav_problems'),  icon: 'fa-triangle-exclamation' },
    ];

    return (
        <>
            {isOpen && (
                <div onClick={onClose} className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"></div>
            )}

            <aside className={`fixed top-0 bottom-0 w-64 bg-slate-900 text-white z-50 flex flex-col shadow-2xl overflow-hidden font-sans transition-transform duration-300
                ${lang === 'en' ? 'left-0' : 'right-0'}
                ${isOpen ? 'translate-x-0' : lang === 'en' ? '-translate-x-full lg:translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>

                <div className="p-6 border-b border-slate-800 relative">
                    <button onClick={onClose} className={`absolute top-4 ${lang === 'en' ? 'right-4' : 'left-4'} text-slate-400 hover:text-white lg:hidden`}>
                        <i className="fa-solid fa-xmark text-xl"></i>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/50 flex-shrink-0">
                            <i className="fa-solid fa-layer-group text-xl"></i>
                        </div>
                        <div className="overflow-hidden flex-1">
                            <h1 className="text-lg font-black tracking-tight truncate">Diaa Store</h1>
                            <p className="text-[10px] text-slate-400 font-bold">{t('nav_subtitle') || 'إدارة الاشتراكات'}</p>
                        </div>
                        {/* Language switcher — always visible */}
                        <button
                            onClick={(e) => { e.stopPropagation(); switchLang(); }}
                            className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all text-xs font-black tracking-wide"
                            title={t('lang_switch_to')}
                        >
                            {lang === 'ar' ? 'EN' : 'ع'}
                        </button>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto custom-scrollbar py-3">
                    {/* Main nav */}
                    <div className="px-3 space-y-0.5">
                        {allTabs.filter(t => hasPermission(t.id)).map(item => (
                            <button
                                key={item.id}
                                onClick={() => go(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative text-sm ${
                                    activeTab === item.id
                                        ? 'bg-indigo-500/20 text-indigo-300 font-semibold border-r-2 border-indigo-400'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium border-r-2 border-transparent'
                                }`}
                            >
                                <i className={`fa-solid ${item.icon} w-4 text-center text-sm ${
                                    activeTab === item.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
                                }`}></i>
                                <span>{item.label}</span>
                                {item.id === 'renewals' && alertsCount > 0 && (
                                    <span className="mr-auto bg-red-500 text-white text-[9px] font-black h-4 px-1.5 min-w-4 flex items-center justify-center rounded-full">
                                        {alertsCount > 99 ? '+99' : alertsCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Admin group */}
                    {(hasPermission('all') || user.role === 'admin' || hasPermission('employees') || hasPermission('botSettings')) && (
                        <>
                            <p className="nav-grp mt-2">{t('nav_section_admin')}</p>
                            <div className="px-3 space-y-0.5">
                                {(hasPermission('all') || user.role === 'admin') && (
                                    <button onClick={() => go('users')}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm ${
                                            activeTab === 'users'
                                                ? 'bg-indigo-500/20 text-indigo-300 font-semibold border-r-2 border-indigo-400'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium border-r-2 border-transparent'
                                        }`}>
                                        <i className={`fa-solid fa-user-gear w-4 text-center text-sm ${activeTab === 'users' ? 'text-indigo-400' : 'text-slate-500'}`}></i>
                                        <span>{t('nav_users')}</span>
                                    </button>
                                )}
                                {(hasPermission('employees') || hasPermission('all') || user.role === 'admin') && (
                                    <button onClick={() => go('employees')}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm ${
                                            activeTab === 'employees'
                                                ? 'bg-indigo-500/20 text-indigo-300 font-semibold border-r-2 border-indigo-400'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium border-r-2 border-transparent'
                                        }`}>
                                        <i className={`fa-solid fa-id-card-clip w-4 text-center text-sm ${activeTab === 'employees' ? 'text-indigo-400' : 'text-slate-500'}`}></i>
                                        <span>{t('nav_employees')}</span>
                                    </button>
                                )}
                                {(hasPermission('botSettings') || hasPermission('all') || user.role === 'admin') && (
                                    <button onClick={() => go('botSettings')}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm ${
                                            activeTab === 'botSettings'
                                                ? 'bg-indigo-500/20 text-indigo-300 font-semibold border-r-2 border-indigo-400'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium border-r-2 border-transparent'
                                        }`}>
                                        <i className={`fa-brands fa-telegram w-4 text-center text-sm ${activeTab === 'botSettings' ? 'text-indigo-400' : 'text-slate-500'}`}></i>
                                        <span>{t('nav_botSettings')}</span>
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {/* ===== QUICK PULL SECTION ===== */}
                    {hasPermission('accounts') && sections && sections.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800">
                            <button onClick={() => setShowQuickPull(!showQuickPull)}
                                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-bolt text-sm"></i>
                                    <span className="text-xs font-bold">{t('nav_quick_pull')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full font-black">{totalAvailable}</span>
                                    <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${showQuickPull ? 'rotate-180' : ''}`}></i>
                                </div>
                            </button>

                            {showQuickPull && (
                                <div className="mt-2 space-y-1 animate-fade-in">
                                    {sections.map(sec => {
                                        const avail = sectionAvailable[sec.name] || 0;
                                        const isCodes = sec.type === 'codes';
                                        return (
                                            <button key={sec.id} onClick={() => handleQuickPull(sec.name)}
                                                disabled={avail === 0}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${avail > 0
                                                    ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                                    : 'text-slate-600 cursor-not-allowed'}`}>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <i className={`fa-solid ${isCodes ? 'fa-key text-amber-500' : 'fa-user-shield text-indigo-400'} text-[10px]`}></i>
                                                    <span className="font-bold truncate">{sec.name}</span>
                                                </div>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-black flex-shrink-0 ${avail > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>{avail}</span>
                                            </button>
                                        );
                                    })}

                                    {/* Pull Result Toast */}
                                    {pullResult && (
                                        <div className={`mt-2 p-3 rounded-xl text-xs font-bold animate-fade-in ${pullResult.empty ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                            {pullResult.empty ? (
                                                <div className="flex items-center gap-2">
                                                    <i className="fa-solid fa-box-open"></i>
                                                    <span>{pullResult.name} فارغ!</span>
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <i className="fa-solid fa-check-circle"></i>
                                                        <span>تم السحب ✓ ({pullResult.name})</span>
                                                    </div>
                                                    <div className="bg-slate-900/50 rounded-lg p-2 space-y-1 dir-ltr text-left">
                                                        <div className="flex items-center justify-between">
                                                            <code className="text-emerald-200 truncate flex-1">{pullResult.email}</code>
                                                            <button onClick={() => copyField(pullResult.email, 'se')} className="text-emerald-400 hover:text-white mr-1 flex-shrink-0">
                                                                <i className={`fa-solid ${copiedField === 'se' ? 'fa-check' : 'fa-copy'} text-[9px]`}></i>
                                                            </button>
                                                        </div>
                                                        {pullResult.password && (
                                                            <div className="flex items-center justify-between text-slate-400">
                                                                <code className="truncate flex-1">{pullResult.password}</code>
                                                                <button onClick={() => copyField(pullResult.password, 'sp')} className="hover:text-white mr-1 flex-shrink-0">
                                                                    <i className={`fa-solid ${copiedField === 'sp' ? 'fa-check' : 'fa-copy'} text-[9px]`}></i>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </nav>

                <div className="p-3 border-t border-slate-800">
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" onClick={() => go('myAccount')}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-xs font-semibold text-slate-200 truncate">{user.username}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{user.role}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            {/* Language switcher */}
                            <button
                                onClick={e => { e.stopPropagation(); switchLang(); }}
                                className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-300 transition-all text-[9px] font-black"
                                title={t('lang_switch_to')}
                            >
                                {lang === 'ar' ? 'EN' : 'ع'}
                            </button>
                            <button onClick={e => { e.stopPropagation(); toggleDarkMode(); }}
                                className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-yellow-400 transition-all"
                                title={isDark ? t('light_mode') : t('dark_mode')}>
                                <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'} text-xs`}></i>
                            </button>
                            <button onClick={e => { e.stopPropagation(); logout(); }}
                                className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                                title={t('logout')}>
                                <i className="fa-solid fa-right-from-bracket text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            <style>{`
                .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </>
    );
}