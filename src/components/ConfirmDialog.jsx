import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';

// ========= Context for app-wide confirm/alert =========
const ConfirmContext = createContext();

export function ConfirmProvider({ children }) {
    const [dialog, setDialog] = useState(null);
    const resolveRef = useRef(null);

    const showConfirm = useCallback(({ title, message, confirmText, cancelText, type }) => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setDialog({ title, message, confirmText: confirmText || 'تأكيد', cancelText: cancelText || 'إلغاء', type: type || 'warning' });
        });
    }, []);

    const showAlert = useCallback(({ title, message, type }) => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setDialog({ title, message, confirmText: 'حسناً', cancelText: null, type: type || 'info', isAlert: true });
        });
    }, []);

    const handleConfirm = () => {
        if (resolveRef.current) resolveRef.current(true);
        setDialog(null);
    };

    const handleCancel = () => {
        if (resolveRef.current) resolveRef.current(false);
        setDialog(null);
    };

    // ESC key to cancel
    useEffect(() => {
        if (!dialog) return;
        const handleKey = (e) => { if (e.key === 'Escape') handleCancel(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [dialog]);

    const typeConfig = {
        warning: { icon: 'fa-triangle-exclamation', iconBg: 'bg-amber-100 text-amber-600', btnClass: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' },
        danger: { icon: 'fa-trash', iconBg: 'bg-red-100 text-red-600', btnClass: 'bg-red-500 hover:bg-red-600 shadow-red-200' },
        success: { icon: 'fa-check-circle', iconBg: 'bg-emerald-100 text-emerald-600', btnClass: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' },
        info: { icon: 'fa-circle-info', iconBg: 'bg-blue-100 text-blue-600', btnClass: 'bg-blue-500 hover:bg-blue-600 shadow-blue-200' },
    };

    return (
        <ConfirmContext.Provider value={{ showConfirm, showAlert }}>
            {children}
            {dialog && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-confirm-fade-in" onClick={handleCancel}>
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-confirm-scale-in" onClick={e => e.stopPropagation()}>
                        {/* Icon + Title */}
                        <div className="p-6 pb-4 text-center">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${typeConfig[dialog.type]?.iconBg || typeConfig.warning.iconBg}`}>
                                <i className={`fa-solid ${typeConfig[dialog.type]?.icon || 'fa-question'} text-2xl`}></i>
                            </div>
                            <h3 className="text-lg font-extrabold text-slate-800 mb-2">{dialog.title || 'تأكيد'}</h3>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">{dialog.message}</p>
                        </div>

                        {/* Actions */}
                        <div className={`p-5 pt-2 flex gap-3 ${dialog.isAlert ? 'justify-center' : ''}`}>
                            {!dialog.isAlert && (
                                <button
                                    onClick={handleCancel}
                                    className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-600 bg-slate-50 border-2 border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all"
                                >
                                    {dialog.cancelText}
                                </button>
                            )}
                            <button
                                onClick={handleConfirm}
                                autoFocus
                                className={`flex-1 py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all hover:-translate-y-0.5 ${typeConfig[dialog.type]?.btnClass || typeConfig.warning.btnClass}`}
                            >
                                {dialog.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .animate-confirm-fade-in { animation: confirmFadeIn 0.2s ease-out forwards; }
                @keyframes confirmFadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-confirm-scale-in { animation: confirmScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
                @keyframes confirmScaleIn { from { opacity: 0; transform: scale(0.85) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            `}</style>
        </ConfirmContext.Provider>
    );
}

export const useConfirm = () => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
    return ctx;
};
