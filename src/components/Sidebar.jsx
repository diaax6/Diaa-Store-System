import { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { accountsAPI } from '../services/api';

export default function Sidebar ({ isOpen, onClose }) {
    const { activeTab, setActiveTab, sales, accounts, sections, refreshData } = useData();
    const { user, logout, hasPermission } = useAuth();
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

    // التوجيه التلقائي للمودريتور
    useEffect(() => {
        if (user) {
            if (user.role !== 'admin' && hasPermission('sales') && activeTab === 'dashboard') {
                setActiveTab('sales');
            }
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
        { id: 'dashboard', label: 'الرئيسية', icon: 'fa-chart-pie' },
        { id: 'sales', label: 'المبيعات', icon: 'fa-cart-shopping' },
        { id: 'products', label: 'المنتجات', icon: 'fa-boxes-stacked' },
        { id: 'accounts', label: 'المخزون', icon: 'fa-server' },
        { id: 'clients', label: 'العملاء', icon: 'fa-users' },
        { id: 'shifts', label: 'الشفتات', icon: 'fa-clock' },
        { id: 'reports', label: 'التقارير', icon: 'fa-chart-line' },
        { id: 'expenses', label: 'المصروفات', icon: 'fa-wallet' },
        { id: 'wallets', label: 'المحافظ', icon: 'fa-vault' },
        { id: 'renewals', label: 'التنبيهات', icon: 'fa-bell' },
        { id: 'problems', label: 'المشاكل', icon: 'fa-triangle-exclamation' },
    ];

    return (
        <>
            {isOpen && (
                <div onClick={onClose} className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"></div>
            )}

            <aside className={`fixed top-0 bottom-0 right-0 w-64 bg-slate-900 text-white z-50 flex flex-col shadow-2xl overflow-hidden font-sans transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>

                <div className="p-6 border-b border-slate-800 relative">
                    <button onClick={onClose} className="absolute top-4 left-4 text-slate-400 hover:text-white lg:hidden">
                        <i className="fa-solid fa-xmark text-xl"></i>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/50 flex-shrink-0">
                            <i className="fa-solid fa-layer-group text-xl"></i>
                        </div>
                        <div className="overflow-hidden">
                            <h1 className="text-lg font-black tracking-tight truncate">Diaa Store</h1>
                            <p className="text-[10px] text-slate-400 font-bold">إدارة الاشتراكات</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
                    {allTabs.filter(t => hasPermission(t.id)).map(item => (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); onClose(); }}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group relative ${activeTab === item.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 font-bold'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'
                                }`}
                        >
                            <i className={`fa-solid ${item.icon} w-5 text-center transition-transform group-hover:scale-110 ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`}></i>
                            <span className="text-sm">{item.label}</span>

                            {item.id === 'renewals' && alertsCount > 0 && (
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[9px] font-black h-5 w-5 flex items-center justify-center rounded-full animate-pulse shadow-sm">
                                    {alertsCount > 99 ? '+99' : alertsCount}
                                </span>
                            )}
                        </button>
                    ))}

                    {(hasPermission('all') || user.role === 'admin') && (
                        <button onClick={() => { setActiveTab('users'); onClose(); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'users' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'}`}>
                            <i className="fa-solid fa-user-gear w-5 text-center"></i>
                            <span className="text-sm">المستخدمين</span>
                        </button>
                    )}

                    {(hasPermission('employees') || hasPermission('all') || user.role === 'admin') && (
                        <button onClick={() => { setActiveTab('employees'); onClose(); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'employees' ? 'bg-violet-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'}`}>
                            <i className="fa-solid fa-id-card-clip w-5 text-center"></i>
                            <span className="text-sm">الموظفين</span>
                        </button>
                    )}

                    {(hasPermission('botSettings') || hasPermission('all') || user.role === 'admin') && (
                        <button onClick={() => { setActiveTab('botSettings'); onClose(); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'botSettings' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'}`}>
                            <i className="fa-brands fa-telegram w-5 text-center"></i>
                            <span className="text-sm">إعدادات البوت</span>
                        </button>
                    )}

                    {/* ===== QUICK PULL SECTION ===== */}
                    {hasPermission('accounts') && sections && sections.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800">
                            <button onClick={() => setShowQuickPull(!showQuickPull)}
                                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-bolt text-sm"></i>
                                    <span className="text-xs font-bold">سحب سريع</span>
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

                <div className="p-4 border-t border-slate-800 bg-slate-900">
                    <div className="flex items-center gap-3 mb-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-xs shadow-lg">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <h4 className="text-xs font-bold text-white truncate">{user.username}</h4>
                            <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">{user.role}</span>
                        </div>
                        {/* Dark Mode Toggle */}
                        <button onClick={toggleDarkMode} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-yellow-400 transition-all border border-slate-700" title={isDark ? 'الوضع الفاتح' : 'الوضع المظلم'}>
                            <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'} text-sm`}></i>
                        </button>
                    </div>
                    <div className="space-y-1.5">
                        <button onClick={() => { setActiveTab('myAccount'); onClose(); }} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all border font-bold text-xs ${activeTab === 'myAccount' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:border-indigo-500/50'}`}>
                            <i className="fa-solid fa-user-circle"></i> حسابي
                        </button>
                        <button onClick={logout} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-400 py-2.5 rounded-xl transition-all border border-slate-700 hover:border-red-500/50 font-bold text-xs">
                            <i className="fa-solid fa-right-from-bracket"></i> تسجيل خروج
                        </button>
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