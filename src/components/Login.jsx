import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n/index';

export default function Login () {
    const { login } = useAuth();
    const { t, dir } = useLang();
    const [creds, setCreds] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const result = await login(creds.username, creds.password);
            if (!result.success) {
                setError(result.message || t('login_err_default'));
            }
        } catch (err) {
            setError(t('login_err_network'));
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4 font-sans" dir={dir}>
            <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md relative overflow-hidden animate-fade-in border border-white/50">

                {/* Decorative background */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-600 to-blue-500"></div>
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full blur-2xl opacity-60"></div>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-50 rounded-full blur-2xl opacity-60"></div>

                <div className="text-center mb-10 relative z-10">
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-indigo-100 transform rotate-3">
                        <i className="fa-solid fa-layer-group text-3xl text-indigo-600"></i>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">{t('login_welcome')}</h2>
                    <p className="text-slate-500 font-medium text-sm">{t('login_subtitle')}</p>
                </div>

                {error && (
                    <div className={`bg-red-50 border-${dir === 'rtl' ? 'r' : 'l'}-4 border-red-500 text-red-700 p-4 rounded-xl text-sm font-bold mb-6 flex items-center gap-3 animate-pulse`}>
                        <i className="fa-solid fa-circle-exclamation text-lg"></i>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6 relative z-10">
                    <div>
                        <label className="label-style">{t('login_username_label')}</label>
                        <div className="relative">
                            <input
                                type="text"
                                className={`input-style ${dir === 'rtl' ? 'pl-10' : 'pr-10'}`}
                                value={creds.username}
                                onChange={e => setCreds({ ...creds, username: e.target.value })}
                                required
                                placeholder="admin@diaastore.com"
                                dir="ltr"
                            />
                            <i className={`fa-solid fa-envelope absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`}></i>
                        </div>
                    </div>
                    <div>
                        <label className="label-style">{t('login_password_label')}</label>
                        <div className="relative">
                            <input
                                type="password"
                                className={`input-style ${dir === 'rtl' ? 'pl-10' : 'pr-10'} font-mono`}
                                value={creds.password}
                                onChange={e => setCreds({ ...creds, password: e.target.value })}
                                required
                                placeholder="••••••••"
                                dir="ltr"
                            />
                            <i className={`fa-solid fa-lock absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`}></i>
                        </div>
                    </div>

                    <button
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-blue-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 text-lg mt-2 disabled:opacity-60"
                    >
                        {isLoading ? (
                            <i className="fa-solid fa-spinner fa-spin"></i>
                        ) : (
                            <>{t('login_btn')} <i className={`fa-solid ${dir === 'rtl' ? 'fa-arrow-left' : 'fa-arrow-right'} text-sm`}></i></>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center text-xs text-slate-400 font-medium relative z-10">
                    Diaa Store v2.0 — Online
                </div>
            </div>

            {/* CSS Styles Injection */}
            <style>{`
                .label-style { display: block; font-size: 0.875rem; font-weight: 800; color: #1e293b; margin-bottom: 0.5rem; letter-spacing: 0.025em; }
                .input-style { width: 100%; background: white; border: 2px solid #cbd5e1; color: #0f172a; font-size: 0.875rem; font-weight: 700; border-radius: 0.75rem; padding: 0.875rem; outline: none; transition: all 0.2s; }
                .input-style:focus { border-color: #4f46e5; box-shadow: 0 0 0 4px rgba(79,70,229,0.1); }
                .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}
            </style>
        </div>
    );
}