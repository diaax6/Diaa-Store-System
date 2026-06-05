import { useState } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { DataProvider, useData } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './components/ConfirmDialog';
import { LangProvider, useLang, getStoredLang, SUPPORTED_LANGS } from './i18n/index';
import Login from './components/Login';
import Sidebar from './components/Sidebar';

import Dashboard    from './components/Dashboard';
import Sales        from './components/Sales';
import Accounts     from './components/Accounts';
import Shifts       from './components/Shifts';
import Reports      from './components/Reports';
import Expenses     from './components/Expenses';
import Renewals     from './components/Renewals';
import Problems     from './components/Problems';
import Clients      from './components/Clients';
import Wallets      from './components/Wallets';
import Users        from './components/Users';
import Products     from './components/Products';
import BotSettings  from './components/BotSettings';
import Employees    from './components/Employees';
import MyAccount    from './components/MyAccount';

// ── Root redirect: / → /ar/dashboard or /en/dashboard ────────────
function RootRedirect() {
    const lang = getStoredLang();
    return <Navigate to={`/${lang}/dashboard`} replace />;
}

// —— Mobile language switcher (used in mobile header) ———————————
function LangSwitcherMobile() {
    const { lang, switchLang, t } = useLang();
    return (
        <button
            onClick={switchLang}
            className="px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-black transition-all"
            title={t('lang_switch_to')}
        >
            {lang === 'ar' ? 'EN' : 'عر'}
        </button>
    );
}

// ── Unknown lang redirect: /xx/... → /:storedLang/... ────────────
function LangGuard({ children }) {
    const { lang } = useParams();
    if (!SUPPORTED_LANGS.includes(lang)) {
        const saved = getStoredLang();
        const path  = window.location.pathname.replace(/^\/[^/]+/, `/${saved}`);
        return <Navigate to={path} replace />;
    }
    return children;
}

// ── Main layout (inside LangProvider + DataProvider) ─────────────
const MainLayout = () => {
    const { user } = useAuth();
    const { activeTab } = useData();
    const { hasPermission: authPermission } = useAuth();
    const { lang } = useParams();
    const checkPerm = (perm) => authPermission ? authPermission(perm) : true;

    const [isSidebarOpen, setSidebarOpen] = useState(false);

    if (!user) return <Login />;

    // Layout direction based on lang param
    const dir = lang === 'en' ? 'ltr' : 'rtl';

    return (
        <div
            className="min-h-screen bg-slate-50 font-sans text-slate-800 flex"
            style={{ direction: dir }}
            dir={dir}
        >
            <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className={`flex-1 p-3 md:p-4 lg:p-8 transition-all duration-300 w-full ${dir === 'rtl' ? 'lg:mr-64' : 'lg:ml-64'}`}>
                <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">

                    {/* Mobile header */}
                    <div className="flex justify-between items-center mb-6 lg:hidden bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                                <i className="fa-solid fa-layer-group"></i>
                            </div>
                            <h2 className="text-lg font-black text-slate-800">Diaa Store</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Mobile lang switcher */}
                            <LangSwitcherMobile />
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="p-2.5 bg-slate-100 text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-200 transition"
                            >
                                <i className="fa-solid fa-bars text-xl"></i>
                            </button>
                        </div>
                    </div>

                    {/* Page components */}
                    {activeTab === 'dashboard'   && checkPerm('dashboard')   && <Dashboard />}
                    {activeTab === 'sales'       && checkPerm('sales')       && <Sales />}
                    {activeTab === 'products'    && checkPerm('products')    && <Products />}
                    {activeTab === 'accounts'    && checkPerm('accounts')    && <Accounts />}
                    {activeTab === 'clients'     && checkPerm('clients')     && <Clients />}
                    {activeTab === 'renewals'    && checkPerm('renewals')    && <Renewals />}
                    {activeTab === 'expenses'    && checkPerm('expenses')    && <Expenses />}
                    {activeTab === 'reports'     && checkPerm('reports')     && <Reports />}
                    {activeTab === 'shifts'      && checkPerm('shifts')      && <Shifts />}
                    {activeTab === 'wallets'     && checkPerm('wallets')     && <Wallets />}
                    {activeTab === 'problems'    && checkPerm('problems')    && <Problems />}
                    {activeTab === 'users'       && (checkPerm('all') || user.role === 'admin') && <Users />}
                    {activeTab === 'botSettings' && (checkPerm('botSettings') || checkPerm('all') || user.role === 'admin') && <BotSettings />}
                    {activeTab === 'employees'   && (checkPerm('employees')  || checkPerm('all') || user.role === 'admin') && <Employees />}
                    {activeTab === 'myAccount'   && <MyAccount />}

                </div>
            </main>
        </div>
    );
};

// ── Routed app wrapper — provides LangProvider inside /:lang ──────
function LanggedApp() {
    return (
        <LangGuard>
            <LangProvider>
                <DataProvider>
                    <ConfirmProvider>
                        <MainLayout />
                    </ConfirmProvider>
                </DataProvider>
            </LangProvider>
        </LangGuard>
    );
}

// ── Root App ──────────────────────────────────────────────────────
function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <Routes>
                    {/* Root: redirect to stored-language dashboard */}
                    <Route path="/" element={<RootRedirect />} />

                    {/* Language-prefixed routes: /:lang/* */}
                    <Route path="/:lang/*" element={<LanggedApp />} />

                    {/* Fallback: anything else → root redirect */}
                    <Route path="*" element={<RootRedirect />} />
                </Routes>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;