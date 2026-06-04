import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { problemsAPI } from '../services/api';
import { useConfirm } from './ConfirmDialog';
import { useLang } from '../i18n/index';

export default function Problems () {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const { user } = useAuth();
    const { problems, sales, accounts, refreshData, renewalTarget, setRenewalTarget } = useData();
    const currentUser = user?.username || 'Admin';
    const { t } = useLang();

    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | open | resolved

    // State للقيم داخل المودال
    const [selectedSaleId, setSelectedSaleId] = useState('');
    const [replacementAccountId, setReplacementAccountId] = useState('');
    const [description, setDescription] = useState('');
    const { showConfirm, showAlert } = useConfirm();
    const [copiedPhone, setCopiedPhone]   = useState(null);
    const [saleSearch, setSaleSearch]     = useState('');   // بحث سريع في قائمة الأوردرات

    // الاستماع للبيانات القادمة من صفحة العملاء
    useEffect(() => {
        if (renewalTarget && renewalTarget.isProblemRequest) {
            setSelectedSaleId(renewalTarget.id);
            setShowModal(true);
            setRenewalTarget(null);
        }
    }, [renewalTarget]);

    // Stats
    const stats = useMemo(() => {
        const total = (problems || []).length;
        const open = (problems || []).filter(p => !p.isResolved).length;
        const resolved = (problems || []).filter(p => p.isResolved).length;
        return { total, open, resolved };
    }, [problems]);

    // دالة لفلترة المشاكل للعرض
    const filteredProblems = useMemo(() => {
        return (problems || []).filter(p => {
            const matchSearch =
                (p.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.customerName && p.customerName.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchStatus =
                statusFilter === 'all' ||
                (statusFilter === 'open' && !p.isResolved) ||
                (statusFilter === 'resolved' && p.isResolved);
            return matchSearch && matchStatus;
        });
    }, [problems, searchTerm, statusFilter]);

    // دالة لحفظ المشكلة
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedSaleId) { await showAlert({ title: 'خطأ', message: 'يجب اختيار الأوردر', type: 'warning' }); return; }
        if (!description) { await showAlert({ title: 'خطأ', message: 'يجب كتابة وصف للمشكلة', type: 'warning' }); return; }

        const sale = sales.find(s => s.id == selectedSaleId);

        try {
            await problemsAPI.create({
                saleId: selectedSaleId,
                customerName: sale?.customerName || '',
                phoneNumber: sale?.customerPhone || '',
                productName: sale?.productName || '',
                description,
                replacementAccountId: replacementAccountId || null,
                actionBy: currentUser,
            });

            await showAlert({ title: 'تم بنجاح', message: 'تم تسجيل المشكلة بنجاح ✅', type: 'success' });
            setShowModal(false);
            setSelectedSaleId('');
            setReplacementAccountId('');
            setDescription('');
            setSaleSearch('');
            refreshData();
        } catch (error) {
            console.error(error);
            await showAlert({ title: 'خطأ!', message: 'حدث خطأ أثناء التسجيل', type: 'danger' });
        }
    };

    // حذف مشكلة
    const handleDelete = async (id) => {
        const confirmed = await showConfirm({
            title: 'حذف المشكلة',
            message: 'هل أنت متأكد من حذف هذه المشكلة نهائياً؟',
            confirmText: 'حذف',
            cancelText: 'إلغاء',
            type: 'danger'
        });
        if (!confirmed) return;
        try {
            await problemsAPI.delete(id);
            refreshData();
        } catch (error) {
            console.error(error);
            await showAlert({ title: 'خطأ!', message: 'حدث خطأ أثناء الحذف', type: 'danger' });
        }
    };

    // تعليم المشكلة كمحلولة
    const handleResolve = async (id) => {
        const confirmed = await showConfirm({
            title: 'تأكيد الحل',
            message: 'هل أنت متأكد من تعليم المشكلة كـ \'تم الحل\'\u061f',
            confirmText: 'تم الحل',
            cancelText: 'إلغاء',
            type: 'success'
        });
        if (!confirmed) return;
        try {
            const prob = problems.find(p => p.id === id);
            await problemsAPI.markResolved(id, prob ? { customerName: prob.customerName, description: prob.description, actionBy: currentUser } : null);
            refreshData();
        } catch (error) {
            console.error(error);
            await showAlert({ title: 'خطأ!', message: 'حدث خطأ', type: 'danger' });
        }
    };

    // قائمة الأوردرات مرتبة مرة واحدة فقط (memoized) — تمنع إعادة الترتيب في كل render
    const sortedSales = useMemo(
        () => [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)),
        [sales]
    );

    // تصفية الأوردرات بناءً على نص البحث — تحد الـ render من 1000+ خيار لأقل من 100
    const filteredSaleOptions = useMemo(() => {
        const q = saleSearch.trim().toLowerCase();
        if (!q) return sortedSales.slice(0, 100); // عرض أحدث 100 فقط لو مفيش بحث
        return sortedSales
            .filter(s =>
                (s.customerName || '').toLowerCase().includes(q) ||
                (s.productName  || '').toLowerCase().includes(q) ||
                (s.customerEmail || '').toLowerCase().includes(q)
            )
            .slice(0, 100);
    }, [sortedSales, saleSearch]);

    // دالة لجلب تفاصيل الأوردر المختار عشان نعرف المنتج ونعرض بدائل مناسبة
    const selectedSaleDetails = useMemo(() => {
        return sales.find(s => s.id == selectedSaleId);
    }, [selectedSaleId, sales]);

    // تنسيق رقم الهاتف لـ WhatsApp — يحول 010XXXXXXXX لـ 20010XXXXXXXX
    const formatPhoneWA = (phone) => {
        if (!phone) return '';
        const digits = String(phone).replace(/\D/g, '');
        if (digits.startsWith('20')) return digits;
        if (digits.startsWith('0'))  return '2' + digits;
        return digits;
    };

    const handleCopyPhone = (id, phone) => {
        navigator.clipboard.writeText(phone);
        setCopiedPhone(id);
        setTimeout(() => setCopiedPhone(null), 1500);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20 font-sans text-slate-800">

            {/* Header */}
            <div className="ph-bar">
                <div className="flex items-center gap-3">
                    <div className="ph-icon" style={{backgroundColor:'#dc2626'}}><i className="fa-solid fa-triangle-exclamation text-sm"></i></div>
                    <div>
                        <h1 className="ph-title">{t('problems_title')}</h1>
                        <p className="ph-sub">{t('problems_subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="stat-card-pill pill-red">{stats.total}</span>
                    <span className="stat-card-pill pill-amber">{stats.open} {t('problems_filter_open')}</span>
                    <span className="stat-card-pill pill-green">{stats.resolved} {t('problems_filter_resolved')}</span>
                    <button onClick={() => { setSelectedSaleId(''); setReplacementAccountId(''); setDescription(''); setShowModal(true); }} className="btn-d text-xs">
                        <i className="fa-solid fa-plus"></i> {t('problems_new_btn')}
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="ds-toolbar flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <i className="fa-solid fa-search absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input type="text" placeholder={t('problems_search_ph')} className="ds-inp pr-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    {[
                        { id: 'all',      label: t('problems_filter_all'),      count: stats.total },
                        { id: 'open',     label: t('problems_filter_open'),     count: stats.open },
                        { id: 'resolved', label: t('problems_filter_resolved'), count: stats.resolved },
                    ].map(f => (
                        <button key={f.id} onClick={() => setStatusFilter(f.id)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${statusFilter === f.id ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {f.label}
                            <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded-full font-bold">{f.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Problems Grid */}
            <div className="grid gap-4">
                {filteredProblems.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                        <i className="fa-solid fa-check-circle text-4xl mb-4 opacity-50 text-emerald-500"></i>
                        <p className="font-bold">{t('problems_no_problems')}</p>
                    </div>
                ) : (
                    filteredProblems.map(prob => (
                        <div key={prob.id} className={`bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all relative overflow-hidden group ${prob.isResolved ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                            <div className={`absolute right-0 top-0 bottom-0 w-1.5 ${prob.isResolved ? 'bg-emerald-500' : 'bg-red-500'}`}></div>

                            <div className="flex flex-col md:flex-row justify-between items-start gap-4 pl-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h4 className="font-bold text-lg text-slate-800">{prob.customerName || 'عميل غير معروف'}</h4>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 font-mono">{prob.phoneNumber}</span>
                                            {prob.phoneNumber && (<>
                                                <a href={`https://wa.me/${formatPhoneWA(prob.phoneNumber)}`} target="_blank" rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 border border-green-200 transition flex-shrink-0"
                                                    title="واتساب">
                                                    <i className="fa-brands fa-whatsapp text-[9px]"></i>
                                                </a>
                                                <a href={`tel:${prob.phoneNumber}`}
                                                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 border border-blue-200 transition flex-shrink-0"
                                                    title="اتصال">
                                                    <i className="fa-solid fa-phone text-[9px]"></i>
                                                </a>
                                                <button type="button"
                                                    onClick={() => handleCopyPhone(prob.id, prob.phoneNumber)}
                                                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 transition flex-shrink-0"
                                                    title="نسخ الرقم">
                                                    <i className={`fa-solid ${copiedPhone === prob.id ? 'fa-check text-emerald-500' : 'fa-copy'} text-[9px]`}></i>
                                                </button>
                                            </>)}
                                        </div>
                                        {prob.isResolved ? (
                                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-1">
                                                <i className="fa-solid fa-check-circle text-[8px]"></i> {t('problems_status_resolved')}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full font-bold border border-orange-200 flex items-center gap-1">
                                                <i className="fa-solid fa-clock text-[8px]"></i> {t('problems_filter_open')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500 font-medium mb-2 flex items-center gap-2">
                                        <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100 text-xs font-bold">{prob.productName}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="font-mono text-xs">{new Date(prob.created_at || prob.date).toLocaleDateString('ar-EG')}</span>
                                        {prob.isResolved && prob.resolvedAt && (
                                            <>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-[10px] text-emerald-600 font-bold">حُلت: {new Date(prob.resolvedAt).toLocaleDateString('ar-EG')}</span>
                                            </>
                                        )}
                                    </p>
                                    <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm leading-relaxed max-w-2xl">
                                        {prob.description}
                                    </p>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex md:flex-col gap-2 flex-shrink-0">
                                    {!prob.isResolved && (
                                        <button onClick={() => handleResolve(prob.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all shadow-sm"
                                            title="تعليم كمحلولة">
                                            <i className="fa-solid fa-check-circle"></i>
                                            <span className="hidden md:inline">{t('problems_resolve_btn')}</span>
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(prob.id)}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold text-xs hover:bg-red-100 transition-all shadow-sm"
                                        title="حذف">
                                        <i className="fa-solid fa-trash"></i>
                                        <span className="hidden md:inline">{t('btn_delete')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showModal && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" style={{direction:'rtl',fontFamily:'Cairo,sans-serif'}}>
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 bg-gradient-to-r from-red-600 to-rose-600 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <i className="fa-solid fa-triangle-exclamation"></i> {t('problems_add_title')}
                            </h3>
                            <button onClick={() => { setShowModal(false); setSaleSearch(''); }} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"><i className="fa-solid fa-xmark text-lg"></i></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-5 overflow-y-auto custom-scrollbar">

                            {/* 1. اختيار الأوردر */}
                            <div>
                                <label className="block text-sm font-extrabold text-slate-800 mb-2 ml-1">الأوردر المتضرر</label>
                                {/* حقل بحث سريع — يرسم فقط الـ 100 نتيجة الأولى */}
                                <div className="relative mb-2">
                                    <i className="fa-solid fa-magnifying-glass absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                                    <input
                                        type="text"
                                        placeholder="ابحث بالاسم أو المنتج..."
                                        value={saleSearch}
                                        onChange={e => setSaleSearch(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-200 text-slate-800 text-sm font-bold rounded-xl focus:ring-4 focus:ring-red-100 focus:border-red-400 block pr-9 p-3 transition-all outline-none"
                                    />
                                    {saleSearch && (
                                        <button type="button" onClick={() => setSaleSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            <i className="fa-solid fa-xmark text-xs"></i>
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <select
                                        className="w-full bg-white border-2 border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-4 focus:ring-red-100 focus:border-red-500 block p-3.5 transition-all outline-none appearance-none"
                                        value={selectedSaleId}
                                        onChange={(e) => setSelectedSaleId(e.target.value)}
                                        required
                                        size={Math.min(filteredSaleOptions.length + 1, 6)}
                                    >
                                        <option value="">-- اختر الأوردر --</option>
                                        {filteredSaleOptions.map(sale => (
                                            <option key={sale.id} value={sale.id}>
                                                {sale.customerName} — {sale.productName} ({new Date(sale.date).toLocaleDateString('en-GB')})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {saleSearch && filteredSaleOptions.length === 0 && (
                                    <p className="text-xs text-slate-400 mt-1.5 text-center">لا توجد نتائج</p>
                                )}
                                {!saleSearch && sales.length > 100 && (
                                    <p className="text-[10px] text-slate-400 mt-1 text-left">يعرض أحدث 100 أوردر — ابحث للعثور على المزيد</p>
                                )}
                            </div>

                            {/* 2. اختيار التعويض */}
                            {selectedSaleId && (
                                <div className="animate-fade-in">
                                    <label className="block text-sm font-extrabold text-slate-800 mb-2 ml-1">
                                        تعويض بحساب جديد <span className="text-slate-400 font-normal text-xs">(اختياري)</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-slate-50 border-2 border-slate-200 text-slate-700 text-sm font-bold rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 block p-3.5 transition-all outline-none appearance-none"
                                            value={replacementAccountId}
                                            onChange={(e) => setReplacementAccountId(e.target.value)}
                                        >
                                            <option value="">-- بدون تعويض (تسجيل المشكلة فقط) --</option>
                                            {accounts
                                                .filter(a => {
                                                    const isMatchingProduct = a.productName === selectedSaleDetails?.productName;
                                                    const isAvailable = a.status === 'available';
                                                    const isExpired = a.expiry_date && new Date(a.expiry_date) < new Date();
                                                    const isLimitReached = a.allowed_uses != -1 && Number(a.current_uses) >= Number(a.allowed_uses);
                                                    return isMatchingProduct && isAvailable && !isExpired && !isLimitReached;
                                                })
                                                .map(a => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.email} (متبقي: {a.allowed_uses == -1 ? '∞' : a.allowed_uses - a.current_uses})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                        <i className="fa-solid fa-gift absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                                    </div>
                                    {replacementAccountId && (
                                        <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1">
                                            <i className="fa-solid fa-check-circle"></i> سيتم إرسال هذا الحساب للعميل وحرق القديم.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* 3. الوصف */}
                            <div>
                                <label className="block text-sm font-extrabold text-slate-800 mb-2 ml-1">تفاصيل المشكلة</label>
                                <textarea
                                    className="w-full bg-white border-2 border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-4 focus:ring-red-100 focus:border-red-500 block p-3.5 transition-all outline-none h-32 resize-none"
                                    placeholder="اكتب وصف المشكلة هنا..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    required
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition hover:-translate-y-0.5 flex justify-center items-center gap-2"
                            >
                                <i className="fa-solid fa-paper-plane"></i> {t('btn_save')}
                            </button>
                        </form>
                    </div>
                </div>
            , document.body)}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}
            </style>
        </div>
    );
}

