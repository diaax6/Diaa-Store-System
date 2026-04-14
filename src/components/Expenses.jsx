import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { expensesAPI, walletsAPI } from '../services/api';
import { useConfirm } from './ConfirmDialog';

export default function Expenses () {
    useEffect(() => { window.scrollTo(0, 0); }, []);

    const { user } = useAuth();
    const { expenses: ctxExpenses, wallets: ctxWallets, accounts: ctxAccounts, sales: ctxSales, refreshData } = useData();
    const currentUser = user?.username || 'Admin';

    const [expenses, setExpenses] = useState([]);
    const [wallets, setWallets] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState(''); // '' = all dates, else 'YYYY-MM-DD'
    const { showConfirm, showAlert } = useConfirm();

    useEffect(() => {
        setExpenses(ctxExpenses);
        setWallets(ctxWallets);
    }, [ctxExpenses, ctxWallets]);

    // ===== Date-filtered base =====
    const dateFilteredExpenses = useMemo(() => {
        if (!dateFilter) return expenses;
        return expenses.filter(e => {
            const d = (e.date || '').split('T')[0].split(' ')[0];
            return d === dateFilter;
        });
    }, [expenses, dateFilter]);

    // ===== Stats (react to date filter) =====
    const stats = useMemo(() => {
        const base = dateFilteredExpenses;
        const today = new Date().toISOString().split('T')[0];
        const todayDate = new Date(today);

        const dailyExpenses = base.filter(e => e.expenseCategory === 'daily' || !e.expenseCategory);
        const stockExpenses = base.filter(e => e.expenseCategory === 'stock');
        const salaryExpenses = base.filter(e => e.expenseCategory === 'salary');

        const totalDaily  = dailyExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const totalStock  = stockExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const totalSalary = salaryExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const totalAll = totalDaily + totalStock + totalSalary;

        // Revenue for selected date/all
        const filteredSales = dateFilter
            ? (ctxSales || []).filter(s => (s.date || '').split('T')[0] === dateFilter)
            : ctxSales || [];
        const totalRevenue = filteredSales.reduce((s, x) => s + (Number(x.finalPrice) || 0), 0);
        const netProfit = totalRevenue - totalAll;

        // Today-specific (only when no filter OR filter = today)
        const effectiveDate = dateFilter || today;
        const todaySales = (ctxSales || []).filter(s => (s.date || '').split('T')[0] === effectiveDate);
        const todayRevenue = todaySales.reduce((s, x) => s + (Number(x.finalPrice) || 0), 0);
        const todayExpenses = expenses.filter(e => (e.date || '').split('T')[0].split(' ')[0] === effectiveDate);
        const todayExpTotal = todayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const todayProfit = todayRevenue - todayExpTotal;

        return { totalAll, totalDaily, totalStock, totalSalary, totalRevenue, netProfit, todayRevenue: dateFilter ? totalRevenue : todayRevenue, todayDailyTotal: dateFilter ? totalAll : todayExpTotal, todayProfit: dateFilter ? netProfit : todayProfit };
    }, [dateFilteredExpenses, ctxSales, expenses, dateFilter]);

    // ===== Filtered Expenses =====
    const filteredExpenses = useMemo(() => {
        let base = dateFilteredExpenses;
        if (categoryFilter !== 'all') base = base.filter(e => (e.expenseCategory || 'daily') === categoryFilter);
        return base;
    }, [dateFilteredExpenses, categoryFilter]);

    // خصم من المحفظة
    const deductFromWallet = async (walletId, amount, description) => {
        if (!walletId) return;
        await walletsAPI.withdraw(walletId, amount, description, 'مصروفات', 'System');
    };

    // رد المبلغ للمحفظة (عند الحذف)
    const refundToWallet = async (walletId, amount) => {
        if (!walletId) return;
        await walletsAPI.deposit(walletId, amount, 'استرداد مصروف محذوف', 'استرداد', 'System');
    };

    // إضافة مصروف
    const handleAddExpense = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        // خصم من المحفظة
        if (data.walletId && data.walletId !== '') {
            const wallet = wallets.find(w => String(w.id) === String(data.walletId));
            if (wallet && Number(data.amount) > wallet.balance) {
                showAlert({ title: 'رصيد غير كافي', message: `رصيد المحفظة (${wallet.name}) غير كافي! الرصيد: ${wallet.balance}`, type: 'danger' });
                return;
            }
            await deductFromWallet(data.walletId, data.amount, `${data.type} - ${data.description || ''}`);
            data.walletName = wallet?.name || '';
        }

        // تأكد من وجود تصنيف المصروف
        data.expenseCategory = data.expenseCategory || 'daily';

        try {
            data.actionBy = currentUser;
            await expensesAPI.create(data);
            await showAlert({ title: 'تم بنجاح', message: 'تم تسجيل المصروف وخصمه من المحفظة ✅', type: 'success' });
            setShowAddModal(false);
            await refreshData();
        } catch (error) {
            console.error(error);
            showAlert({ title: 'خطأ!', message: 'حدث خطأ', type: 'danger' });
        }
    };

    // تعديل مصروف
    const handleUpdateExpense = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.expenseCategory = data.expenseCategory || 'daily';

        try {
            data._oldExpense = editingExpense;
            data._actionBy = currentUser;
            await expensesAPI.update(editingExpense.id, data);
            await showAlert({ title: 'تم بنجاح', message: 'تم تعديل المصروف بنجاح ✅', type: 'success' });
            setEditingExpense(null);
            await refreshData();
        } catch (error) {
            console.error(error);
        }
    };

    // حذف مصروف (ورد المبلغ للمحفظة)
    const handleDelete = async (id) => {
        const confirmed = await showConfirm({
            title: 'حذف المصروف',
            message: 'هل أنت متأكد من حذف هذا المصروف؟ (سيتم رد المبلغ للمحفظة إن وُجدت)',
            confirmText: 'حذف',
            cancelText: 'إلغاء',
            type: 'danger'
        });
        if (!confirmed) return;
        const expense = expenses.find(e => e.id === id);
        if (expense && (expense.walletId || expense.wallet_id)) {
            await refundToWallet(expense.walletId || expense.wallet_id, expense.amount);
        }
        try {
            await expensesAPI.delete(id, expense, currentUser);
            await refreshData();
        } catch (error) {
            console.error(error);
        }
    };

    const getWalletName = (walletId) => {
        if (!walletId) return '-';
        const w = wallets.find(w => String(w.id) === String(walletId));
        return w ? w.name : '-';
    };

    const getCategoryBadge = (cat) => {
        if (cat === 'stock') return { label: 'مخزون / استوك', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'fa-boxes-stacked' };
        return { label: 'يومي / تشغيلي', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'fa-clock' };
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20 font-sans text-slate-800">

            {/* ── Date filter banner ── */}
            {dateFilter && (
                <div className="bg-indigo-600 text-white rounded-2xl px-5 py-3 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <i className="fa-solid fa-calendar-day text-indigo-200"></i>
                        تصفية بتاريخ:
                        <span className="bg-white/20 px-2 py-0.5 rounded-lg font-mono">
                            {new Date(dateFilter).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                    </div>
                    <button onClick={() => setDateFilter('')} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1">
                        <i className="fa-solid fa-xmark"></i> إلغاء الفلترة
                    </button>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* إجمالي المصروفات */}
                <div className="bg-gradient-to-br from-rose-600 to-pink-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute -left-4 -bottom-4 text-7xl opacity-10"><i className="fa-solid fa-money-bill-transfer"></i></div>
                    <p className="text-rose-200 text-xs font-bold mb-1">{dateFilter ? 'مصروفات اليوم' : 'إجمالي المصروفات'}</p>
                    <h3 className="text-2xl font-extrabold dir-ltr">{stats.totalAll.toLocaleString()} <span className="text-sm opacity-70">ج.م</span></h3>
                    {stats.totalSalary > 0 && <p className="text-[10px] text-rose-200 mt-1">منها رواتب: {stats.totalSalary.toLocaleString()} ج.م</p>}
                </div>

                {/* مصروفات يومية */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                    <p className="text-slate-500 text-xs font-bold mb-1 flex items-center gap-1"><i className="fa-solid fa-clock text-amber-500"></i> مصروفات يومية</p>
                    <h3 className="text-2xl font-extrabold text-amber-600 dir-ltr">{stats.totalDaily.toLocaleString()} <span className="text-sm text-amber-400">ج.م</span></h3>
                </div>

                {/* مصروفات مخزون */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                    <p className="text-slate-500 text-xs font-bold mb-1 flex items-center gap-1"><i className="fa-solid fa-boxes-stacked text-purple-500"></i> مخزون + رواتب</p>
                    <h3 className="text-2xl font-extrabold text-purple-600 dir-ltr">{(stats.totalStock + stats.totalSalary).toLocaleString()} <span className="text-sm text-purple-400">ج.م</span></h3>
                    {stats.totalSalary > 0 && <p className="text-[10px] text-purple-400 mt-0.5">رواتب: {stats.totalSalary.toLocaleString()}</p>}
                </div>

                {/* صافي الربح */}
                <div className={`rounded-2xl p-5 shadow-lg relative overflow-hidden ${stats.todayProfit >= 0 ? 'bg-gradient-to-br from-emerald-600 to-green-700 text-white' : 'bg-gradient-to-br from-red-600 to-red-800 text-white'}`}>
                    <div className="absolute -left-4 -bottom-4 text-7xl opacity-10"><i className="fa-solid fa-chart-line"></i></div>
                    <p className={`text-xs font-bold mb-1 ${stats.todayProfit >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>{dateFilter ? 'صافي ربح اليوم المحدد' : 'صافي ربح اليوم'}</p>
                    <h3 className="text-2xl font-extrabold dir-ltr">{stats.todayProfit.toLocaleString()} <span className="text-sm opacity-70">ج.م</span></h3>
                    <p className="text-[10px] opacity-80 font-bold mt-1">إيرادات ({stats.todayRevenue.toLocaleString()}) — مصروفات ({stats.todayDailyTotal.toLocaleString()})</p>
                </div>
            </div>

            {/* Header + Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-800">سجل المصروفات</h2>
                    <p className="text-slate-500 text-xs font-medium mt-0.5">متابعة دقيقة للمصروفات التشغيلية والمخزون</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                    {/* Date picker */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
                        <i className="fa-solid fa-calendar text-slate-400 text-xs px-1"></i>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={e => setDateFilter(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none"
                        />
                        {dateFilter && (
                            <button onClick={() => setDateFilter('')} className="text-slate-400 hover:text-rose-500 transition px-1">
                                <i className="fa-solid fa-xmark text-xs"></i>
                            </button>
                        )}
                    </div>
                    {/* Category Filter */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        {[
                            { id: 'all', label: 'الكل', icon: 'fa-layer-group' },
                            { id: 'daily', label: 'يومي', icon: 'fa-clock' },
                            { id: 'stock', label: 'مخزون', icon: 'fa-boxes-stacked' },
                            { id: 'salary', label: 'رواتب', icon: 'fa-users' },
                        ].map(f => (
                            <button key={f.id} onClick={() => setCategoryFilter(f.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${categoryFilter === f.id ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500 hover:bg-white/50'}`}>
                                <i className={`fa-solid ${f.icon} text-[10px]`}></i>{f.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setShowAddModal(true)} className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all flex items-center gap-2 text-sm">
                        <i className="fa-solid fa-plus"></i> إضافة مصروف
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-right whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-xs tracking-wider">
                            <tr>
                                <th className="p-5">التاريخ</th>
                                <th className="p-5">التصنيف</th>
                                <th className="p-5">النوع</th>
                                <th className="p-5">المحفظة</th>
                                <th className="p-5">الوصف</th>
                                <th className="p-5 text-left pl-8">المبلغ</th>
                                <th className="p-5 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredExpenses.length === 0 ? (
                                <tr><td colSpan="7" className="p-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-xl m-4 block">لا توجد مصروفات مسجلة</td></tr>
                            ) : (
                                filteredExpenses.map(exp => {
                                    const catBadge = getCategoryBadge(exp.expenseCategory);
                                    return (
                                        <tr key={exp.id} className="hover:bg-slate-50/80 transition duration-150 group">
                                            <td className="p-5 font-mono text-slate-500 font-bold text-xs">{new Date(exp.date).toLocaleDateString('en-GB')}</td>
                                            <td className="p-5">
                                                <span className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 w-fit ${catBadge.color}`}>
                                                    <i className={`fa-solid ${catBadge.icon} text-[10px]`}></i>{catBadge.label}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200">{exp.type}</span>
                                            </td>
                                            <td className="p-5">
                                                {(exp.walletId || exp.wallet_id) ? (
                                                    <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-200">
                                                        <i className="fa-solid fa-wallet ml-1 text-[10px]"></i>{exp.walletName || exp.wallet_name || getWalletName(exp.walletId || exp.wallet_id)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="p-5 text-slate-600 font-medium max-w-xs truncate">{exp.description || '-'}</td>
                                            <td className="p-5 text-left pl-8 font-black text-rose-600 dir-ltr text-base">-{Number(exp.amount).toLocaleString()} <span className="text-xs text-rose-400 font-bold">EGP</span></td>
                                            <td className="p-5 text-center flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                <button onClick={() => setEditingExpense(exp)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2.5 rounded-xl transition border border-blue-100 shadow-sm" title="تعديل"><i className="fa-solid fa-pen"></i></button>
                                                <button onClick={() => handleDelete(exp.id)} className="text-rose-600 bg-rose-50 hover:bg-rose-100 p-2.5 rounded-xl transition border border-rose-100 shadow-sm" title="حذف"><i className="fa-solid fa-trash"></i></button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-6 bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md">
                            <h3 className="text-xl font-bold flex items-center gap-2"><i className="fa-solid fa-money-bill-transfer"></i> تسجيل مصروف</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition"><i className="fa-solid fa-xmark text-lg"></i></button>
                        </div>
                        <div className="p-8 bg-slate-50/50">
                            <form onSubmit={handleAddExpense} className="space-y-5">

                                {/* تصنيف المصروف */}
                                <div>
                                    <label className="label-style">تصنيف المصروف</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 cursor-pointer transition-all has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50 border-slate-200 hover:border-amber-200 text-center">
                                            <input type="radio" name="expenseCategory" value="daily" defaultChecked className="hidden" />
                                            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-xl"><i className="fa-solid fa-clock"></i></div>
                                            <span className="text-sm font-extrabold text-slate-700">يومي / تشغيلي</span>
                                            <span className="text-[10px] text-slate-400 font-medium">إعلانات - اشتراكات - رواتب</span>
                                        </label>
                                        <label className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 cursor-pointer transition-all has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50 border-slate-200 hover:border-purple-200 text-center">
                                            <input type="radio" name="expenseCategory" value="stock" className="hidden" />
                                            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-xl"><i className="fa-solid fa-boxes-stacked"></i></div>
                                            <span className="text-sm font-extrabold text-slate-700">مخزون / استوك</span>
                                            <span className="text-[10px] text-slate-400 font-medium">شراء حسابات - أكواد</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="label-style">نوع المصروف</label>
                                    <div className="relative">
                                        <select name="type" className="input-style appearance-none" required>
                                            <option value="">اختر النوع...</option>
                                            <option value="إعلان">إعلان (Ads)</option>
                                            <option value="اشتراكات تطبيقات">أدوات واشتراكات</option>
                                            <option value="رواتب">رواتب</option>
                                            <option value="شراء استوك">شراء استوك / حسابات</option>
                                            <option value="شراء أكواد">شراء أكواد</option>
                                            <option value="مصاريف أخرى">نثريات / أخرى</option>
                                        </select>
                                        <i className="fa-solid fa-chevron-down absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                                    </div>
                                </div>

                                {/* اختيار المحفظة */}
                                <div>
                                    <label className="label-style">وسيلة الدفع (المحفظة)</label>
                                    <div className="relative">
                                        <select name="walletId" className="input-style appearance-none">
                                            <option value="">بدون محفظة (يدوي)</option>
                                            {wallets.map(w => (
                                                <option key={w.id} value={w.id}>{w.name} — (رصيد: {Number(w.balance).toLocaleString()} {w.currency || 'EGP'})</option>
                                            ))}
                                        </select>
                                        <i className="fa-solid fa-wallet absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none"></i>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="label-style">المبلغ</label>
                                        <div className="relative">
                                            <input type="number" step="0.01" name="amount" className="input-style pl-12 text-rose-600" placeholder="0.00" required />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">EGP</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label-style">التاريخ</label>
                                        <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="input-style" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-style">الوصف (اختياري)</label>
                                    <textarea name="description" className="input-style h-24 resize-none" placeholder="تفاصيل إضافية..."></textarea>
                                </div>
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                    <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-white border-2 border-slate-200 hover:bg-slate-100 transition shadow-sm">إلغاء</button>
                                    <button type="submit" className="bg-rose-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 transition hover:-translate-y-0.5">حفظ</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingExpense && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-6 bg-white border-b border-slate-100">
                            <h3 className="text-xl font-extrabold text-slate-800">تعديل المصروف</h3>
                            <button onClick={() => setEditingExpense(null)} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full transition"><i className="fa-solid fa-xmark text-lg"></i></button>
                        </div>
                        <div className="p-8 bg-slate-50/50">
                            <form onSubmit={handleUpdateExpense} className="space-y-5">
                                {/* تصنيف المصروف */}
                                <div>
                                    <label className="label-style">تصنيف المصروف</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 cursor-pointer transition-all has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50 border-slate-200 hover:border-amber-200 text-center">
                                            <input type="radio" name="expenseCategory" value="daily" defaultChecked={(editingExpense.expenseCategory || 'daily') === 'daily'} className="hidden" />
                                            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-lg"><i className="fa-solid fa-clock"></i></div>
                                            <span className="text-xs font-extrabold text-slate-700">يومي / تشغيلي</span>
                                        </label>
                                        <label className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 cursor-pointer transition-all has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50 border-slate-200 hover:border-purple-200 text-center">
                                            <input type="radio" name="expenseCategory" value="stock" defaultChecked={editingExpense.expenseCategory === 'stock'} className="hidden" />
                                            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-lg"><i className="fa-solid fa-boxes-stacked"></i></div>
                                            <span className="text-xs font-extrabold text-slate-700">مخزون / استوك</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="label-style">نوع المصروف</label>
                                    <div className="relative">
                                        <select name="type" defaultValue={editingExpense.type} className="input-style appearance-none" required>
                                            <option value="إعلان">إعلان (Ads)</option>
                                            <option value="اشتراكات تطبيقات">أدوات واشتراكات</option>
                                            <option value="رواتب">رواتب</option>
                                            <option value="شراء استوك">شراء استوك / حسابات</option>
                                            <option value="شراء أكواد">شراء أكواد</option>
                                            <option value="مصاريف أخرى">نثريات / أخرى</option>
                                        </select>
                                        <i className="fa-solid fa-chevron-down absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="label-style">المبلغ</label>
                                        <div className="relative">
                                            <input type="number" step="0.01" name="amount" defaultValue={editingExpense.amount} className="input-style pl-12 text-rose-600" required />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">EGP</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label-style">التاريخ</label>
                                        <input type="date" name="date" defaultValue={editingExpense.date ? editingExpense.date.split(' ')[0] : ''} className="input-style" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-style">الوصف</label>
                                    <textarea name="description" defaultValue={editingExpense.description} className="input-style h-24 resize-none"></textarea>
                                </div>
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                    <button type="button" onClick={() => setEditingExpense(null)} className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-white border-2 border-slate-200 hover:bg-slate-100 transition shadow-sm">إلغاء</button>
                                    <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition hover:-translate-y-0.5">حفظ التعديلات</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .label-style { @apply block text-sm font-extrabold text-slate-800 mb-2 ml-1 tracking-wide; }
                .input-style { @apply w-full bg-white border-2 border-slate-300 text-slate-900 text-sm font-bold rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 block p-3.5 transition-all outline-none placeholder-slate-400 shadow-sm; }
                .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}
            </style>
        </div>
    );
}