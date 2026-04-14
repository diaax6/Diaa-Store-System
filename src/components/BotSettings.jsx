import { useState, useEffect, useCallback } from 'react';
import telegram from '../services/telegram';

// ── Notification types per group ─────────
const GROUPS = [
    {
        key    : 'notice',
        label  : '📣 Notice',
        labelAr: 'الإشعارات العامة',
        description: 'الطلبات • المشاكل • الدفع • حالة الأوردرات',
        color  : 'blue',
        icon   : 'fa-bell',
        chatId : '-1003976824578',
        types  : [
            { key: 'newSale',         label: 'أوردر جديد',         icon: 'fa-cart-shopping',        color: 'blue'   },
            { key: 'saleProcessing',  label: 'قيد التنفيذ',         icon: 'fa-gear',                 color: 'yellow' },
            { key: 'saleActivated',   label: 'تفعيل / إلغاء',       icon: 'fa-circle-check',         color: 'green'  },
            { key: 'debtPaid',        label: 'تم الدفع',            icon: 'fa-hand-holding-dollar',  color: 'emerald'},
            { key: 'saleRenewed',     label: 'تجديد اشتراك',        icon: 'fa-rotate',               color: 'cyan'   },
            { key: 'newProblem',      label: 'مشكلة جديدة',         icon: 'fa-triangle-exclamation', color: 'red'    },
            { key: 'problemResolved', label: 'حل مشكلة',            icon: 'fa-check-double',         color: 'teal'   },
        ],
    },
    {
        key    : 'stock',
        label  : '📦 Stock',
        labelAr: 'المخزون',
        description: 'الإضافة • السحب • التعديل • الحذف',
        color  : 'purple',
        icon   : 'fa-boxes-stacked',
        chatId : '-1003797989252',
        types  : [
            { key: 'stockAdded',      label: 'إضافة مخزون',        icon: 'fa-plus-circle',          color: 'purple' },
            { key: 'inventoryPulled', label: 'سحب من المخزون',     icon: 'fa-arrow-up-from-bracket', color: 'amber' },
            { key: 'stockEdited',     label: 'تعديل حالة عنصر',   icon: 'fa-pen-to-square',         color: 'orange' },
            { key: 'stockDeleted',    label: 'حذف من المخزون',     icon: 'fa-trash-can',             color: 'red'    },
        ],
    },
    {
        key    : 'sales',
        label  : '💰 Sales',
        labelAr: 'المبيعات والماليات',
        description: 'المصروفات • الإيرادات • التجديدات • المدفوعات',
        color  : 'green',
        icon   : 'fa-chart-line',
        chatId : '-5062101433',
        types  : [
            { key: 'expenseAdded',   label: 'مصروفات (إضافة / تعديل / حذف)', icon: 'fa-receipt',     color: 'rose'  },
            { key: 'salesFinancial', label: 'ملخص مالي للمبيعات والدفع',      icon: 'fa-coins',       color: 'green' },
        ],
    },
    {
        key    : 'report',
        label  : '📊 Report',
        labelAr: 'التقارير',
        description: 'يومي • أسبوعي • شهري — تلقائي كل 12 ليلاً',
        color  : 'indigo',
        icon   : 'fa-chart-bar',
        chatId : '-5158093362',
        types  : [
            { key: 'dailyReport',   label: 'تقرير يومي',   icon: 'fa-calendar-day',   color: 'indigo' },
            { key: 'weeklyReport',  label: 'تقرير أسبوعي', icon: 'fa-calendar-week',  color: 'violet' },
            { key: 'monthlyReport', label: 'تقرير شهري',   icon: 'fa-calendar',       color: 'fuchsia'},
        ],
    },
];

const COLOR = {
    blue    : { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', badge: '#3b82f6' },
    yellow  : { bg: '#fefce8', text: '#a16207', border: '#fde68a', badge: '#eab308' },
    green   : { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', badge: '#22c55e' },
    emerald : { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', badge: '#10b981' },
    cyan    : { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc', badge: '#06b6d4' },
    red     : { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', badge: '#ef4444' },
    teal    : { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4', badge: '#14b8a6' },
    purple  : { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff', badge: '#a855f7' },
    amber   : { bg: '#fffbeb', text: '#b45309', border: '#fde68a', badge: '#f59e0b' },
    orange  : { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', badge: '#f97316' },
    rose    : { bg: '#fff1f2', text: '#be123c', border: '#fecdd3', badge: '#f43f5e' },
    indigo  : { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe', badge: '#6366f1' },
    violet  : { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', badge: '#8b5cf6' },
    fuchsia : { bg: '#fdf4ff', text: '#a21caf', border: '#f0abfc', badge: '#d946ef' },
};

const GROUP_COLOR = {
    blue  : { grad: 'from-blue-900 to-blue-700',     ring: '#3b82f6', badge: '#60a5fa'  },
    purple: { grad: 'from-purple-900 to-purple-700', ring: '#a855f7', badge: '#c084fc'  },
    green : { grad: 'from-emerald-900 to-green-700', ring: '#22c55e', badge: '#4ade80'  },
    indigo: { grad: 'from-indigo-900 to-indigo-700', ring: '#6366f1', badge: '#818cf8'  },
};

export default function BotSettings() {
    useEffect(() => { window.scrollTo(0, 0); }, []);

    const [prefs,      setPrefs]      = useState(telegram.getPrefs());
    const [activeGroup, setActiveGroup] = useState('notice');
    const [testStatus,  setTestStatus]  = useState({}); // { [groupKey]: 'loading'|'success'|'error' }
    const [reportStatus, setReportStatus] = useState({}); // { daily|weekly|monthly: 'loading'|'success'|'error' }
    const [reportTimes,  setReportTimes]  = useState(telegram.getReportTimes());

    const refreshReportTimes = useCallback(() => setReportTimes(telegram.getReportTimes()), []);

    const togglePref = (key) => {
        const updated = { ...prefs, [key]: !prefs[key] };
        setPrefs(updated);
        telegram.savePrefs(updated);
    };

    const enableGroup  = (group) => {
        const keys = group.types.map(t => t.key);
        const updated = { ...prefs };
        keys.forEach(k => { updated[k] = true; });
        setPrefs(updated);
        telegram.savePrefs(updated);
    };
    const disableGroup = (group) => {
        const keys = group.types.map(t => t.key);
        const updated = { ...prefs };
        keys.forEach(k => { updated[k] = false; });
        setPrefs(updated);
        telegram.savePrefs(updated);
    };

    const testGroup = async (groupKey) => {
        setTestStatus(s => ({ ...s, [groupKey]: 'loading' }));
        const ok = await telegram.testGroup(groupKey);
        setTestStatus(s => ({ ...s, [groupKey]: ok ? 'success' : 'error' }));
        setTimeout(() => setTestStatus(s => ({ ...s, [groupKey]: null })), 3500);
    };

    const testAll = async () => {
        GROUPS.forEach(g => setTestStatus(s => ({ ...s, [g.key]: 'loading' })));
        const result = await telegram.testConnection();
        GROUPS.forEach(g => setTestStatus(s => ({ ...s, [g.key]: result.ok ? 'success' : 'error' })));
        setTimeout(() => setTestStatus({}), 3500);
    };

    const sendReport = async (type) => {
        setReportStatus(s => ({ ...s, [type]: 'loading' }));
        try {
            let ok;
            if      (type === 'daily')   ok = await telegram.sendDailyReport();
            else if (type === 'weekly')  ok = await telegram.sendWeeklyReport();
            else if (type === 'monthly') ok = await telegram.sendMonthlyReport();
            setReportStatus(s => ({ ...s, [type]: ok ? 'success' : 'error' }));
            refreshReportTimes();
        } catch {
            setReportStatus(s => ({ ...s, [type]: 'error' }));
        }
        setTimeout(() => setReportStatus(s => ({ ...s, [type]: null })), 4000);
    };

    const totalActive = Object.values(prefs).filter(Boolean).length;
    const totalKeys   = GROUPS.flatMap(g => g.types.map(t => t.key)).length;

    const activeGroupData = GROUPS.find(g => g.key === activeGroup) || GROUPS[0];
    const gc = GROUP_COLOR[activeGroupData.color] || GROUP_COLOR.blue;

    const fmtTime = (iso) => {
        if (!iso) return null;
        return new Date(iso).toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
    };

    return (
        <div className="space-y-5 animate-fade-in pb-24 font-sans text-slate-800">

            {/* ── Header ── */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute -left-8 -bottom-8 text-[110px] opacity-[0.04]">
                    <i className="fa-brands fa-telegram" />
                </div>
                <div className="absolute right-6 top-6 opacity-10 text-6xl">
                    <i className="fa-solid fa-robot" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="bg-blue-500/20 p-3 rounded-xl border border-blue-400/20 backdrop-blur-sm">
                            <i className="fa-brands fa-telegram text-2xl text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-extrabold">إعدادات بوت تليجرام</h2>
                            <p className="text-slate-400 text-xs font-medium mt-0.5">4 جروبات متخصصة — كل إشعار في مكانه الصح</p>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-3">
                        {[
                            { label: 'الإشعارات النشطة', value: `${totalActive} / ${totalKeys}` },
                            { label: 'الجروبات', value: '4 جروبات' },
                            { label: 'الحالة', value: '🟢 متصل' },
                        ].map(s => (
                            <div key={s.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                                <p className="text-slate-400 text-[10px] font-bold mb-0.5">{s.label}</p>
                                <p className="text-lg font-black">{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Test All */}
                    <div className="mt-4 flex gap-2 flex-wrap">
                        <button
                            onClick={testAll}
                            className="bg-blue-500 hover:bg-blue-400 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-900/40"
                        >
                            <i className="fa-solid fa-satellite-dish" /> اختبار كل الجروبات
                        </button>
                    </div>
                </div>
            </div>

            {/* ── 4 Group Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {GROUPS.map(g => {
                    const gc2    = GROUP_COLOR[g.color] || GROUP_COLOR.blue;
                    const isActive = activeGroup === g.key;
                    const ts     = testStatus[g.key];
                    const groupEnabled = g.types.some(t => prefs[t.key] !== false);

                    return (
                        <div
                            key={g.key}
                            onClick={() => setActiveGroup(g.key)}
                            className={`rounded-2xl p-4 cursor-pointer transition-all border-2 ${
                                isActive
                                    ? 'bg-slate-900 text-white border-transparent shadow-xl'
                                    : 'bg-white hover:shadow-md border-slate-100 hover:border-slate-200'
                            }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base ${
                                    isActive ? 'bg-white/15' : 'bg-slate-100'
                                }`}>
                                    <i className={`fa-solid ${g.icon} ${isActive ? 'text-white' : 'text-slate-600'}`} />
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    groupEnabled
                                        ? (isActive ? 'bg-green-400/20 text-green-300' : 'bg-green-100 text-green-700')
                                        : (isActive ? 'bg-red-400/20 text-red-300' : 'bg-red-100 text-red-700')
                                }`}>
                                    {groupEnabled ? 'ON' : 'OFF'}
                                </span>
                            </div>
                            <p className={`font-extrabold text-sm ${isActive ? 'text-white' : 'text-slate-800'}`}>{g.label}</p>
                            <p className={`text-[10px] mt-0.5 leading-relaxed ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>{g.labelAr}</p>

                            {/* Group test button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); testGroup(g.key); }}
                                disabled={ts === 'loading'}
                                className={`mt-3 w-full text-[10px] font-bold py-1.5 rounded-lg transition-all ${
                                    ts === 'success' ? 'bg-green-500 text-white' :
                                    ts === 'error'   ? 'bg-red-500 text-white' :
                                    ts === 'loading' ? 'bg-slate-400 text-white cursor-wait' :
                                    isActive         ? 'bg-white/20 text-white hover:bg-white/30'
                                                     : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {ts === 'loading' ? <><i className="fa-solid fa-spinner fa-spin" /> جاري...</> :
                                 ts === 'success' ? <><i className="fa-solid fa-check" /> تم</>  :
                                 ts === 'error'   ? <><i className="fa-solid fa-xmark" /> فشل</> :
                                 <><i className="fa-solid fa-paper-plane" /> اختبار</>}
                            </button>

                            {/* Chat ID badge */}
                            <p className={`text-[9px] mt-2 font-mono truncate ${isActive ? 'text-slate-500' : 'text-slate-400'}`}>
                                {g.chatId}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* ── Group Detail Panel ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                {/* Group Header */}
                <div className={`bg-gradient-to-r ${gc.grad} p-5 text-white`}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/15 p-2.5 rounded-xl">
                                <i className={`fa-solid ${activeGroupData.icon} text-lg`} />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-base">{activeGroupData.label} — {activeGroupData.labelAr}</h3>
                                <p className="text-white/60 text-xs mt-0.5">{activeGroupData.description}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => enableGroup(activeGroupData)}
                                className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                            >
                                <i className="fa-solid fa-toggle-on mr-1" /> تفعيل الكل
                            </button>
                            <button
                                onClick={() => disableGroup(activeGroupData)}
                                className="bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                            >
                                <i className="fa-solid fa-toggle-off mr-1" /> إيقاف الكل
                            </button>
                        </div>
                    </div>
                </div>

                {/* Notification Toggles */}
                {activeGroup !== 'report' && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeGroupData.types.map(nt => {
                            const c   = COLOR[nt.color] || COLOR.indigo;
                            const isOn = prefs[nt.key] !== false;
                            return (
                                <div
                                    key={nt.key}
                                    onClick={() => togglePref(nt.key)}
                                    className="flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all select-none"
                                    style={{
                                        borderColor     : isOn ? c.border : '#e2e8f0',
                                        backgroundColor : isOn ? c.bg     : '#f8fafc',
                                        opacity         : isOn ? 1 : 0.65,
                                    }}
                                >
                                    {/* Icon */}
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                                        style={{ backgroundColor: c.badge, color: '#fff' }}
                                    >
                                        <i className={`fa-solid ${nt.icon} text-sm`} />
                                    </div>
                                    {/* Label */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm truncate" style={{ color: isOn ? c.text : '#64748b' }}>{nt.label}</p>
                                        <p className="text-[10px] mt-0.5" style={{ color: isOn ? c.text + '99' : '#94a3b8' }}>
                                            {isOn ? 'مفعّل' : 'موقف'}
                                        </p>
                                    </div>
                                    {/* Toggle pill */}
                                    <div
                                        className="relative w-11 h-6 rounded-full flex-shrink-0 transition-all duration-200"
                                        style={{ backgroundColor: isOn ? c.badge : '#cbd5e1' }}
                                    >
                                        <div
                                            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200"
                                            style={{ left: isOn ? '22px' : '2px' }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Report Group Special UI ── */}
                {activeGroup === 'report' && (
                    <div className="p-5 space-y-5">

                        {/* Schedule Info */}
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <i className="fa-solid fa-clock text-indigo-600" />
                                <h4 className="font-extrabold text-indigo-800 text-sm">جدول الإرسال التلقائي</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                {[
                                    { icon: 'fa-calendar-day',  label: 'يومي',    desc: 'كل يوم',       time: '12:00 ليلاً',     key: 'daily'   },
                                    { icon: 'fa-calendar-week', label: 'أسبوعي',  desc: 'كل الأحد',     time: '12:00 ليلاً',     key: 'weekly'  },
                                    { icon: 'fa-calendar',      label: 'شهري',    desc: 'أول كل شهر',   time: '12:00 ليلاً',     key: 'monthly' },
                                ].map(s => (
                                    <div key={s.key} className="bg-white rounded-xl p-3 border border-indigo-100">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <i className={`fa-solid ${s.icon} text-indigo-500`} />
                                            <span className="font-extrabold text-indigo-700">{s.label}</span>
                                        </div>
                                        <p className="text-slate-500">{s.desc} • <b className="text-slate-700">{s.time}</b></p>
                                        {reportTimes[`lastManual${s.key.charAt(0).toUpperCase() + s.key.slice(1)}`] && (
                                            <p className="text-slate-400 text-[10px] mt-1">
                                                آخر إرسال يدوي: {fmtTime(reportTimes[`lastManual${s.key.charAt(0).toUpperCase() + s.key.slice(1)}`])}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Instant Report Buttons */}
                        <div>
                            <h4 className="font-extrabold text-slate-700 text-sm mb-3 flex items-center gap-2">
                                <i className="fa-solid fa-bolt text-amber-500" />
                                إرسال تقرير فوري الآن
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { key: 'daily',   label: 'تقرير يومي',   icon: 'fa-calendar-day',  color: 'indigo',  desc: 'أرباح ومصروفات اليوم الحالي' },
                                    { key: 'weekly',  label: 'تقرير أسبوعي', icon: 'fa-calendar-week', color: 'violet',  desc: 'ملخص الأسبوع الحالي' },
                                    { key: 'monthly', label: 'تقرير شهري',   icon: 'fa-calendar',      color: 'fuchsia', desc: 'ملخص الشهر الحالي' },
                                ].map(r => {
                                    const rs  = reportStatus[r.key];
                                    const c   = COLOR[r.color] || COLOR.indigo;
                                    const pref = r.key === 'daily' ? 'dailyReport' : r.key === 'weekly' ? 'weeklyReport' : 'monthlyReport';
                                    const isOn = prefs[pref] !== false;

                                    return (
                                        <div key={r.key} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div
                                                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                                                    style={{ backgroundColor: c.bg, color: c.text }}
                                                >
                                                    <i className={`fa-solid ${r.icon} text-sm`} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-extrabold text-slate-800 text-sm">{r.label}</p>
                                                    <p className="text-slate-500 text-[10px]">{r.desc}</p>
                                                </div>
                                                {/* Enable toggle */}
                                                <div
                                                    onClick={() => togglePref(pref)}
                                                    className="relative w-9 h-5 rounded-full flex-shrink-0 cursor-pointer transition-all"
                                                    style={{ backgroundColor: isOn ? c.badge : '#cbd5e1' }}
                                                >
                                                    <div
                                                        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                                                        style={{ left: isOn ? '17px' : '2px' }}
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => sendReport(r.key)}
                                                disabled={rs === 'loading'}
                                                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                                                    rs === 'success' ? 'bg-green-500 text-white' :
                                                    rs === 'error'   ? 'bg-red-500 text-white' :
                                                    rs === 'loading' ? 'bg-slate-300 text-slate-500 cursor-wait' :
                                                    'text-white shadow-md'
                                                }`}
                                                style={!rs ? { backgroundColor: c.badge } : {}}
                                            >
                                                {rs === 'loading' ? <><i className="fa-solid fa-spinner fa-spin" /> يتم التوليد...</> :
                                                 rs === 'success' ? <><i className="fa-solid fa-check" /> تم الإرسال ✅</> :
                                                 rs === 'error'   ? <><i className="fa-solid fa-xmark" /> فشل الإرسال</> :
                                                 <><i className="fa-solid fa-paper-plane" /> إرسال الآن</>}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Report Content Info */}
                        <div className="bg-slate-800 text-white rounded-xl p-4 text-xs space-y-2">
                            <p className="font-extrabold text-slate-200 mb-2 flex items-center gap-1.5">
                                <i className="fa-solid fa-circle-info text-blue-400" /> محتوى التقارير
                            </p>
                            {[
                                '📈  إجمالي الإيرادات (كل المبيعات)',
                                '📉  إجمالي المصروفات',
                                '✅  صافي الربح = الإيرادات - المصروفات',
                                '📦  عدد الطلبات',
                                '👤  أداء كل موظف: أوردرات — تفعيلات — سحبات من المخزون',
                            ].map(l => (
                                <p key={l} className="text-slate-400 leading-relaxed">{l}</p>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Groups Overview Cards ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h3 className="font-extrabold text-slate-700 text-sm mb-4 flex items-center gap-2">
                    <i className="fa-brands fa-telegram text-blue-500" /> نظرة عامة على الجروبات
                </h3>
                <div className="space-y-3">
                    {GROUPS.map(g => {
                        const activeCount  = g.types.filter(t => prefs[t.key] !== false).length;
                        const totalCount   = g.types.length;
                        const pct          = Math.round((activeCount / totalCount) * 100);
                        const gc2          = GROUP_COLOR[g.color] || GROUP_COLOR.blue;

                        return (
                            <div
                                key={g.key}
                                onClick={() => setActiveGroup(g.key)}
                                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 cursor-pointer transition-all"
                            >
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: gc2.ring }}>
                                    <i className={`fa-solid ${g.icon}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-sm text-slate-800">{g.label} — {g.labelAr}</span>
                                        <span className="text-xs text-slate-500 font-mono">{activeCount}/{totalCount} نشط</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${pct}%`, backgroundColor: gc2.ring }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{g.chatId}</p>
                                </div>
                                <i className="fa-solid fa-chevron-left text-slate-300 text-xs" />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Info Box ── */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <div className="flex gap-3">
                    <div className="bg-blue-100 p-2 rounded-xl text-blue-600 flex-shrink-0 h-fit">
                        <i className="fa-solid fa-circle-info" />
                    </div>
                    <div className="text-xs text-blue-800">
                        <p className="font-extrabold mb-2">ملاحظات مهمة</p>
                        <ul className="space-y-1.5 text-blue-700">
                            <li>• الإعدادات تتحفظ على <strong>هذا الجهاز فقط</strong> — كل جهاز ليه إعداداته</li>
                            <li>• التقارير التلقائية بتتبعت لو التطبيق مفتوح على الجهاز الساعة 12 ليلاً</li>
                            <li>• جروب <strong>Notice</strong>: الطلبات والمشاكل | <strong>Stock</strong>: المخزون | <strong>Sales</strong>: الماليات | <strong>Report</strong>: التقارير</li>
                            <li>• عدد سحبات الموظفين من المخزون بيتتبع تلقائياً ويظهر في التقارير</li>
                        </ul>
                    </div>
                </div>
            </div>

            <style>{`
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
