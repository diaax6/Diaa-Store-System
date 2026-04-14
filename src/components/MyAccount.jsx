import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inventoryLogsAPI } from '../services/api';
import { useConfirm } from './ConfirmDialog';

export default function MyAccount() {
    const { user, changePassword } = useAuth();
    const { inventoryLogs, refreshData } = useData();
    const { showAlert, showConfirm } = useConfirm();

    const [activeSection, setActiveSection] = useState('log'); // 'log' | 'password'
    const [filterType, setFilterType] = useState('all');
    const [visibleCount, setVisibleCount] = useState(30);
    const [returning, setReturning] = useState(null);

    // Password change state
    const [pwForm, setPwForm] = useState({ old: '', new: '', confirm: '' });
    const [pwLoading, setPwLoading] = useState(false);

    useEffect(() => { window.scrollTo(0, 0); }, []);

    // Filter logs for current user
    const myLogs = useMemo(() => {
        return inventoryLogs.filter(l => l.performedBy === user?.username);
    }, [inventoryLogs, user]);

    const filteredLogs = useMemo(() => {
        if (filterType === 'all') return myLogs;
        return myLogs.filter(l => l.actionType === filterType);
    }, [myLogs, filterType]);

    // Stats
    const stats = useMemo(() => {
        const todayStr = new Date().toDateString();
        const todayLogs = myLogs.filter(l => new Date(l.createdAt).toDateString() === todayStr);
        return {
            totalPulls: myLogs.filter(l => l.actionType === 'pull').length,
            todayPulls: todayLogs.filter(l => l.actionType === 'pull').length,
            totalAdds: myLogs.filter(l => l.actionType === 'add' || l.actionType === 'bulk_add').length,
            totalReturns: myLogs.filter(l => l.actionType === 'return').length,
            total: myLogs.length,
        };
    }, [myLogs]);

    // Handle return
    const handleReturn = async (log) => {
        if (log.isReturned || log.actionType !== 'pull') return;
        const confirmed = await showConfirm({
            title: 'إرجاع العنصر',
            message: `هل أنت متأكد من إرجاع "${log.accountEmail}" إلى قسم "${log.sectionName}"؟ سيتم إعادته للمخزون كعنصر متاح.`,
            confirmText: 'إرجاع',
            cancelText: 'إلغاء',
            type: 'warning'
        });
        if (!confirmed) return;

        setReturning(log.id);
        try {
            await inventoryLogsAPI.returnItem(log.id, log.accountId, log.sectionName, user?.username || 'Admin');
            await refreshData();
            await showAlert({ title: 'تم!', message: 'تم إرجاع العنصر بنجاح', type: 'success' });
        } catch (err) {
            console.error(err);
            await showAlert({ title: 'خطأ!', message: 'حدث خطأ أثناء الإرجاع', type: 'danger' });
        }
        setReturning(null);
    };

    // Password change handler
    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (pwForm.new !== pwForm.confirm) {
            await showAlert({ title: 'خطأ', message: 'كلمة المرور الجديدة غير متطابقة', type: 'warning' });
            return;
        }
        if (pwForm.new.length < 4) {
            await showAlert({ title: 'خطأ', message: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل', type: 'warning' });
            return;
        }
        setPwLoading(true);
        const result = await changePassword(pwForm.old, pwForm.new);
        setPwLoading(false);
        if (result.success) {
            await showAlert({ title: 'تم!', message: result.message, type: 'success' });
            setPwForm({ old: '', new: '', confirm: '' });
        } else {
            await showAlert({ title: 'خطأ', message: result.message, type: 'danger' });
        }
    };

    const getActionInfo = (type) => {
        const map = {
            pull: { label: 'سحب', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'fa-arrow-up-from-bracket', dot: 'bg-amber-500' },
            add: { label: 'إضافة', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fa-plus', dot: 'bg-emerald-500' },
            bulk_add: { label: 'إضافة جماعية', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: 'fa-layer-group', dot: 'bg-teal-500' },
            return: { label: 'إرجاع', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'fa-rotate-left', dot: 'bg-blue-500' },
            edit: { label: 'تعديل', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'fa-pen', dot: 'bg-purple-500' },
            delete: { label: 'حذف', color: 'bg-red-50 text-red-700 border-red-200', icon: 'fa-trash', dot: 'bg-red-500' },
        };
        return map[type] || map.pull;
    };

    const formatDate = (d) => {
        if (!d) return '-';
        const dt = new Date(d);
        return dt.toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const formatTime = (d) => {
        if (!d) return '';
        return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const getRoleLabel = (role) => {
        const map = { admin: '👑 أدمن', director: '⭐ دايركتور', moderator: '🔧 مودريتور' };
        return map[role] || role;
    };

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in pb-24 font-sans text-slate-800">

            {/* Profile Header */}
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute -left-8 -bottom-8 text-[120px] opacity-5"><i className="fa-solid fa-user-circle"></i></div>
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl border border-white/20 shadow-lg">
                            {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">{user?.username}</h2>
                            <span className="text-sm font-bold text-white/70 bg-white/10 px-3 py-1 rounded-full inline-block mt-1">{getRoleLabel(user?.role)}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                            <p className="text-2xl font-black">{stats.todayPulls}</p>
                            <p className="text-[10px] font-bold text-white/60 mt-0.5">سحبات اليوم</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                            <p className="text-2xl font-black">{stats.totalPulls}</p>
                            <p className="text-[10px] font-bold text-white/60 mt-0.5">إجمالي السحبات</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                            <p className="text-2xl font-black">{stats.totalAdds}</p>
                            <p className="text-[10px] font-bold text-white/60 mt-0.5">الإضافات</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                            <p className="text-2xl font-black">{stats.totalReturns}</p>
                            <p className="text-[10px] font-bold text-white/60 mt-0.5">الإرجاعات</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section Tabs */}
            <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                <button onClick={() => setActiveSection('log')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeSection === 'log' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fa-solid fa-clock-rotate-left text-xs"></i> سجل النشاط
                </button>
                <button onClick={() => setActiveSection('password')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeSection === 'password' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fa-solid fa-key text-xs"></i> تغيير الباسورد
                </button>
            </div>

            {/* ===== PASSWORD CHANGE SECTION ===== */}
            {activeSection === 'password' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 max-w-lg mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl"><i className="fa-solid fa-shield-halved"></i></div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800">تغيير كلمة المرور</h3>
                            <p className="text-xs text-slate-400 font-medium">أدخل كلمة المرور الحالية والجديدة</p>
                        </div>
                    </div>

                    <form onSubmit={handleChangePassword} className="space-y-5">
                        <div>
                            <label className="block text-sm font-extrabold text-slate-800 mb-2">كلمة المرور الحالية</label>
                            <div className="relative">
                                <input type="password" value={pwForm.old} onChange={e => setPwForm({ ...pwForm, old: e.target.value })} className="w-full bg-white border-2 border-slate-200 text-slate-900 text-sm font-bold rounded-xl pl-10 p-3.5 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all placeholder-slate-400 shadow-sm" placeholder="••••••••" required />
                                <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-extrabold text-slate-800 mb-2">كلمة المرور الجديدة</label>
                            <div className="relative">
                                <input type="password" value={pwForm.new} onChange={e => setPwForm({ ...pwForm, new: e.target.value })} className="w-full bg-white border-2 border-slate-200 text-slate-900 text-sm font-bold rounded-xl pl-10 p-3.5 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all placeholder-slate-400 shadow-sm" placeholder="••••••••" required minLength={4} />
                                <i className="fa-solid fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-extrabold text-slate-800 mb-2">تأكيد كلمة المرور الجديدة</label>
                            <div className="relative">
                                <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} className="w-full bg-white border-2 border-slate-200 text-slate-900 text-sm font-bold rounded-xl pl-10 p-3.5 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all placeholder-slate-400 shadow-sm" placeholder="••••••••" required minLength={4} />
                                <i className="fa-solid fa-check-double absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            </div>
                        </div>
                        {pwForm.new && pwForm.confirm && pwForm.new !== pwForm.confirm && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 font-bold flex items-center gap-2">
                                <i className="fa-solid fa-circle-exclamation"></i> كلمة المرور غير متطابقة
                            </div>
                        )}
                        <button type="submit" disabled={pwLoading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                            {pwLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-check"></i> تغيير كلمة المرور</>}
                        </button>
                    </form>
                </div>
            )}

            {/* ===== ACTIVITY LOG SECTION ===== */}
            {activeSection === 'log' && (
                <>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        {[
                            { id: 'all', label: 'الكل', count: myLogs.length, icon: 'fa-list' },
                            { id: 'pull', label: 'سحب', count: stats.totalPulls, icon: 'fa-arrow-up-from-bracket' },
                            { id: 'add', label: 'إضافة', count: stats.totalAdds, icon: 'fa-plus' },
                            { id: 'return', label: 'إرجاع', count: stats.totalReturns, icon: 'fa-rotate-left' },
                        ].map(f => (
                            <button key={f.id} onClick={() => setFilterType(f.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all flex-1 justify-center ${filterType === f.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                                <i className={`fa-solid ${f.icon} text-[10px]`}></i>
                                {f.label}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${filterType === f.id ? 'bg-white/20' : 'bg-slate-100'}`}>{f.count}</span>
                            </button>
                        ))}
                    </div>

                    {/* Log Items */}
                    {filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                            <i className="fa-solid fa-clock-rotate-left text-5xl mb-4 opacity-30"></i>
                            <p className="font-bold text-lg">لا توجد عمليات مسجلة</p>
                            <p className="text-sm mt-1">عمليات السحب والإضافة ستظهر هنا تلقائياً</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredLogs.slice(0, visibleCount).map(log => {
                                const info = getActionInfo(log.actionType);
                                const isReturnable = log.actionType === 'pull' && !log.isReturned && log.accountId;
                                return (
                                    <div key={log.id} className={`bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden relative group ${log.isReturned ? 'opacity-60' : ''}`}>
                                        <div className={`absolute top-0 bottom-0 right-0 w-1.5 ${info.dot}`}></div>
                                        <div className="p-4 flex flex-col md:flex-row gap-3 items-start md:items-center">
                                            {/* Icon */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${info.color} border`}>
                                                <i className={`fa-solid ${info.icon} text-sm`}></i>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${info.color}`}>{info.label}</span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-50 text-slate-500 border border-slate-100">{log.sectionName}</span>
                                                    {log.isReturned && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-1">
                                                            <i className="fa-solid fa-rotate-left text-[8px]"></i> تم الإرجاع
                                                        </span>
                                                    )}
                                                    {log.quantity > 1 && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-600 border border-purple-200">×{log.quantity}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <code className="text-sm font-mono font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 truncate">{log.accountEmail || '-'}</code>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 font-bold">
                                                    <span className="flex items-center gap-1"><i className="fa-solid fa-calendar text-[8px]"></i> {formatDate(log.createdAt)}</span>
                                                    <span className="flex items-center gap-1"><i className="fa-solid fa-clock text-[8px]"></i> {formatTime(log.createdAt)}</span>
                                                    {log.availableAfter !== undefined && (
                                                        <span className="flex items-center gap-1"><i className="fa-solid fa-boxes-stacked text-[8px]"></i> المتاح: {log.availableAfter}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Return Button */}
                                            {isReturnable && (
                                                <button onClick={() => handleReturn(log)} disabled={returning === log.id}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-all disabled:opacity-50 flex-shrink-0">
                                                    {returning === log.id ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-rotate-left"></i>}
                                                    إرجاع
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {visibleCount < filteredLogs.length && (
                                <div className="flex justify-center mt-6">
                                    <button onClick={() => setVisibleCount(p => p + 30)} className="bg-white border-2 border-indigo-100 text-indigo-600 px-10 py-3 rounded-full font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-sm">
                                        عرض المزيد <i className="fa-solid fa-chevron-down"></i>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <style>{`
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
