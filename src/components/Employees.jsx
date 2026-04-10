import { useState, useMemo, useEffect } from 'react';
import { employeesAPI } from '../services/api';

export default function Employees() {
    useEffect(() => { window.scrollTo(0, 0); }, []);

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingEmp, setEditingEmp] = useState(null);
    const [filterActive, setFilterActive] = useState('all'); // all | active | inactive
    const [selectedEmp, setSelectedEmp] = useState(null);

    // Form state
    const emptyForm = { name: '', phone: '', role: '', baseSalary: 0, bonus: 0, deductions: 0, absenceDays: 0, absenceDeductionPerDay: 0, notes: '', joinDate: new Date().toISOString().split('T')[0] };
    const [form, setForm] = useState(emptyForm);

    const loadData = async () => {
        try {
            const data = await employeesAPI.getAll();
            setEmployees(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const openAdd = () => {
        setEditingEmp(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEdit = (emp) => {
        setEditingEmp(emp);
        setForm({
            name: emp.name,
            phone: emp.phone || '',
            role: emp.role || '',
            baseSalary: emp.baseSalary || 0,
            bonus: emp.bonus || 0,
            deductions: emp.deductions || 0,
            absenceDays: emp.absenceDays || 0,
            absenceDeductionPerDay: emp.absenceDeductionPerDay || 0,
            notes: emp.notes || '',
            joinDate: emp.joinDate || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return alert('اسم الموظف مطلوب');
        try {
            if (editingEmp) {
                await employeesAPI.update(editingEmp.id, form);
            } else {
                await employeesAPI.create(form);
            }
            setShowModal(false);
            setEditingEmp(null);
            setForm(emptyForm);
            await loadData();
        } catch (err) {
            console.error(err);
            alert('حدث خطأ');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('هل تريد حذف هذا الموظف نهائياً؟')) return;
        try {
            await employeesAPI.delete(id);
            if (selectedEmp?.id === id) setSelectedEmp(null);
            await loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const toggleActive = async (emp) => {
        try {
            await employeesAPI.update(emp.id, { ...emp, isActive: !emp.isActive });
            await loadData();
        } catch (err) {
            console.error(err);
        }
    };

    // Calculate net salary
    const calcNet = (emp) => {
        const absenceTotal = (emp.absenceDays || 0) * (emp.absenceDeductionPerDay || 0);
        return (emp.baseSalary || 0) + (emp.bonus || 0) - (emp.deductions || 0) - absenceTotal;
    };

    // Filter & search
    const filtered = useMemo(() => {
        return employees.filter(emp => {
            const matchActive = filterActive === 'all' ? true : filterActive === 'active' ? emp.isActive : !emp.isActive;
            const term = searchTerm.toLowerCase();
            const matchSearch = !term || emp.name.toLowerCase().includes(term) || (emp.phone && emp.phone.includes(term)) || (emp.role && emp.role.toLowerCase().includes(term));
            return matchActive && matchSearch;
        });
    }, [employees, filterActive, searchTerm]);

    // Stats
    const stats = useMemo(() => {
        const active = employees.filter(e => e.isActive);
        const totalSalaries = active.reduce((s, e) => s + calcNet(e), 0);
        const totalBonuses = active.reduce((s, e) => s + (e.bonus || 0), 0);
        const totalDeductions = active.reduce((s, e) => s + (e.deductions || 0) + ((e.absenceDays || 0) * (e.absenceDeductionPerDay || 0)), 0);
        return { total: employees.length, active: active.length, totalSalaries, totalBonuses, totalDeductions };
    }, [employees]);

    if (loading) return <div className="text-center p-20 text-slate-400"><i className="fa-solid fa-spinner fa-spin text-3xl"></i></div>;

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in pb-20 font-sans text-slate-800">

            {/* Header */}
            <div className="bg-gradient-to-r from-violet-700 to-purple-600 rounded-2xl p-5 md:p-8 text-white relative overflow-hidden shadow-xl">
                <div className="absolute -left-10 -bottom-10 text-[120px] opacity-10"><i className="fa-solid fa-id-card-clip"></i></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm"><i className="fa-solid fa-id-card-clip text-2xl"></i></div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-extrabold">إدارة الموظفين</h2>
                            <p className="text-purple-100 text-xs md:text-sm font-medium">المرتبات والمكافآت والخصومات والغياب</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-5">
                        <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 md:px-6 py-3 border border-white/20">
                            <p className="text-purple-100 text-[10px] md:text-xs font-bold mb-1">إجمالي الموظفين</p>
                            <p className="text-xl md:text-2xl font-black">{stats.total}</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 md:px-6 py-3 border border-white/20">
                            <p className="text-purple-100 text-[10px] md:text-xs font-bold mb-1">النشطين</p>
                            <p className="text-xl md:text-2xl font-black">{stats.active}</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 md:px-6 py-3 border border-white/20">
                            <p className="text-purple-100 text-[10px] md:text-xs font-bold mb-1">إجمالي المرتبات</p>
                            <p className="text-xl md:text-2xl font-black dir-ltr">{stats.totalSalaries.toLocaleString()} <span className="text-sm opacity-80">ج.م</span></p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 md:px-6 py-3 border border-white/20">
                            <p className="text-purple-100 text-[10px] md:text-xs font-bold mb-1">المكافآت</p>
                            <p className="text-xl md:text-2xl font-black text-emerald-300 dir-ltr">{stats.totalBonuses.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 md:px-6 py-3 border border-white/20">
                            <p className="text-purple-100 text-[10px] md:text-xs font-bold mb-1">الخصومات</p>
                            <p className="text-xl md:text-2xl font-black text-red-300 dir-ltr">{stats.totalDeductions.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between sticky top-2 z-30 bg-white/95 backdrop-blur-md">
                <div className="relative w-full md:w-80">
                    <i className="fa-solid fa-search absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input type="text" className="w-full bg-white border-2 border-slate-200 text-slate-900 text-sm font-semibold rounded-xl pr-10 p-3 focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all placeholder-slate-400" placeholder="بحث بالاسم أو الرقم أو الوظيفة..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-2 md:gap-3 w-full md:w-auto flex-wrap">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        {[{id:'all', label:'الكل'}, {id:'active', label:'نشط'}, {id:'inactive', label:'متوقف'}].map(f => (
                            <button key={f.id} onClick={() => setFilterActive(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterActive === f.id ? 'bg-purple-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{f.label}</button>
                        ))}
                    </div>
                    <button onClick={openAdd} className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm px-5 md:px-8 py-2.5 shadow-lg shadow-purple-200 transition-all flex items-center gap-2">
                        <i className="fa-solid fa-plus"></i> موظف جديد
                    </button>
                </div>
            </div>

            {/* Employees Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {filtered.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 md:p-16 text-center text-slate-400">
                        <i className="fa-solid fa-users-slash text-4xl mb-4 block opacity-30"></i>
                        <p className="font-bold text-lg">{searchTerm ? 'لا يوجد نتائج' : 'لا يوجد موظفين بعد'}</p>
                        <p className="text-sm mt-1">اضغط "موظف جديد" لإضافة موظف</p>
                    </div>
                ) : filtered.map(emp => {
                    const net = calcNet(emp);
                    const absenceTotal = (emp.absenceDays || 0) * (emp.absenceDeductionPerDay || 0);
                    return (
                        <div key={emp.id} onClick={() => setSelectedEmp(emp)}
                            className={`bg-white rounded-2xl border-2 p-4 md:p-5 cursor-pointer transition-all hover:shadow-lg group ${emp.isActive ? 'border-slate-200 hover:border-purple-300' : 'border-slate-100 opacity-60'}`}>
                            {/* Top row */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm ${emp.isActive ? 'bg-gradient-to-br from-purple-600 to-violet-700' : 'bg-slate-400'}`}>
                                        {emp.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-extrabold text-sm md:text-base text-slate-800 truncate">{emp.name}</h3>
                                        <p className="text-[10px] md:text-xs text-slate-400">{emp.role || 'بدون وظيفة'}</p>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${emp.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                    {emp.isActive ? 'نشط' : 'متوقف'}
                                </span>
                            </div>

                            {/* Salary breakdown */}
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 flex items-center gap-1.5"><i className="fa-solid fa-money-bill w-4 text-center text-slate-400"></i> المرتب الأساسي</span>
                                    <span className="font-bold text-slate-700 dir-ltr">{Number(emp.baseSalary || 0).toLocaleString()}</span>
                                </div>
                                {emp.bonus > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-emerald-600 flex items-center gap-1.5"><i className="fa-solid fa-gift w-4 text-center"></i> مكافآت</span>
                                        <span className="font-bold text-emerald-600 dir-ltr">+{Number(emp.bonus).toLocaleString()}</span>
                                    </div>
                                )}
                                {emp.deductions > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-red-500 flex items-center gap-1.5"><i className="fa-solid fa-minus-circle w-4 text-center"></i> خصومات</span>
                                        <span className="font-bold text-red-500 dir-ltr">-{Number(emp.deductions).toLocaleString()}</span>
                                    </div>
                                )}
                                {emp.absenceDays > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-orange-500 flex items-center gap-1.5"><i className="fa-solid fa-calendar-xmark w-4 text-center"></i> غياب ({emp.absenceDays} يوم)</span>
                                        <span className="font-bold text-orange-500 dir-ltr">-{absenceTotal.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="border-t border-dashed border-slate-200 pt-2 mt-2 flex justify-between items-center">
                                    <span className="text-slate-700 font-extrabold flex items-center gap-1.5"><i className="fa-solid fa-wallet w-4 text-center text-purple-500"></i> صافي المرتب</span>
                                    <span className={`font-black text-base dir-ltr ${net >= 0 ? 'text-purple-700' : 'text-red-600'}`}>{net.toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span></span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-1.5 mt-4 pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                                <button onClick={() => openEdit(emp)} className="flex-1 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition flex items-center justify-center gap-1">
                                    <i className="fa-solid fa-pen text-[10px]"></i> تعديل
                                </button>
                                <button onClick={() => toggleActive(emp)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1 ${emp.isActive ? 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-100'}`}>
                                    <i className={`fa-solid ${emp.isActive ? 'fa-pause' : 'fa-play'} text-[10px]`}></i> {emp.isActive ? 'إيقاف' : 'تفعيل'}
                                </button>
                                <button onClick={() => handleDelete(emp.id)} className="py-2 px-3 rounded-xl text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 transition">
                                    <i className="fa-solid fa-trash text-[10px]"></i>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ============ DETAILS MODAL ============ */}
            {selectedEmp && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setSelectedEmp(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 bg-gradient-to-r from-violet-700 to-purple-600 text-white flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-black">
                                    {selectedEmp.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div>
                                    <h3 className="text-xl font-extrabold">{selectedEmp.name}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-purple-100">
                                        <span>{selectedEmp.role || 'بدون وظيفة'}</span>
                                        {selectedEmp.phone && <span className="flex items-center gap-1"><i className="fa-solid fa-phone text-[10px]"></i> {selectedEmp.phone}</span>}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedEmp(null)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"><i className="fa-solid fa-xmark text-lg"></i></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-5">
                            {/* Info Row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 text-center">
                                    <span className="text-[10px] text-purple-500 font-bold block mb-1">تاريخ الانضمام</span>
                                    <span className="text-sm font-black text-purple-700">{selectedEmp.joinDate ? new Date(selectedEmp.joinDate).toLocaleDateString('en-GB') : '-'}</span>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 text-center">
                                    <span className="text-[10px] text-purple-500 font-bold block mb-1">الحالة</span>
                                    <span className={`text-sm font-black ${selectedEmp.isActive ? 'text-emerald-600' : 'text-red-500'}`}>{selectedEmp.isActive ? '✅ نشط' : '⏸ متوقف'}</span>
                                </div>
                            </div>

                            {/* Salary Breakdown */}
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                                <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3"><i className="fa-solid fa-calculator text-purple-500"></i> تفاصيل المرتب</h4>
                                
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-600 text-sm">المرتب الأساسي</span>
                                    <span className="font-bold text-slate-800 dir-ltr">{Number(selectedEmp.baseSalary || 0).toLocaleString()} ج.م</span>
                                </div>
                                <div className="flex justify-between py-2 border-t border-slate-200">
                                    <span className="text-emerald-600 text-sm flex items-center gap-1"><i className="fa-solid fa-plus text-[10px]"></i> المكافآت</span>
                                    <span className="font-bold text-emerald-600 dir-ltr">+{Number(selectedEmp.bonus || 0).toLocaleString()} ج.م</span>
                                </div>
                                <div className="flex justify-between py-2 border-t border-slate-200">
                                    <span className="text-red-500 text-sm flex items-center gap-1"><i className="fa-solid fa-minus text-[10px]"></i> الخصومات</span>
                                    <span className="font-bold text-red-500 dir-ltr">-{Number(selectedEmp.deductions || 0).toLocaleString()} ج.م</span>
                                </div>
                                <div className="flex justify-between py-2 border-t border-slate-200">
                                    <span className="text-orange-500 text-sm flex items-center gap-1"><i className="fa-solid fa-calendar-xmark text-[10px]"></i> أيام الغياب</span>
                                    <span className="font-bold text-slate-700">{selectedEmp.absenceDays || 0} يوم</span>
                                </div>
                                {selectedEmp.absenceDays > 0 && (
                                    <div className="flex justify-between py-2 border-t border-slate-200">
                                        <span className="text-orange-500 text-sm">خصم الغياب ({selectedEmp.absenceDeductionPerDay || 0} × {selectedEmp.absenceDays})</span>
                                        <span className="font-bold text-orange-500 dir-ltr">-{((selectedEmp.absenceDays || 0) * (selectedEmp.absenceDeductionPerDay || 0)).toLocaleString()} ج.م</span>
                                    </div>
                                )}

                                <div className="flex justify-between py-3 border-t-2 border-purple-300 mt-2">
                                    <span className="font-extrabold text-slate-800 text-base">صافي المرتب</span>
                                    <span className={`font-black text-xl dir-ltr ${calcNet(selectedEmp) >= 0 ? 'text-purple-700' : 'text-red-600'}`}>{calcNet(selectedEmp).toLocaleString()} ج.م</span>
                                </div>
                            </div>

                            {selectedEmp.notes && (
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                                    <h4 className="font-bold text-amber-700 text-xs mb-1"><i className="fa-solid fa-note-sticky"></i> ملاحظات</h4>
                                    <p className="text-sm text-amber-800 whitespace-pre-wrap">{selectedEmp.notes}</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { openEdit(selectedEmp); setSelectedEmp(null); }} className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 shadow-lg shadow-purple-200 transition flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-pen"></i> تعديل
                                </button>
                                <button onClick={() => setSelectedEmp(null)} className="bg-white text-slate-600 px-5 py-3 rounded-xl font-bold border-2 border-slate-200 hover:bg-slate-50 transition">
                                    إغلاق
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ ADD/EDIT MODAL ============ */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 md:p-6 bg-gradient-to-r from-purple-600 to-violet-700 text-white flex justify-between items-center flex-shrink-0">
                            <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                                <i className={`fa-solid ${editingEmp ? 'fa-user-pen' : 'fa-user-plus'}`}></i>
                                {editingEmp ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"><i className="fa-solid fa-xmark text-lg"></i></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 md:p-8 space-y-4 overflow-y-auto flex-1">
                            {/* Name & Role */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs md:text-sm font-extrabold text-slate-800 mb-1.5">اسم الموظف *</label>
                                    <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 font-bold text-sm focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all" placeholder="الاسم الكامل" required />
                                </div>
                                <div>
                                    <label className="block text-xs md:text-sm font-extrabold text-slate-800 mb-1.5">الوظيفة</label>
                                    <input type="text" value={form.role} onChange={e => handleChange('role', e.target.value)} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 font-bold text-sm focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all" placeholder="مثال: مبيعات" />
                                </div>
                            </div>

                            {/* Phone & Join Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs md:text-sm font-extrabold text-slate-800 mb-1.5">رقم الهاتف</label>
                                    <input type="tel" value={form.phone} onChange={e => handleChange('phone', e.target.value)} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 font-bold text-sm focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all font-mono dir-ltr text-right" placeholder="01xxxxxxxxx" />
                                </div>
                                <div>
                                    <label className="block text-xs md:text-sm font-extrabold text-slate-800 mb-1.5">تاريخ الانضمام</label>
                                    <input type="date" value={form.joinDate} onChange={e => handleChange('joinDate', e.target.value)} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 font-bold text-sm focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all" />
                                </div>
                            </div>

                            <div className="border-t border-dashed border-slate-200 pt-4">
                                <h4 className="text-xs font-extrabold text-slate-500 mb-3 uppercase tracking-wider"><i className="fa-solid fa-calculator ml-1"></i> تفاصيل المرتب</h4>
                            </div>

                            {/* Salary */}
                            <div>
                                <label className="block text-xs md:text-sm font-extrabold text-slate-800 mb-1.5">المرتب الأساسي (ج.م)</label>
                                <input type="number" min="0" value={form.baseSalary} onChange={e => handleChange('baseSalary', Number(e.target.value))} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 font-bold text-sm focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all dir-ltr text-right" />
                            </div>

                            {/* Bonus & Deductions */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs md:text-sm font-extrabold text-emerald-700 mb-1.5"><i className="fa-solid fa-gift ml-1"></i> المكافآت</label>
                                    <input type="number" min="0" value={form.bonus} onChange={e => handleChange('bonus', Number(e.target.value))} className="w-full bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3 font-bold text-sm focus:ring-4 focus:ring-emerald-100 focus:border-emerald-600 outline-none transition-all text-emerald-700 dir-ltr text-right" />
                                </div>
                                <div>
                                    <label className="block text-xs md:text-sm font-extrabold text-red-600 mb-1.5"><i className="fa-solid fa-minus-circle ml-1"></i> الخصومات</label>
                                    <input type="number" min="0" value={form.deductions} onChange={e => handleChange('deductions', Number(e.target.value))} className="w-full bg-red-50 border-2 border-red-200 rounded-xl p-3 font-bold text-sm focus:ring-4 focus:ring-red-100 focus:border-red-600 outline-none transition-all text-red-600 dir-ltr text-right" />
                                </div>
                            </div>

                            {/* Absence */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs md:text-sm font-extrabold text-orange-700 mb-1.5"><i className="fa-solid fa-calendar-xmark ml-1"></i> أيام الغياب</label>
                                    <input type="number" min="0" value={form.absenceDays} onChange={e => handleChange('absenceDays', Number(e.target.value))} className="w-full bg-orange-50 border-2 border-orange-200 rounded-xl p-3 font-bold text-sm focus:ring-4 focus:ring-orange-100 focus:border-orange-600 outline-none transition-all text-orange-700 dir-ltr text-right" />
                                </div>
                                <div>
                                    <label className="block text-xs md:text-sm font-extrabold text-orange-700 mb-1.5">خصم اليوم الواحد</label>
                                    <input type="number" min="0" value={form.absenceDeductionPerDay} onChange={e => handleChange('absenceDeductionPerDay', Number(e.target.value))} className="w-full bg-orange-50 border-2 border-orange-200 rounded-xl p-3 font-bold text-sm focus:ring-4 focus:ring-orange-100 focus:border-orange-600 outline-none transition-all text-orange-700 dir-ltr text-right" />
                                </div>
                            </div>

                            {/* Net preview */}
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 flex justify-between items-center">
                                <span className="font-bold text-purple-700 text-sm">💰 صافي المرتب المتوقع</span>
                                <span className={`font-black text-lg dir-ltr ${calcNet(form) >= 0 ? 'text-purple-700' : 'text-red-600'}`}>{calcNet(form).toLocaleString()} <span className="text-xs text-slate-400">ج.م</span></span>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs md:text-sm font-extrabold text-slate-800 mb-1.5">ملاحظات</label>
                                <textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} rows="2" className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 font-semibold text-sm focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all resize-none" placeholder="أي ملاحظات..."></textarea>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-white border-2 border-slate-200 hover:bg-slate-50 transition">إلغاء</button>
                                <button type="submit" className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 shadow-lg shadow-purple-200 transition flex items-center justify-center gap-2">
                                    <i className={`fa-solid ${editingEmp ? 'fa-check' : 'fa-plus'}`}></i> {editingEmp ? 'حفظ التعديلات' : 'إضافة الموظف'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
