import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../context/DataContext';
import { useLang } from '../i18n/index';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

// ─── Date Preset Helpers ──────────────────────────────────────────────────────
const startOf = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const endOf   = (d) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; };

const PRESETS = [
    { id: 'all',     label: 'الكل' },
    { id: 'today',   label: 'اليوم' },
    { id: 'week',    label: 'آخر 7 أيام' },
    { id: 'month',   label: 'آخر 30 يوم' },
    { id: 'curMonth',label: 'هذا الشهر' },
    { id: 'year',    label: 'هذا العام' },
    { id: 'custom',  label: 'مخصص' },
];

function getPresetRange(presetId) {
    const now = new Date();
    switch (presetId) {
        case 'today':    return { start: startOf(now), end: endOf(now) };
        case 'week':     return { start: startOf(new Date(now - 6 * 86400000)), end: endOf(now) };
        case 'month':    return { start: startOf(new Date(now - 29 * 86400000)), end: endOf(now) };
        case 'curMonth': return { start: startOf(new Date(now.getFullYear(), now.getMonth(), 1)), end: endOf(now) };
        case 'year':     return { start: startOf(new Date(now.getFullYear(), 0, 1)), end: endOf(now) };
        default:         return null; // 'all' or 'custom'
    }
}

// ─── Smart Granularity ───────────────────────────────────────────────────────
function getGranularity(start, end) {
    if (!start || !end) return 'monthly';
    const diffDays = (end - start) / 86400000;
    if (diffDays <= 31)  return 'daily';
    if (diffDays <= 365) return 'weekly';
    return 'monthly';
}

const GRANULARITY_LABEL = { daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري' };

function getChartKey(date, granularity) {
    const d = new Date(date);
    if (granularity === 'daily') {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (granularity === 'weekly') {
        // ISO week number
        const tmp = new Date(d); tmp.setHours(0, 0, 0, 0);
        tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
        const week1 = new Date(tmp.getFullYear(), 0, 4);
        const wn = 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
        return `${tmp.getFullYear()}-W${String(wn).padStart(2, '0')}`;
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Reports() {
    useEffect(() => { window.scrollTo(0, 0); }, []);

    const { sales, expenses, products } = useData();
    const { t } = useLang();

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [activePreset, setActivePreset]       = useState('all');
    const [customStart, setCustomStart]         = useState('');
    const [customEnd, setCustomEnd]             = useState('');

    // ── Effective date range ──
    const dateRange = useMemo(() => {
        if (activePreset === 'custom') {
            return {
                start: customStart ? startOf(new Date(customStart)) : null,
                end:   customEnd   ? endOf(new Date(customEnd))     : null,
            };
        }
        return getPresetRange(activePreset) || { start: null, end: null };
    }, [activePreset, customStart, customEnd]);

    const inRange = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end   && d > dateRange.end)   return false;
        return true;
    };

    // ── Filtered datasets ──
    const filteredSales    = useMemo(() => (!dateRange.start && !dateRange.end) ? sales    : sales.filter(s => inRange(s.date)),    [sales,    dateRange]);
    const filteredExpenses = useMemo(() => (!dateRange.start && !dateRange.end) ? expenses : expenses.filter(e => inRange(e.date)), [expenses, dateRange]);

    // ── Granularity ──
    const granularity = useMemo(() => getGranularity(dateRange.start, dateRange.end), [dateRange]);

    // ── KPI Stats ──
    const kpi = useMemo(() => {
        const revenue  = filteredSales.reduce((s, x) => s + Number(x.finalPrice || x.sellingPrice || 0), 0);
        const paidExp  = filteredExpenses.filter(e => (e.approvalStatus || e.approval_status || 'pending') === 'paid');
        const expenses_total = paidExp.reduce((s, e) => s + Number(e.amount || 0), 0);
        const profit   = revenue - expenses_total;
        const paid     = filteredSales.filter(s => s.isPaid).length;
        return { revenue, expenses: expenses_total, profit, count: filteredSales.length, paid, unpaid: filteredSales.length - paid };
    }, [filteredSales, filteredExpenses]);

    // ── Line Chart Data (smart granularity) ──
    const lineChartData = useMemo(() => {
        const dataMap = {};
        filteredSales.forEach(sale => {
            const key = getChartKey(sale.date, granularity);
            if (!dataMap[key]) dataMap[key] = { revenue: 0, expense: 0 };
            dataMap[key].revenue += Number(sale.finalPrice || sale.sellingPrice || 0);
        });
        const paidExp = filteredExpenses.filter(e => (e.approvalStatus || e.approval_status || 'pending') === 'paid');
        paidExp.forEach(exp => {
            const key = getChartKey(exp.date, granularity);
            if (!dataMap[key]) dataMap[key] = { revenue: 0, expense: 0 };
            dataMap[key].expense += Number(exp.amount || 0);
        });
        const keys = Object.keys(dataMap).sort();
        return {
            labels: keys,
            datasets: [
                { label: 'الدخل',       data: keys.map(k => dataMap[k].revenue),                         borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.08)',  tension: 0.35, fill: true, pointRadius: keys.length <= 14 ? 4 : 2 },
                { label: 'المصروفات',   data: keys.map(k => dataMap[k].expense),                         borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)',  tension: 0.35, fill: true, pointRadius: keys.length <= 14 ? 4 : 2 },
                { label: 'صافي الربح',  data: keys.map(k => dataMap[k].revenue - dataMap[k].expense),    borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', tension: 0.35, fill: true, pointRadius: keys.length <= 14 ? 4 : 2 },
            ],
        };
    }, [filteredSales, filteredExpenses, granularity]);

    // ── Bar Chart Data ──
    const barChartData = useMemo(() => {
        const profitMap = {};
        filteredSales.forEach(sale => {
            profitMap[sale.productName] = (profitMap[sale.productName] || 0) + Number(sale.finalPrice || sale.sellingPrice || 0);
        });
        const sorted = Object.entries(profitMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
        return {
            labels: sorted.map(p => p[0]),
            datasets: [{ label: 'الإيرادات', data: sorted.map(p => p[1]), backgroundColor: 'rgba(99,102,241,0.8)', borderRadius: 4 }],
        };
    }, [filteredSales]);

    // ── Doughnut Chart Data ──
    const doughnutData = useMemo(() => {
        const typeMap = {};
        const paidExp = filteredExpenses.filter(e => (e.approvalStatus || e.approval_status || 'pending') === 'paid');
        paidExp.forEach(exp => {
            const type = exp.type || 'أخرى';
            typeMap[type] = (typeMap[type] || 0) + Number(exp.amount || 0);
        });
        return {
            labels: Object.keys(typeMap),
            datasets: [{
                data: Object.values(typeMap),
                backgroundColor: ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'],
                borderWidth: 0,
            }],
        };
    }, [filteredExpenses]);

    // ── Product Summary ──
    const productsSummary = useMemo(() => {
        if (!products || products.length === 0) return [];
        return products.map(product => {
            const productSales = filteredSales.filter(s => s.productName === product.name);
            const revenue = productSales.reduce((sum, s) => sum + Number(s.finalPrice || s.sellingPrice || 0), 0);
            return { id: product.id, name: product.name, count: productSales.length, revenue };
        }).sort((a, b) => b.count - a.count);
    }, [products, filteredSales]);

    const hasData     = filteredSales.length > 0;
    const isFiltered  = activePreset !== 'all';
    const chartOpts   = { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { borderDash: [2, 4], color: '#f1f5f9' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } };

    const handleReset = () => { setActivePreset('all'); setCustomStart(''); setCustomEnd(''); };

    return (
        <div className="space-y-6 animate-fade-in pb-20 font-sans">

            {/* ── Header ── */}
            <div className="ph-bar">
                <div className="flex items-center gap-3">
                    <div className="ph-icon"><i className="fa-solid fa-chart-line text-sm"></i></div>
                    <div>
                        <h1 className="ph-title">{t('reports_title')}</h1>
                        <p className="ph-sub">{t('reports_subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="ds-badge ds-info">{products.length} منتج</span>
                    <span className="ds-badge ds-ok">{filteredSales.length} / {sales.length} أوردر</span>
                </div>
            </div>

            {/* ── Date Filter Bar ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3">
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Preset Pills */}
                    <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                        {PRESETS.filter(p => p.id !== 'custom').map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setActivePreset(p.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                    activePreset === p.id
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >{p.label}</button>
                        ))}

                        {/* Custom Range Toggle */}
                        <button
                            type="button"
                            onClick={() => setActivePreset('custom')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 ${
                                activePreset === 'custom'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <i className="fa-solid fa-calendar-days text-[10px]"></i>
                            مخصص
                        </button>
                    </div>

                    {/* Reset */}
                    {isFiltered && (
                        <button
                            type="button"
                            onClick={handleReset}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center gap-1 flex-shrink-0"
                        >
                            <i className="fa-solid fa-rotate-right text-[10px]"></i>
                            إعادة ضبط
                        </button>
                    )}
                </div>

                {/* Custom Date Inputs */}
                {activePreset === 'custom' && (
                    <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">من تاريخ</label>
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                                className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-indigo-400 bg-slate-50 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">إلى تاريخ</label>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                                className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-indigo-400 bg-slate-50 transition-colors" />
                        </div>
                    </div>
                )}
            </div>

            {/* ── No Data in Period ── */}
            {isFiltered && !hasData && (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                    <i className="fa-solid fa-magnifying-glass-chart text-5xl text-slate-300 mb-4 block"></i>
                    <p className="text-lg font-bold text-slate-500">لا توجد بيانات في هذه الفترة</p>
                    <p className="text-sm text-slate-400 mt-1 mb-4">جرب فترة زمنية مختلفة أو</p>
                    <button type="button" onClick={handleReset}
                        className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm border border-indigo-200 hover:bg-indigo-100 transition-all inline-flex items-center gap-2">
                        <i className="fa-solid fa-rotate-right text-xs"></i>
                        عرض كل البيانات
                    </button>
                </div>
            )}

            {/* ── KPI Cards (filtered) ── */}
            {hasData && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="stat-card stat-indigo">
                        <span className="stat-card-lbl">{t('dash_orders')}</span>
                        <span className="stat-card-val">{kpi.count}</span>
                        <span className="stat-card-sub">{kpi.paid} {t('status_paid')} / {kpi.unpaid} {t('status_unpaid')}</span>
                    </div>
                    <div className="stat-card stat-emerald">
                        <span className="stat-card-lbl">{t('reports_revenue')}</span>
                        <span className="stat-card-val dir-ltr">{kpi.revenue.toLocaleString('en-US')}</span>
                        <span className="stat-card-sub">{t('lbl_egp')}</span>
                    </div>
                    <div className={`stat-card ${kpi.profit >= 0 ? 'stat-emerald' : 'stat-red'}`}>
                        <span className="stat-card-lbl">{t('reports_net_profit')}</span>
                        <span className={`stat-card-val dir-ltr ${kpi.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{kpi.profit.toLocaleString('en-US')}</span>
                        <span className="stat-card-sub">{t('lbl_egp')}</span>
                    </div>
                    <div className="stat-card stat-red">
                        <span className="stat-card-lbl">{t('reports_expenses')}</span>
                        <span className="stat-card-val dir-ltr">{kpi.expenses.toLocaleString('en-US')}</span>
                        <span className="stat-card-sub">{t('lbl_egp')}</span>
                    </div>
                    <div className="stat-card stat-blue">
                        <span className="stat-card-lbl">{t('reports_avg_order')}</span>
                        <span className="stat-card-val dir-ltr">{kpi.count > 0 ? Math.round(kpi.revenue / kpi.count).toLocaleString('en-US') : 0}</span>
                        <span className="stat-card-sub">{t('lbl_egp')}</span>
                    </div>
                    <div className="stat-card stat-amber">
                        <span className="stat-card-lbl">{t('reports_collection_rate')}</span>
                        <span className="stat-card-val">{kpi.count > 0 ? Math.round((kpi.paid / kpi.count) * 100) : 0}%</span>
                        <span className="stat-card-sub">{t('dash_orders')}</span>
                    </div>
                </div>
            )}

            {/* ── Product Summary Grid ── */}
            <div>
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-layer-group text-indigo-500"></i>
                    تحليل البرامج
                    {isFiltered && <span className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">في الفترة المحددة</span>}
                </h3>

                {productsSummary.filter(p => p.count > 0).length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center text-slate-400">
                        <i className="fa-solid fa-chart-bar text-5xl mb-4 block opacity-30"></i>
                        <p className="font-bold text-lg">{isFiltered ? 'لا توجد مبيعات في هذه الفترة' : 'لا توجد بيانات بعد'}</p>
                        <p className="text-sm mt-1">{isFiltered ? 'جرب تغيير نطاق التاريخ' : 'أضف منتجات ومبيعات لعرض التقارير'}</p>
                        {isFiltered && (
                            <button type="button" onClick={handleReset}
                                className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs border border-indigo-200 hover:bg-indigo-100 transition-all inline-flex items-center gap-1.5">
                                <i className="fa-solid fa-rotate-right text-[10px]"></i>
                                عرض الكل
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {productsSummary.filter(p => p.count > 0).map(prod => (
                            <div
                                key={prod.id}
                                onClick={() => setSelectedProduct(prod.name)}
                                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-200 hover:-translate-y-1 cursor-pointer transition-all duration-300 group relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg border border-indigo-100 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            {prod.name.charAt(0).toUpperCase()}
                                        </div>
                                        <h4 className="font-bold text-slate-700 text-lg group-hover:text-indigo-700 transition-colors">{prod.name}</h4>
                                    </div>
                                    <div className="bg-slate-50 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-indigo-500 group-hover:shadow transition-all">
                                        <i className="fa-solid fa-arrow-left text-sm transform group-hover:-translate-x-1 transition-transform"></i>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-center">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 tracking-wider">العمليات</span>
                                        <span className="text-xl font-black text-slate-800">{prod.count}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 tracking-wider">الإيرادات</span>
                                        <span className="text-sm font-bold text-emerald-600 dir-ltr bg-emerald-50 px-2 py-0.5 rounded">{Number(prod.revenue).toLocaleString('en-US')}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <hr className="border-slate-200 border-dashed" />

            {/* ── Charts ── */}
            {hasData ? (
                <>
                    {/* Line Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
                            <h3 className="text-lg font-bold text-slate-800 border-r-4 border-indigo-500 pr-3">
                                الأداء المالي
                                <span className="text-xs font-normal text-slate-400 mr-2">({GRANULARITY_LABEL[granularity]})</span>
                            </h3>
                            <div className="flex gap-3 flex-wrap">
                                <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>دخل</span>
                                <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>صرف</span>
                                <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>ربح</span>
                            </div>
                        </div>
                        {lineChartData.labels.length === 0 ? (
                            <div className="h-80 flex items-center justify-center text-slate-400">
                                <div className="text-center"><i className="fa-solid fa-chart-line text-4xl opacity-30 block mb-2"></i><p className="text-sm font-bold">لا توجد بيانات كافية للرسم البياني</p></div>
                            </div>
                        ) : (
                            <div className="h-80"><Line data={lineChartData} options={chartOpts} /></div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Bar Chart */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <i className="fa-solid fa-ranking-star text-amber-500"></i>
                                أكثر المنتجات إيراداً
                            </h3>
                            {barChartData.labels.length === 0 ? (
                                <div className="h-64 flex items-center justify-center text-slate-400">
                                    <div className="text-center"><i className="fa-solid fa-chart-bar text-4xl opacity-30 block mb-2"></i><p className="text-sm font-bold">لا توجد مبيعات</p></div>
                                </div>
                            ) : (
                                <div className="h-64">
                                    <Bar data={barChartData} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { grid: { display: false } } }, plugins: { legend: { display: false } } }} />
                                </div>
                            )}
                        </div>

                        {/* Doughnut Chart */}
                        {filteredExpenses.filter(e => (e.approvalStatus || e.approval_status || 'pending') === 'paid').length > 0 ? (
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <i className="fa-solid fa-wallet text-red-500"></i>
                                    توزيع المصروفات
                                </h3>
                                <div className="h-64 flex justify-center relative">
                                    <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } } } } }} />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-xs font-bold text-slate-400">المصروفات</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
                                <div className="text-center text-slate-400">
                                    <i className="fa-solid fa-wallet text-4xl opacity-30 block mb-2"></i>
                                    <p className="text-sm font-bold">لا توجد مصروفات مؤكدة</p>
                                    <p className="text-xs mt-1">في الفترة المحددة</p>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                !isFiltered && (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                        <i className="fa-solid fa-chart-line text-5xl text-slate-300 mb-4 block"></i>
                        <p className="text-lg font-bold text-slate-500">لا توجد مبيعات بعد</p>
                        <p className="text-sm text-slate-400 mt-1">أضف مبيعات لعرض الرسوم البيانية</p>
                    </div>
                )
            )}

            {/* ── Product Detail Modal (unchanged) ── */}
            {selectedProduct && (
                <ProductAnalysisModal
                    productName={selectedProduct}
                    sales={sales}
                    onClose={() => setSelectedProduct(null)}
                />
            )}

            <style>{`
                .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}

// ─── Product Detail Modal (unchanged from original) ─────────────────────────
const ProductAnalysisModal = ({ productName, sales, onClose }) => {
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const filteredData = useMemo(() => {
        return sales.filter(s => {
            if (s.productName !== productName) return false;
            if (dateRange.start && new Date(s.date) < new Date(dateRange.start)) return false;
            if (dateRange.end) {
                const end = new Date(dateRange.end);
                end.setHours(23, 59, 59);
                if (new Date(s.date) > end) return false;
            }
            return true;
        });
    }, [sales, productName, dateRange]);

    const stats = useMemo(() => {
        const count = filteredData.length;
        const revenue = filteredData.reduce((sum, s) => sum + Number(s.finalPrice || s.sellingPrice || 0), 0);
        const paid = filteredData.filter(s => s.isPaid).length;
        const unpaid = count - paid;
        return { count, revenue, paid, unpaid };
    }, [filteredData]);

    const durationStats = useMemo(() => {
        const stats = {};
        filteredData.forEach(s => {
            const duration = s.duration ? `${s.duration} يوم` : (s.subscription || 'غير محدد');
            if (!stats[duration]) stats[duration] = { name: duration, count: 0, revenue: 0 };
            stats[duration].count++;
            stats[duration].revenue += Number(s.finalPrice || s.sellingPrice || 0);
        });
        return Object.values(stats).sort((a, b) => b.count - a.count);
    }, [filteredData]);

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" style={{direction:'rtl',fontFamily:'Cairo,sans-serif'}}>
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all scale-100">

                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-lg shadow-indigo-200">
                            {productName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-800">تقرير {productName}</h2>
                            <p className="text-xs text-slate-500 font-medium">تحليل المبيعات المفصل</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition"><i className="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/50">

                    <div className="bg-white border border-slate-200 p-5 rounded-2xl mb-6 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full"><label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">من تاريخ</label><input type="date" className="form-input w-full bg-slate-50 border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} /></div>
                        <div className="flex-1 w-full"><label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">إلى تاريخ</label><input type="date" className="form-input w-full bg-slate-50 border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} /></div>
                        <button onClick={() => { setDateRange({ start: '', end: '' }); }} className="bg-white border border-slate-200 text-slate-500 px-4 py-2.5 rounded-xl hover:bg-slate-50 hover:text-slate-700 transition shadow-sm h-[42px]"><i className="fa-solid fa-rotate-right"></i></button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                            <span className="text-xs text-indigo-500 font-bold block mb-1 uppercase tracking-wider relative z-10">العدد</span>
                            <span className="text-3xl font-black text-slate-800 relative z-10">{stats.count}</span>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                            <span className="text-xs text-emerald-600 font-bold block mb-1 uppercase tracking-wider relative z-10">الإيرادات</span>
                            <span className="text-2xl font-black text-slate-800 dir-ltr relative z-10">{stats.revenue.toLocaleString('en-US')}</span>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                            <span className="text-xs text-blue-600 font-bold block mb-1 uppercase tracking-wider relative z-10">مدفوع</span>
                            <span className="text-2xl font-black text-emerald-600 relative z-10">{stats.paid}</span>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                            <span className="text-xs text-red-600 font-bold block mb-1 uppercase tracking-wider relative z-10">غير مدفوع</span>
                            <span className="text-2xl font-black text-red-600 relative z-10">{stats.unpaid}</span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h4 className="font-bold text-slate-700 mb-3 text-sm flex items-center gap-2">
                            <i className="fa-solid fa-chart-pie text-indigo-500"></i> تفاصيل مدد الاشتراكات
                        </h4>
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-xs text-right">
                                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                    <tr><th className="p-3">المدة</th><th className="p-3 text-center">العدد</th><th className="p-3 text-center">الإيرادات</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {durationStats.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 font-bold text-slate-700">{item.name}</td>
                                            <td className="p-3 text-center font-bold text-indigo-700">{item.count}</td>
                                            <td className="p-3 text-center font-bold text-emerald-700">{item.revenue.toLocaleString('en-US')}</td>
                                        </tr>
                                    ))}
                                    {durationStats.length === 0 && (
                                        <tr><td colSpan="3" className="p-4 text-center text-slate-400">لا توجد بيانات</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                <tr><th className="p-4">التاريخ</th><th className="p-4">العميل</th><th className="p-4">الحالة</th><th className="p-4">السعر</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredData.length === 0 ? (
                                    <tr><td colSpan="4" className="p-8 text-center text-slate-400">لا توجد مبيعات تطابق الفلتر</td></tr>
                                ) : (
                                    filteredData.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-4 font-mono text-slate-500 text-xs">{new Date(s.date).toLocaleDateString('en-GB')}</td>
                                            <td className="p-4 font-bold text-slate-700">{s.customerEmail || s.customerName || '-'}</td>
                                            <td className="p-4"><span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${s.isPaid ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20' : 'bg-red-50 text-red-700 ring-1 ring-red-500/20'}`}>{s.isPaid ? 'مدفوع' : 'غير مدفوع'}</span></td>
                                            <td className="p-4 font-bold dir-ltr text-slate-800">{Number(s.finalPrice || s.sellingPrice || 0).toLocaleString('en-US')}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    , document.body);
};
