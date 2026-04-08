import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { accountsAPI, sectionsAPI } from '../services/api';

export default function Accounts() {
    const { user } = useAuth();
    const { products, accounts: ctxAccounts, sections: ctxSections, refreshData } = useData();

    const [accounts, setAccounts] = useState([]);
    const [sections, setSections] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [isBulkAdd, setIsBulkAdd] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [copiedId, setCopiedId] = useState(null);
    const [visibleCount, setVisibleCount] = useState(20);
    const [pulledResult, setPulledResult] = useState(null);
    const [selectedSection, setSelectedSection] = useState(null);

    useEffect(() => { window.scrollTo(0, 0); }, []);

    // Sync from context
    useEffect(() => {
        setAccounts(ctxAccounts);
        setSections(ctxSections);
    }, [ctxAccounts, ctxSections]);

    // Current section object
    const currentSection = useMemo(() => sections.find(s => s.id === selectedSection), [sections, selectedSection]);

    // Stats
    const sectionAccounts = useMemo(() => {
        if (!currentSection) return accounts;
        return accounts.filter(a => a.productName === currentSection.name);
    }, [accounts, currentSection]);

    const accountStats = useMemo(() => ({
        total: sectionAccounts.length,
        available: sectionAccounts.filter(a => a.status === 'available').length,
        used: sectionAccounts.filter(a => a.status === 'used').length,
        full: sectionAccounts.filter(a => a.status === 'completed').length,
    }), [sectionAccounts]);

    // Filtered
    const filteredAccounts = useMemo(() => {
        return sectionAccounts.filter(acc => {
            const matchStatus = filterStatus === 'all' || acc.status === filterStatus;
            const term = searchTerm.toLowerCase();
            const matchSearch = !term ||
                (acc.email && acc.email.toLowerCase().includes(term)) ||
                (acc.password && acc.password.toLowerCase().includes(term));
            return matchStatus && matchSearch;
        }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }, [sectionAccounts, filterStatus, searchTerm]);

    // Section counts
    const sectionCounts = useMemo(() => {
        const c = {};
        accounts.forEach(a => { c[a.productName] = (c[a.productName] || 0) + 1; });
        return c;
    }, [accounts]);

    // Which products link to which section
    const linkedProductsMap = useMemo(() => {
        const map = {};
        products.forEach(p => {
            if (p.inventoryProduct && p.fulfillmentType === 'from_stock') {
                if (!map[p.inventoryProduct]) map[p.inventoryProduct] = [];
                map[p.inventoryProduct].push(p.name);
            }
        });
        return map;
    }, [products]);

    // ========= Section CRUD =========
    const handleCreateSection = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const name = fd.get('sectionName')?.trim();
        const type = fd.get('sectionType');
        if (!name) return;
        if (sections.find(s => s.name === name)) { alert('يوجد سجل بنفس الاسم بالفعل!'); return; }
        try {
            await sectionsAPI.create({ name, type });
            setShowSectionModal(false);
            await refreshData();
        } catch (error) {
            console.error(error);
            alert('حدث خطأ');
        }
    };

    const deleteSection = async (sec) => {
        if (!confirm(`حذف قسم "${sec.name}" وجميع محتوياته (${sectionCounts[sec.name] || 0} عنصر)؟`)) return;
        try {
            await sectionsAPI.delete(sec.id, sec.name);
            if (selectedSection === sec.id) setSelectedSection(null);
            await refreshData();
        } catch (error) {
            console.error(error);
        }
    };

    // ========= Account CRUD =========
    const handleAddAccount = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const productName = currentSection.name;
        const allowedUses = Number(fd.get('allowedUses') || 1);
        const isWorkspace = fd.get('isWorkspace') === 'on';
        const workspaceMembers = isWorkspace ? Number(fd.get('workspaceMembers') || 5) : 0;

        try {
            if (isBulkAdd) {
                const bulkData = fd.get('bulkData')?.trim();
                if (!bulkData) return;
                const rows = bulkData.split('\n').map(l => l.trim()).filter(l => l).map(line => {
                    let email = line, password = '';
                    if (line.includes(':')) [email, password] = line.split(':');
                    else if (line.includes('|')) [email, password] = line.split('|');
                    return { email: email.trim(), password: password ? password.trim() : '', twoFA: '', productName, allowed_uses: isWorkspace ? workspaceMembers : allowedUses, createdBy: user?.username || 'Admin', isWorkspace, workspaceMembers };
                });
                await accountsAPI.createBulk(rows);
            } else {
                const email = fd.get('email')?.trim();
                if (!email) return;
                await accountsAPI.create({ email, password: fd.get('password')?.trim() || '', twoFA: fd.get('twoFA')?.trim() || '', productName, allowed_uses: isWorkspace ? workspaceMembers : allowedUses, createdBy: user?.username || 'Admin', isWorkspace, workspaceMembers });
            }
            setShowAddModal(false);
            setIsBulkAdd(false);
            await refreshData();
        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء الإضافة');
        }
    };

    const handleEditAccount = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const newStatus = fd.get('status');
        const isWorkspace = fd.get('isWorkspace') === 'on';
        try {
            await accountsAPI.update(editingAccount.id, {
                email: fd.get('email').trim(),
                password: fd.get('password')?.trim() || '',
                twoFA: fd.get('twoFA')?.trim() || '',
                status: newStatus,
                allowed_uses: Number(fd.get('allowedUses') || 1),
                current_uses: newStatus === 'available' ? 0 : Number(fd.get('currentUses') || editingAccount.current_uses),
                isWorkspace: isWorkspace,
                workspaceMembers: isWorkspace ? Number(fd.get('workspaceMembers') || 5) : 0,
            });
            setEditingAccount(null);
            await refreshData();
        } catch (error) {
            console.error(error);
        }
    };

    const deleteAccount = async (id) => {
        if (!confirm('حذف هذا العنصر؟')) return;
        try {
            await accountsAPI.delete(id);
            await refreshData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleManualPull = async (acc) => {
        if (acc.status === 'completed' || acc.status === 'damaged') return;
        try {
            const newUses = (acc.current_uses || 0) + 1;
            const newStatus = (acc.allowed_uses !== -1 && newUses >= acc.allowed_uses) ? 'completed' : 'used';
            await accountsAPI.update(acc.id, { current_uses: newUses, status: newStatus });
            
            let t = `البيانات: ${acc.email}`;
            if (acc.password) t += `\nالباسورد: ${acc.password}`;
            if (acc.twoFA) t += `\n2FA: ${acc.twoFA}`;
            navigator.clipboard.writeText(t);
            setCopiedId(`pull-${acc.id}`);
            setTimeout(() => setCopiedId(null), 1500);
            await refreshData();
        } catch (error) {
            console.error(error);
        }
    };

    const handlePullNext = async () => {
        if (!currentSection) return;
        try {
            const result = await accountsAPI.pullNext(currentSection.name);
            if (result.empty) {
                setPulledResult({ empty: true });
            } else {
                let txt = result.email;
                if (result.password) txt += `\n${result.password}`;
                if (result.twoFA || result.two_fa) txt += `\n${result.twoFA || result.two_fa}`;
                navigator.clipboard.writeText(txt);
                setPulledResult(result);
                await refreshData();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const copyToClipboard = (text, id) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); };

    const getStatusInfo = (s) => {
        const map = {
            available: { label: 'متاح', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: 'fa-check-circle' },
            used: { label: 'مستخدم', color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500', icon: 'fa-circle-dot' },
            completed: { label: 'مكتمل', color: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400', icon: 'fa-circle-check' },
            damaged: { label: 'تالف', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', icon: 'fa-circle-xmark' },
        };
        return map[s] || map.available;
    };

    const isCodesSection = currentSection?.type === 'codes';

    return (
        <div className="space-y-6 animate-fade-in pb-24 font-sans text-slate-800">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
                    <p className="text-purple-200 text-sm font-bold mb-1">إجمالي العناصر</p>
                    <h3 className="text-3xl font-extrabold">{accountStats.total}</h3>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-bold mb-1">متاح</p>
                    <h3 className="text-3xl font-extrabold text-emerald-600">{accountStats.available}</h3>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-bold mb-1">مستخدم</p>
                    <h3 className="text-3xl font-extrabold text-orange-600">{accountStats.used}</h3>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-bold mb-1">مكتمل</p>
                    <h3 className="text-3xl font-extrabold text-slate-400">{accountStats.full}</h3>
                </div>
            </div>

            {/* ===== OVERVIEW or DETAIL ===== */}
            {!selectedSection ? (
                <>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-xl font-black text-slate-800 flex items-center gap-2"><i className="fa-solid fa-layer-group text-indigo-600"></i> أقسام المخزون</div>
                        <button onClick={() => setShowSectionModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm px-6 py-2.5 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 w-full md:w-auto">
                            <i className="fa-solid fa-plus"></i> إنشاء سجل جديد
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {sections.map(sec => {
                            const count = sectionCounts[sec.name] || 0;
                            const avail = accounts.filter(a => a.productName === sec.name && a.status === 'available').length;
                            const linkedProds = linkedProductsMap[sec.name] || [];
                            return (
                                <div key={sec.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 hover:-translate-y-1 transition-all cursor-pointer flex flex-col group relative">
                                    {/* Delete btn - always visible */}
                                    <button onClick={(e) => { e.stopPropagation(); deleteSection(sec); }} className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition z-10 border border-red-100" title="حذف القسم">
                                        <i className="fa-solid fa-trash text-xs"></i>
                                    </button>

                                    <div onClick={() => setSelectedSection(sec.id)} className="flex-1 flex flex-col">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-all shadow-sm ${sec.type === 'codes' ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                                                <i className={`fa-solid ${sec.type === 'codes' ? 'fa-key' : 'fa-user-shield'}`}></i>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-extrabold text-lg text-slate-800 truncate">{sec.name}</h4>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${sec.type === 'codes' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-indigo-50 text-indigo-600 border border-indigo-200'}`}>
                                                        {sec.type === 'codes' ? 'أكواد' : 'اكونتات'}
                                                    </span>
                                                    {linkedProds.length > 0 ? (
                                                        linkedProds.map(pn => (
                                                            <span key={pn} className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-600 border border-purple-200">
                                                                <i className="fa-solid fa-link text-[8px] ml-0.5"></i> {pn}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-50 text-slate-400 border border-slate-200">مستقل</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-sm font-bold text-slate-400 mb-4">{count} عنصر في المخزون</p>

                                        <div className="mt-auto flex flex-col gap-2">
                                            <div className="flex justify-between items-center text-xs font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                                <span>متاح للبيع:</span>
                                                <span className="text-emerald-600 text-sm">{avail}</span>
                                            </div>
                                            <button className="w-full mt-2 py-2.5 rounded-xl border-2 border-indigo-100 text-indigo-700 font-bold text-sm group-hover:bg-indigo-50 transition-colors">الدخول للسجل <i className="fa-solid fa-arrow-left mr-1"></i></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {sections.length === 0 && (
                            <div className="col-span-full py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 flex flex-col items-center">
                                <i className="fa-solid fa-boxes-stacked text-5xl mb-4 opacity-30"></i>
                                <p className="font-bold text-lg">المخزون فارغ تماماً</p>
                                <p className="text-sm mt-1">اضغط "إنشاء سجل جديد" لبدء تنظيم المخزون</p>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* Internal View Toolbar */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-2 z-30 bg-white/95 backdrop-blur-md">
                        <div className="flex items-center gap-3 w-full md:w-auto overflow-hidden">
                            <button onClick={() => { setSelectedSection(null); setSearchTerm(''); setFilterStatus('all'); setVisibleCount(20); }} className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors">
                                <i className="fa-solid fa-arrow-right"></i>
                            </button>
                            <div className="min-w-0">
                                <h2 className="text-lg font-black text-slate-800 truncate">{currentSection?.name}</h2>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${currentSection?.type === 'codes' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                    {currentSection?.type === 'codes' ? 'أكواد' : 'اكونتات'}
                                </span>
                            </div>
                        </div>
                        <div className="relative w-full md:w-80 border-t md:border-none pt-4 md:pt-0 border-slate-100">
                            <i className="fa-solid fa-search absolute right-3 md:top-1/2 md:-translate-y-1/2 top-7 text-slate-400"></i>
                            <input type="text" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold rounded-xl pr-10 p-3 outline-none focus:bg-white focus:border-indigo-400 transition-all placeholder-slate-400" placeholder="بحث بالبيانات..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <button onClick={handlePullNext} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full md:w-auto justify-center font-bold rounded-xl text-sm px-6 py-2.5 shadow-lg shadow-emerald-200 transition-all flex items-center gap-2">
                                <i className="fa-solid fa-bolt"></i> سحب التالي
                            </button>
                            <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full md:w-auto justify-center font-bold rounded-xl text-sm px-6 py-2.5 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
                                <i className="fa-solid fa-plus"></i> إضافة {isCodesSection ? 'أكواد' : 'بيانات'}
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto w-full md:w-auto scrollbar-hide">
                            {[{ id: 'all', label: 'الكل' }, { id: 'available', label: 'متاح' }, { id: 'used', label: 'مستخدم' }, { id: 'completed', label: 'مكتمل' }, { id: 'damaged', label: 'تالف' }].map(f => (
                                <button key={f.id} onClick={() => setFilterStatus(f.id)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none ${filterStatus === f.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{f.label}</button>
                            ))}
                        </div>
                    </div>

                    {/* Items List */}
                    {filteredAccounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                            <i className={`fa-solid ${isCodesSection ? 'fa-key' : 'fa-server'} text-5xl mb-4 opacity-30`}></i>
                            <p className="font-bold text-lg">لا توجد {isCodesSection ? 'أكواد' : 'بيانات'} هنا</p>
                            <p className="text-sm mt-1">اضغط "إضافة {isCodesSection ? 'أكواد' : 'بيانات'}" لتغذية سجل {currentSection?.name}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredAccounts.slice(0, visibleCount).map(acc => {
                                const st = getStatusInfo(acc.status);
                                return (
                                    <div key={acc.id} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all overflow-hidden relative">
                                        <div className={`absolute top-0 bottom-0 right-0 w-1.5 ${st.dot}`}></div>
                                        <div className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
                                            <div className="flex-1 pr-3 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${st.color}`}>
                                                        <i className={`fa-solid ${st.icon} text-[9px]`}></i> {st.label}
                                                    </span>
                                                    {acc.allowed_uses !== 1 && (
                                                        <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded font-bold border border-slate-100">
                                                            {acc.current_uses} / {acc.allowed_uses === -1 ? '∞' : acc.allowed_uses}
                                                        </span>
                                                    )}
                                                    {acc.isWorkspace && (
                                                        <span className="text-[10px] bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded font-bold border border-cyan-200 flex items-center gap-1">
                                                            <i className="fa-solid fa-users-rectangle text-[8px]"></i> Workspace
                                                            {acc.workspaceMembers > 0 && <span>({acc.current_uses}/{acc.workspaceMembers} شخص)</span>}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-slate-400 font-bold w-12 flex-shrink-0">{isCodesSection ? 'الكود' : 'البيانات'}</span>
                                                        <code className="text-sm font-mono font-bold text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all truncate flex-1" onClick={() => copyToClipboard(acc.email, `email-${acc.id}`)} title="اضغط للنسخ">{acc.email}</code>
                                                        <button onClick={() => copyToClipboard(acc.email, `email-${acc.id}`)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition flex-shrink-0">
                                                            <i className={`fa-solid ${copiedId === `email-${acc.id}` ? 'fa-check text-emerald-500' : 'fa-copy'} text-xs`}></i>
                                                        </button>
                                                    </div>
                                                    {acc.password && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-slate-400 font-bold w-12 flex-shrink-0">باسورد</span>
                                                            <code className="text-sm font-mono font-bold text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all truncate flex-1" onClick={() => copyToClipboard(acc.password, `pass-${acc.id}`)} title="اضغط للنسخ">{acc.password}</code>
                                                            <button onClick={() => copyToClipboard(acc.password, `pass-${acc.id}`)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition flex-shrink-0">
                                                                <i className={`fa-solid ${copiedId === `pass-${acc.id}` ? 'fa-check text-emerald-500' : 'fa-copy'} text-xs`}></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                    {acc.twoFA && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-slate-400 font-bold w-12 flex-shrink-0">2FA</span>
                                                            <code className="text-[11px] font-mono font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100 cursor-pointer hover:bg-purple-100 hover:border-purple-200 transition-all truncate flex-1" onClick={() => copyToClipboard(acc.twoFA, `2fa-${acc.id}`)} title="اضغط للنسخ">{acc.twoFA}</code>
                                                            <button onClick={() => copyToClipboard(acc.twoFA, `2fa-${acc.id}`)} className="w-8 h-8 flex items-center justify-center rounded-lg text-purple-300 hover:text-purple-600 hover:bg-purple-100 transition flex-shrink-0">
                                                                <i className={`fa-solid ${copiedId === `2fa-${acc.id}` ? 'fa-check text-emerald-500' : 'fa-copy'} text-xs`}></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex md:flex-col gap-2 mt-4 md:mt-0 flex-shrink-0">
                                                {acc.status !== 'completed' && acc.status !== 'damaged' && (
                                                    <button onClick={() => handleManualPull(acc)} className="w-9 h-9 flex items-center justify-center text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition border border-emerald-100" title="سحب مباشر">
                                                        <i className={`fa-solid ${copiedId === `pull-${acc.id}` ? 'fa-check' : 'fa-hand-holding-dollar'}`}></i>
                                                    </button>
                                                )}
                                                <button onClick={() => setEditingAccount(acc)} className="w-9 h-9 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition border border-blue-100" title="تعديل"><i className="fa-solid fa-pen"></i></button>
                                                <button onClick={() => deleteAccount(acc.id)} className="w-9 h-9 flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition border border-red-100" title="حذف"><i className="fa-solid fa-trash"></i></button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {visibleCount < filteredAccounts.length && (
                                <div className="flex justify-center mt-6">
                                    <button onClick={() => setVisibleCount(p => p + 20)} className="bg-white border-2 border-indigo-100 text-indigo-600 px-10 py-3 rounded-full font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-sm">عرض المزيد <i className="fa-solid fa-chevron-down"></i></button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ===== CREATE SECTION MODAL ===== */}
            {showSectionModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-6 bg-gradient-to-r from-purple-700 to-indigo-600 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold flex items-center gap-2"><i className="fa-solid fa-folder-plus"></i> إنشاء سجل جديد</h3>
                            <button onClick={() => setShowSectionModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"><i className="fa-solid fa-xmark text-lg"></i></button>
                        </div>
                        <form onSubmit={handleCreateSection} className="p-8 space-y-5">
                            <div>
                                <label className="block text-sm font-extrabold text-slate-800 mb-2">اسم السجل</label>
                                <input name="sectionName" className="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" placeholder="مثال: Gemini Pro أو أكواد ستيم..." required />
                            </div>
                            <div>
                                <label className="block text-sm font-extrabold text-slate-800 mb-3">نوع السجل</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 cursor-pointer transition-all has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 border-slate-200 hover:border-indigo-200 text-center">
                                        <input type="radio" name="sectionType" value="accounts" defaultChecked className="hidden" />
                                        <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-2xl"><i className="fa-solid fa-user-shield"></i></div>
                                        <span className="text-sm font-extrabold text-slate-700">اكونتات</span>
                                        <span className="text-[10px] text-slate-400 font-medium">إيميل + باسورد + 2FA</span>
                                    </label>
                                    <label className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 cursor-pointer transition-all has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50 border-slate-200 hover:border-amber-200 text-center">
                                        <input type="radio" name="sectionType" value="codes" className="hidden" />
                                        <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-2xl"><i className="fa-solid fa-key"></i></div>
                                        <span className="text-sm font-extrabold text-slate-700">أكواد</span>
                                        <span className="text-[10px] text-slate-400 font-medium">أكواد تفعيل / سيريال</span>
                                    </label>
                                </div>
                            </div>
                            <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200">
                                <p className="text-[12px] text-blue-700 font-bold flex items-center gap-1.5"><i className="fa-solid fa-circle-info"></i> لربط هذا السجل بمنتج، اذهب لصفحة المنتجات واختر "ربط بالمخزون" من إعدادات المنتج.</p>
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                                <i className="fa-solid fa-check"></i> إنشاء السجل
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== ADD ITEM MODAL ===== */}
            {showAddModal && currentSection && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className={`p-6 text-white flex justify-between items-center ${isCodesSection ? 'bg-gradient-to-r from-amber-600 to-orange-500' : 'bg-gradient-to-r from-purple-700 to-indigo-600'}`}>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <i className={`fa-solid ${isCodesSection ? 'fa-key' : 'fa-plus-circle'}`}></i> إضافة {isCodesSection ? 'أكواد' : 'حسابات'} - {currentSection.name}
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"><i className="fa-solid fa-xmark text-lg"></i></button>
                        </div>
                        <form onSubmit={handleAddAccount} className="p-8 space-y-5 overflow-y-auto">
                            <div className="flex bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200 shadow-inner">
                                <button type="button" onClick={() => setIsBulkAdd(false)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!isBulkAdd ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>إضافة فردية</button>
                                <button type="button" onClick={() => setIsBulkAdd(true)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isBulkAdd ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>إضافة متعددة</button>
                            </div>

                            {isBulkAdd ? (
                                <div>
                                    <label className="block text-sm font-extrabold text-slate-800 mb-2">{isCodesSection ? 'الأكواد (كل كود في سطر)' : 'الحسابات (كل عنصر في سطر)'}</label>
                                    <textarea name="bulkData" rows="6" className="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all font-mono dir-ltr text-left resize-none" placeholder={isCodesSection ? 'XXXX-YYYY-ZZZZ\nAAAA-BBBB-CCCC' : 'email@domain.com:password\nemail2@domain.com:pass2'} required></textarea>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-extrabold text-slate-800 mb-2">{isCodesSection ? 'الكود' : 'الإيميل أو البيانات'}</label>
                                        <input name="email" type="text" className="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all font-mono dir-ltr text-left" placeholder={isCodesSection ? 'XXXX-XXXX-XXXX' : 'user@example.com'} required />
                                    </div>
                                    {!isCodesSection && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-extrabold text-slate-800 mb-2">الباسورد <span className="text-slate-400 font-medium">(اختياري)</span></label>
                                                <input name="password" type="text" className="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all font-mono dir-ltr text-left" placeholder="password123" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-extrabold text-slate-800 mb-2">2FA Link <span className="text-slate-400 font-medium">(اختياري)</span></label>
                                                <input name="twoFA" type="text" className="w-full bg-white border-2 border-purple-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all font-mono dir-ltr text-left text-purple-700" placeholder="otpauth://totp/..." />
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-extrabold text-slate-800 mb-2">الحد الأقصى للاستخدام</label>
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                    {[{ l: 'مرة واحدة', v: 1 }, { l: '3 مرات', v: 3 }, { l: '5 مرات', v: 5 }, { l: 'غير محدود', v: -1 }].map(d => (
                                        <button key={d.v} type="button" onClick={(e) => { e.target.closest('form').querySelector('[name=allowedUses]').value = d.v; }} className="py-2 px-1 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-600 hover:border-indigo-400 hover:bg-indigo-50 transition-all">{d.l}</button>
                                    ))}
                                </div>
                                <input name="allowedUses" type="number" defaultValue="1" className="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" min="-1" />
                            </div>

                            {/* Workspace Options */}
                            <div className="bg-cyan-50/50 p-5 rounded-2xl border border-cyan-200 space-y-4">
                                <div className="text-xs font-black text-cyan-600 uppercase tracking-widest flex items-center gap-1.5">
                                    <i className="fa-solid fa-users-rectangle"></i> إعدادات Workspace (اختياري)
                                </div>
                                <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-cyan-100 cursor-pointer hover:bg-cyan-50 transition-colors">
                                    <input type="checkbox" name="isWorkspace" className="w-5 h-5 text-cyan-600 rounded focus:ring-cyan-500 border-cyan-300" />
                                    <span className="text-sm font-bold text-cyan-800">هذا الحساب Workspace (مجموعة عمل)</span>
                                </label>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">عدد الأشخاص المطلوب للاكتمال</label>
                                    <input name="workspaceMembers" type="number" defaultValue="5" min="1" className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 font-bold text-sm focus:ring-4 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all" />
                                </div>
                                <p className="text-[10px] text-cyan-600 font-medium">
                                    <i className="fa-solid fa-info-circle ml-1"></i>
                                    الحساب ميتعلمش "مكتمل" غير لما العدد المضاف يوصل للحد ده
                                </p>
                            </div>

                            <button type="submit" className={`w-full text-white py-3.5 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${isCodesSection ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}>
                                <i className="fa-solid fa-check"></i> حفظ
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== EDIT MODAL ===== */}
            {editingAccount && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2"><i className="fa-solid fa-pen-to-square text-blue-600"></i> تعديل</h3>
                            <button onClick={() => setEditingAccount(null)} className="bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition text-slate-400"><i className="fa-solid fa-xmark text-lg"></i></button>
                        </div>
                        <form onSubmit={handleEditAccount} className="p-8 space-y-5 overflow-y-auto" key={editingAccount.id}>
                            <div>
                                <label className="block text-sm font-extrabold text-slate-800 mb-2">{isCodesSection ? 'الكود' : 'الإيميل أو البيانات'}</label>
                                <input name="email" type="text" defaultValue={editingAccount.email} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all font-mono dir-ltr text-left" required />
                            </div>
                            {!isCodesSection && (
                                <>
                                    <div>
                                        <label className="block text-sm font-extrabold text-slate-800 mb-2">الباسورد</label>
                                        <input name="password" type="text" defaultValue={editingAccount.password} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all font-mono dir-ltr text-left" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-extrabold text-slate-800 mb-2">2FA Link</label>
                                        <input name="twoFA" type="text" defaultValue={editingAccount.twoFA} className="w-full bg-white border-2 border-purple-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all font-mono dir-ltr text-left text-purple-700" />
                                    </div>
                                </>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-extrabold text-slate-800 mb-2">الحالة</label>
                                    <select name="status" defaultValue={editingAccount.status} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all">
                                        <option value="available">متاح</option><option value="used">مستخدم</option><option value="completed">مكتمل</option><option value="damaged">تالف</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-extrabold text-slate-800 mb-2">الحد الأقصى</label>
                                    <input name="allowedUses" type="number" defaultValue={editingAccount.allowed_uses} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" min="-1" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-extrabold text-slate-800 mb-2">عدد الاستخدامات الحالي</label>
                                <input name="currentUses" type="number" defaultValue={editingAccount.current_uses} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 font-bold text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all bg-slate-50" min="0" />
                            </div>
                            {/* Workspace Options */}
                            <div className="bg-cyan-50/50 p-5 rounded-2xl border border-cyan-200 space-y-4">
                                <div className="text-xs font-black text-cyan-600 uppercase tracking-widest flex items-center gap-1.5">
                                    <i className="fa-solid fa-users-rectangle"></i> إعدادات Workspace
                                </div>
                                <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-cyan-100 cursor-pointer hover:bg-cyan-50 transition-colors">
                                    <input type="checkbox" name="isWorkspace" defaultChecked={editingAccount.isWorkspace} className="w-5 h-5 text-cyan-600 rounded focus:ring-cyan-500 border-cyan-300" />
                                    <span className="text-sm font-bold text-cyan-800">هذا الحساب Workspace</span>
                                </label>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">عدد الأشخاص المطلوب</label>
                                    <input name="workspaceMembers" type="number" defaultValue={editingAccount.workspaceMembers || 5} min="1" className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 font-bold text-sm focus:ring-4 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditingAccount(null)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-white border-2 border-slate-200 hover:bg-slate-50 transition">إلغاء</button>
                                <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition">حفظ التعديلات</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== PULLED RESULT MODAL ===== */}
            {pulledResult && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
                        {pulledResult.empty ? (
                            <>
                                <div className="p-6 bg-gradient-to-r from-red-600 to-orange-500 text-white text-center">
                                    <i className="fa-solid fa-box-open text-4xl mb-2 block opacity-80"></i>
                                    <h3 className="text-xl font-bold">المخزون فارغ!</h3>
                                </div>
                                <div className="p-8 text-center">
                                    <p className="text-slate-600 font-bold mb-2">لا توجد عناصر متاحة للسحب في سجل <span className="text-indigo-700">{currentSection?.name}</span></p>
                                    <button onClick={() => setPulledResult(null)} className="mt-6 w-full bg-slate-800 text-white py-3.5 rounded-xl font-bold hover:bg-slate-900 shadow-lg shadow-slate-200 transition-all">حسناً</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-center">
                                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"><i className="fa-solid fa-bolt text-3xl"></i></div>
                                    <h3 className="text-xl font-bold">تم السحب بنجاح!</h3>
                                    <p className="text-emerald-100 text-sm mt-1">تم نسخ البيانات تلقائياً</p>
                                </div>
                                <div className="p-8 space-y-4">
                                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <span className="text-sm font-bold text-slate-500">الحالة</span>
                                        <span className={`text-sm font-extrabold px-3 py-1 rounded-full ${pulledResult.status === 'completed' ? 'bg-slate-100 text-slate-500' : 'bg-orange-50 text-orange-600 border border-orange-200'}`}>
                                            {pulledResult.status === 'completed' ? '✅ مكتمل' : `📊 ${pulledResult.current_uses} / ${pulledResult.allowed_uses === -1 ? '∞' : pulledResult.allowed_uses}`}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-wide">{isCodesSection ? 'الكود' : 'البيانات'}</label>
                                        <div className="flex items-center">
                                            <code className="text-sm font-mono font-bold text-slate-800 bg-slate-50 px-4 py-3 rounded-r-xl border border-r-0 border-slate-200 flex-1 truncate select-all dir-ltr text-left">{pulledResult.email}</code>
                                            <button onClick={() => copyToClipboard(pulledResult.email, 'pulled-email')} className="h-[46px] w-[50px] flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 rounded-l-xl transition">
                                                <i className={`fa-solid ${copiedId === 'pulled-email' ? 'fa-check text-emerald-500' : 'fa-copy'}`}></i>
                                            </button>
                                        </div>
                                    </div>
                                    {pulledResult.password && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-wide">الباسورد</label>
                                            <div className="flex items-center">
                                                <code className="text-sm font-mono font-bold text-slate-800 bg-slate-50 px-4 py-3 rounded-r-xl border border-r-0 border-slate-200 flex-1 truncate select-all dir-ltr text-left">{pulledResult.password}</code>
                                                <button onClick={() => copyToClipboard(pulledResult.password, 'pulled-pass')} className="h-[46px] w-[50px] flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 rounded-l-xl transition">
                                                    <i className={`fa-solid ${copiedId === 'pulled-pass' ? 'fa-check text-emerald-500' : 'fa-copy'}`}></i>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <button onClick={() => { let t = pulledResult.email; if (pulledResult.password) t += `\n${pulledResult.password}`; if (pulledResult.twoFA) t += `\n${pulledResult.twoFA}`; copyToClipboard(t, 'pulled-all'); }}
                                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border-2 ${copiedId === 'pulled-all' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}>
                                        <i className={`fa-solid ${copiedId === 'pulled-all' ? 'fa-check' : 'fa-clipboard'}`}></i>
                                        {copiedId === 'pulled-all' ? 'تم النسخ ✓' : 'نسخ كل البيانات'}
                                    </button>
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setPulledResult(null)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-white border-2 border-slate-200 hover:bg-slate-50 transition">إغلاق</button>
                                        <button onClick={() => { setPulledResult(null); handlePullNext(); }} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2">
                                            <i className="fa-solid fa-bolt"></i> سحب التالي
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                .animate-scale-in { animation: scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
            `}</style>
        </div>
    );
}