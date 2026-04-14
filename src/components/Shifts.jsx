import { useEffect, useState, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { shiftsAPI, employeesAPI } from '../services/api';
import { supabase } from '../lib/supabase';
import { useConfirm } from './ConfirmDialog';

const SHIFT_COLORS = [
    { id: 'blue',   label: 'أزرق',   grad: 'from-blue-600 to-indigo-700',     ring: '#3b82f6', light: '#eff6ff' },
    { id: 'purple', label: 'بنفسجي', grad: 'from-purple-600 to-violet-700',   ring: '#a855f7', light: '#faf5ff' },
    { id: 'emerald',label: 'أخضر',   grad: 'from-emerald-500 to-teal-600',    ring: '#10b981', light: '#f0fdf4' },
    { id: 'orange', label: 'برتقالي',grad: 'from-orange-500 to-amber-600',    ring: '#f97316', light: '#fff7ed' },
    { id: 'rose',   label: 'وردي',   grad: 'from-rose-500 to-pink-600',       ring: '#f43f5e', light: '#fff1f2' },
    { id: 'slate',  label: 'رمادي',  grad: 'from-slate-600 to-slate-800',     ring: '#64748b', light: '#f8fafc' },
];

const getColorDef = (colorId) => SHIFT_COLORS.find(c => c.id === colorId) || SHIFT_COLORS[0];

export default function Shifts() {
    const { sales } = useData();
    const { showConfirm, showAlert } = useConfirm();

    const [shifts, setShifts]         = useState([]);
    const [employees, setEmployees]    = useState([]);
    const [loading, setLoading]        = useState(true);
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Modals
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [editingShift, setEditingShift]     = useState(null);
    const [showEmpModal, setShowEmpModal]     = useState(null); // shift object
    const [localEmpIds, setLocalEmpIds]       = useState([]); // local checkbox state

    const [form, setForm] = useState({ name: '', startTime: '08:00', endTime: '16:00', color: 'blue' });

    useEffect(() => { window.scrollTo(0, 0); }, []);

    const loadData = useCallback(async () => {
        try {
            const [shiftData, empData] = await Promise.all([
                shiftsAPI.getAll(),
                employeesAPI.getAll(),
            ]);
            setShifts(shiftData);
            setEmployees(empData.filter(e => e.isActive));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Supabase realtime
    useEffect(() => {
        const ch = supabase.channel('shifts-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, loadData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_employees' }, loadData)
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [loadData]);

    // ── Sales per shift ────────────────────────────────────────────
    const shiftSales = useMemo(() => {
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(selectedDate);
        dayEnd.setHours(23, 59, 59, 999);

        const daySales = sales.filter(s => {
            const d = new Date(s.date);
            return d >= dayStart && d <= dayEnd && !selectedDate ? true : true;
        });

        // For each shift, count sales whose time falls in [startTime, endTime)
        const result = {};
        shifts.forEach(shift => {
            const [sh, sm] = shift.start_time.split(':').map(Number);
            const [eh, em] = shift.end_time.split(':').map(Number);
            const shiftStart = sh * 60 + sm;
            const shiftEnd   = eh * 60 + em;

            const matched = (selectedDate ? daySales : sales).filter(s => {
                const d = new Date(s.date);
                if (selectedDate) {
                    const dd = new Date(selectedDate);
                    if (d.toDateString() !== dd.toDateString()) return false;
                }
                const mins = d.getHours() * 60 + d.getMinutes();
                if (shiftEnd > shiftStart) return mins >= shiftStart && mins < shiftEnd;
                // Overnight shift
                return mins >= shiftStart || mins < shiftEnd;
            });

            result[shift.id] = {
                count: matched.length,
                revenue: matched.reduce((s, x) => s + (Number(x.finalPrice) || 0), 0),
            };
        });
        return result;
    }, [shifts, sales, selectedDate]);

    // ── Handlers ──────────────────────────────────────────────────
    const openAdd = () => {
        setEditingShift(null);
        setForm({ name: '', startTime: '08:00', endTime: '16:00', color: 'blue' });
        setShowShiftModal(true);
    };

    const openEdit = (shift) => {
        setEditingShift(shift);
        setForm({ name: shift.name, startTime: shift.start_time, endTime: shift.end_time, color: shift.color || 'blue' });
        setShowShiftModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { showAlert({ title: 'خطأ', message: 'اسم الشيفت مطلوب', type: 'warning' }); return; }
        try {
            if (editingShift) {
                await shiftsAPI.update(editingShift.id, { name: form.name, startTime: form.startTime, endTime: form.endTime, color: form.color });
            } else {
                await shiftsAPI.create({ name: form.name, startTime: form.startTime, endTime: form.endTime, color: form.color });
            }
            setShowShiftModal(false);
            await loadData();
        } catch (err) { console.error(err); showAlert({ title: 'خطأ!', message: 'حدث خطأ أثناء الحفظ', type: 'danger' }); }
    };

    const handleDelete = async (shift) => {
        const ok = await showConfirm({ title: 'حذف الشيفت', message: `هل تريد حذف "${shift.name}"؟ سيتم حذف جميع الموظفين المرتبطين بهذا الشيفت.`, confirmText: 'حذف', type: 'danger' });
        if (!ok) return;
        try { await shiftsAPI.delete(shift.id); await loadData(); }
        catch (err) { console.error(err); }
    };

    const openEmpModal = (shift) => {
        setShowEmpModal(shift);
        setLocalEmpIds([...(shift.employeeIds || [])]);
    };

    const toggleLocalEmp = (empId) => {
        setLocalEmpIds(prev =>
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    };

    const saveEmpChanges = async () => {
        if (!showEmpModal) return;
        const shiftId = showEmpModal.id;
        const original = showEmpModal.employeeIds || [];
        const toAdd    = localEmpIds.filter(id => !original.includes(id));
        const toRemove = original.filter(id => !localEmpIds.includes(id));
        try {
            await Promise.all([
                ...toAdd.map(id => shiftsAPI.addEmployee(shiftId, id)),
                ...toRemove.map(id => shiftsAPI.removeEmployee(shiftId, id)),
            ]);
        } catch (err) { console.error(err); }
        setShowEmpModal(null);
        await loadData();
    };

    // ── Total stats ────────────────────────────────────────────────
    const totalStats = useMemo(() => {
        const values = Object.values(shiftSales);
        return {
            orders: values.reduce((s, v) => s + v.count, 0),
            revenue: values.reduce((s, v) => s + v.revenue, 0),
        };
    }, [shiftSales]);

    if (loading) return <div className="flex items-center justify-center h-64"><i className="fa-solid fa-spinner fa-spin text-4xl text-indigo-400"></i></div>;

    return (
        <div className="space-y-5 animate-fade-in pb-24 font-sans text-slate-800">

            {/* ── Header ── */}
            <div className="bg-gradient-to-r from-indigo-700 to-blue-700 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl">
                <div className="absolute -left-8 -bottom-10 text-[130px] opacity-[0.05]"><i className="fa-solid fa-clock"></i></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-white/20 p-3 rounded-xl"><i className="fa-solid fa-clock-rotate-left text-2xl"></i></div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-extrabold">إدارة الورديات</h2>
                            <p className="text-indigo-200 text-xs mt-0.5">ربط الموظفين بالشيفتات • تتبع أداء كل وردية</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2">
                        <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-white/20">
                            <p className="text-indigo-200 text-[10px] font-bold">الشيفتات</p>
                            <p className="text-2xl font-black">{shifts.length}</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-white/20">
                            <p className="text-indigo-200 text-[10px] font-bold">أوردرات اليوم</p>
                            <p className="text-2xl font-black">{totalStats.orders}</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-white/20">
                            <p className="text-indigo-200 text-[10px] font-bold">إيراد اليوم</p>
                            <p className="text-2xl font-black dir-ltr">{totalStats.revenue.toLocaleString()} <span className="text-sm opacity-60">ج.م</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between sticky top-2 z-30">
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                    <span className="text-xs font-bold text-slate-500 px-2">📅 التاريخ:</span>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-800 text-sm rounded-lg p-2 outline-none font-bold shadow-sm focus:border-indigo-400"
                    />
                    <button
                        onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedDate === new Date().toISOString().split('T')[0] ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                    >
                        اليوم
                    </button>
                </div>
                <button
                    onClick={openAdd}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-6 py-2.5 text-sm shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                    <i className="fa-solid fa-plus"></i> شيفت جديد
                </button>
            </div>

            {/* ── Shift Cards Grid ── */}
            {shifts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                    <i className="fa-solid fa-clock text-5xl mb-4 opacity-20"></i>
                    <p className="font-bold text-lg mb-2">لا توجد شيفتات بعد</p>
                    <p className="text-sm mb-4">ابدأ بإضافة شيفت جديد</p>
                    <button onClick={openAdd} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-lg">
                        <i className="fa-solid fa-plus ml-2"></i> إضافة شيفت
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shifts.map(shift => {
                        const cd = getColorDef(shift.color);
                        const stats = shiftSales[shift.id] || { count: 0, revenue: 0 };
                        const shiftEmps = employees.filter(e => shift.employeeIds?.includes(e.id));

                        return (
                            <div key={shift.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden">
                                {/* Card top gradient bar */}
                                <div className={`bg-gradient-to-r ${cd.grad} p-5 text-white relative overflow-hidden`}>
                                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full"></div>
                                    <div className="relative z-10">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="text-lg font-extrabold">{shift.name}</h3>
                                                <p className="text-white/70 text-xs font-mono mt-0.5 dir-ltr">
                                                    {shift.start_time} → {shift.end_time}
                                                </p>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => openEdit(shift)}
                                                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition"
                                                    title="تعديل"
                                                >
                                                    <i className="fa-solid fa-pen text-xs"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(shift)}
                                                    className="w-8 h-8 bg-red-400/30 hover:bg-red-400/50 rounded-lg flex items-center justify-center transition"
                                                    title="حذف"
                                                >
                                                    <i className="fa-solid fa-trash text-xs"></i>
                                                </button>
                                            </div>
                                        </div>
                                        {/* Stats */}
                                        <div className="flex gap-3">
                                            <div className="bg-white/20 rounded-xl px-3 py-2 text-center flex-1">
                                                <p className="text-white/60 text-[10px] font-bold">أوردرات</p>
                                                <p className="text-2xl font-black">{stats.count}</p>
                                            </div>
                                            <div className="bg-white/20 rounded-xl px-3 py-2 text-center flex-1">
                                                <p className="text-white/60 text-[10px] font-bold">الإيراد</p>
                                                <p className="text-lg font-black dir-ltr">{stats.revenue.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Employees section */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-xs font-extrabold text-slate-600 flex items-center gap-1.5">
                                            <i className="fa-solid fa-users text-slate-400"></i>
                                            الموظفون ({shiftEmps.length})
                                        </h4>
                                        <button
                                            onClick={() => openEmpModal(shift)}
                                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition"
                                        >
                                            <i className="fa-solid fa-user-plus ml-1 text-[9px]"></i> إدارة
                                        </button>
                                    </div>

                                    {shiftEmps.length === 0 ? (
                                        <button
                                            onClick={() => openEmpModal(shift)}
                                            className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-indigo-300 hover:text-indigo-500 transition"
                                        >
                                            <i className="fa-solid fa-user-plus ml-1"></i> اضغط لإضافة موظفين
                                        </button>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {shiftEmps.map(emp => (
                                                <div key={emp.id} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border" style={{ backgroundColor: cd.light, borderColor: cd.ring + '40', color: '#374151' }}>
                                                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-black" style={{ backgroundColor: cd.ring }}>
                                                        {emp.name?.charAt(0).toUpperCase()}
                                                    </div>
                                                    {emp.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Summary Table ── */}
            {shifts.length > 0 && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                            <i className="fa-solid fa-chart-bar text-indigo-500"></i>
                            مقارنة الورديات
                        </h3>
                        <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full">
                            {new Date(selectedDate).toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="p-4 text-right">الشيفت</th>
                                    <th className="p-4 text-center">الوقت</th>
                                    <th className="p-4 text-center">الموظفون</th>
                                    <th className="p-4 text-center">الأوردرات</th>
                                    <th className="p-4 text-center">الإيراد</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {shifts.map(shift => {
                                    const cd = getColorDef(shift.color);
                                    const stats = shiftSales[shift.id] || { count: 0, revenue: 0 };
                                    const shiftEmps = employees.filter(e => shift.employeeIds?.includes(e.id));
                                    return (
                                        <tr key={shift.id} className="hover:bg-slate-50 transition">
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2.5 h-2.5 rounded-full`} style={{ backgroundColor: cd.ring }}></div>
                                                    <span className="font-bold text-slate-800">{shift.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-mono text-xs text-slate-500 dir-ltr">{shift.start_time} → {shift.end_time}</td>
                                            <td className="p-4 text-center">
                                                <div className="flex justify-center gap-1 flex-wrap">
                                                    {shiftEmps.length === 0 ? (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    ) : shiftEmps.map(e => (
                                                        <span key={e.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: cd.ring }}>{e.name}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-black text-xl" style={{ color: cd.ring }}>{stats.count}</td>
                                            <td className="p-4 text-center font-bold text-slate-700 dir-ltr">{stats.revenue.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td className="p-4 font-extrabold text-slate-700" colSpan={3}>الإجمالي</td>
                                    <td className="p-4 text-center font-black text-xl text-indigo-700">{totalStats.orders}</td>
                                    <td className="p-4 text-center font-black text-indigo-700 dir-ltr">{totalStats.revenue.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Add/Edit Shift Modal ── */}
            {showShiftModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowShiftModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className={`p-5 bg-gradient-to-r ${getColorDef(form.color).grad} text-white flex justify-between items-center`}>
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <i className={`fa-solid ${editingShift ? 'fa-pen-to-square' : 'fa-clock'}`}></i>
                                {editingShift ? 'تعديل الشيفت' : 'شيفت جديد'}
                            </h3>
                            <button onClick={() => setShowShiftModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">اسم الشيفت *</label>
                                <input
                                    type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold text-sm focus:border-indigo-500 outline-none"
                                    placeholder="مثال: شيفت الصباح"
                                    autoFocus required
                                />
                            </div>
                            {/* Time */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">وقت البداية</label>
                                    <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold text-sm focus:border-indigo-500 outline-none dir-ltr" />
                                </div>
                                <div>
                                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">وقت النهاية</label>
                                    <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold text-sm focus:border-indigo-500 outline-none dir-ltr" />
                                </div>
                            </div>
                            {/* Color */}
                            <div>
                                <label className="block text-xs font-extrabold text-slate-700 mb-2">اللون</label>
                                <div className="flex gap-2 flex-wrap">
                                    {SHIFT_COLORS.map(c => (
                                        <button
                                            key={c.id} type="button"
                                            onClick={() => setForm(f => ({ ...f, color: c.id }))}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition ${form.color === c.id ? 'border-slate-800 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
                                        >
                                            <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${c.grad}`}></div>
                                            {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowShiftModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-white border-2 border-slate-200 hover:bg-slate-50 transition">إلغاء</button>
                                <button type="submit" className={`flex-1 bg-gradient-to-r ${getColorDef(form.color).grad} text-white py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2`}>
                                    <i className={`fa-solid ${editingShift ? 'fa-check' : 'fa-plus'}`}></i>
                                    {editingShift ? 'حفظ التعديلات' : 'إضافة'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Employee Assign Modal ── */}
            {showEmpModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowEmpModal(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className={`p-5 bg-gradient-to-r ${getColorDef(showEmpModal.color).grad} text-white`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-extrabold flex items-center gap-2">
                                        <i className="fa-solid fa-users-gear text-lg"></i>
                                        موظفو الشيفت
                                    </h3>
                                    <p className="text-white/70 text-xs mt-0.5">{showEmpModal.name} · {showEmpModal.start_time} ← {showEmpModal.end_time}</p>
                                </div>
                                <button onClick={() => setShowEmpModal(null)} className="bg-white/15 hover:bg-white/25 w-8 h-8 rounded-full flex items-center justify-center transition">
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            {/* Linked count */}
                            <div className="mt-3 bg-white/15 rounded-xl px-3 py-2 flex items-center gap-2">
                                <i className="fa-solid fa-circle-check text-white/80 text-sm"></i>
                                <span className="text-white text-xs font-bold">
                                        {localEmpIds.length} من {employees.length} موظف مضاف
                                </span>
                            </div>
                        </div>

                        {/* Employee list */}
                        <div className="p-3 max-h-[50vh] overflow-y-auto space-y-2">
                            {employees.length === 0 ? (
                                <div className="flex flex-col items-center py-10 text-slate-400">
                                    <i className="fa-solid fa-users-slash text-3xl mb-2 opacity-30"></i>
                                    <p className="text-sm font-bold">لا يوجد موظفون نشطون</p>
                                </div>
                            ) : employees.map(emp => {
                                const isLinked = localEmpIds.includes(emp.id);
                                const cd = getColorDef(showEmpModal.color);
                                return (
                                    <button
                                        key={emp.id}
                                        onClick={() => toggleLocalEmp(emp.id)}
                                        className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-right transition-all duration-150 ${
                                            isLinked
                                                ? 'shadow-sm'
                                                : 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white'
                                        }`}
                                        style={isLinked ? {
                                            borderColor: cd.ring + '80',
                                            backgroundColor: cd.light,
                                        } : {}}
                                    >
                                        {/* Avatar */}
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white flex-shrink-0 shadow-sm"
                                            style={{ backgroundColor: isLinked ? cd.ring : '#94a3b8' }}
                                        >
                                            {emp.name?.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 text-right">
                                            <p className="font-extrabold text-sm text-slate-800 truncate">{emp.name}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{emp.role || '—'}</p>
                                        </div>

                                        {/* Check */}
                                        <div
                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                                                isLinked ? 'border-0 shadow-sm' : 'border-slate-200 bg-white'
                                            }`}
                                            style={isLinked ? { backgroundColor: cd.ring } : {}}
                                        >
                                            {isLinked && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/60">
                            <button
                                onClick={saveEmpChanges}
                                className={`w-full py-3 rounded-2xl font-extrabold text-sm text-white transition shadow-lg`}
                                style={{ backgroundColor: getColorDef(showEmpModal.color).ring }}
                            >
                                <i className="fa-solid fa-check ml-2"></i>
                                تم — حفظ التغييرات
                            </button>
                        </div>
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