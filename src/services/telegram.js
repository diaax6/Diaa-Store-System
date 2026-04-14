// ==========================================
// Telegram Bot Notification Service v8
// - 4 dedicated group channels
//   ► notice  : orders, problems, payments, status
//   ► stock   : all inventory movements
//   ► sales   : all financial movements + expenses
//   ► report  : daily / weekly / monthly reports
// - Employee performance tracking
// - Auto-scheduled reports (midnight)
// ==========================================

import { supabase } from '../lib/supabase';

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '';

// ── Group Chat IDs ────────────────────────
const CHAT_IDS = {
    notice : import.meta.env.VITE_TELEGRAM_NOTICE_ID  || '-1003976824578',
    stock  : import.meta.env.VITE_TELEGRAM_STOCK_ID   || '-1003797989252',
    sales  : import.meta.env.VITE_TELEGRAM_SALES_ID   || '-5062101433',
    report : import.meta.env.VITE_TELEGRAM_REPORT_ID  || '-5158093362',
};

// ── LocalStorage Keys ─────────────────────
const PREFS_KEY        = 'ds_telegram_prefs';
const MSG_STORE_KEY    = 'ds_telegram_msgs';
const PULLS_LOG_KEY    = 'ds_pulls_log';
const REPORT_TIMES_KEY = 'ds_report_times';

// ── Default Preferences ───────────────────
const DEFAULT_PREFS = {
    // Notice group
    newSale         : true,
    saleProcessing  : true,
    saleActivated   : true,
    debtPaid        : true,
    saleRenewed     : true,
    newProblem      : true,
    problemResolved : true,
    // Stock group
    stockAdded      : true,
    inventoryPulled : true,
    stockEdited     : true,
    stockDeleted    : true,
    // Sales group
    expenseAdded    : true,
    salesFinancial  : true,   // financial copy of sales to sales-group
    // Report group
    dailyReport     : true,
    weeklyReport    : true,
    monthlyReport   : true,
};

// ── Prefs helpers ─────────────────────────
const getPrefs  = () => {
    try {
        const s = localStorage.getItem(PREFS_KEY);
        if (s) return { ...DEFAULT_PREFS, ...JSON.parse(s) };
    } catch { /* ignore */ }
    return { ...DEFAULT_PREFS };
};
const savePrefs = (p) => localStorage.setItem(PREFS_KEY, JSON.stringify(p));

// ── Message-ID store (for edit/delete) ───
const getMsgStore  = () => { try { return JSON.parse(localStorage.getItem(MSG_STORE_KEY) || '{}'); } catch { return {}; } };
const saveMsgId    = (id, msgId) => { const s = getMsgStore(); s[id] = msgId; localStorage.setItem(MSG_STORE_KEY, JSON.stringify(s)); };
const getMsgId     = (id) => getMsgStore()[id] || null;
const removeMsgId  = (id) => { const s = getMsgStore(); delete s[id]; localStorage.setItem(MSG_STORE_KEY, JSON.stringify(s)); };

// ── Pull tracker (localStorage) ──────────
const trackPull = (actionBy) => {
    if (!actionBy) return;
    const today = new Date().toISOString().split('T')[0];
    const log   = JSON.parse(localStorage.getItem(PULLS_LOG_KEY) || '{}');
    if (!log[today]) log[today] = {};
    log[today][actionBy] = (log[today][actionBy] || 0) + 1;
    localStorage.setItem(PULLS_LOG_KEY, JSON.stringify(log));
};
const getPullsForPeriod = (fromStr, toStr) => {
    const log   = JSON.parse(localStorage.getItem(PULLS_LOG_KEY) || '{}');
    const from  = fromStr.split('T')[0];
    const to    = toStr.split('T')[0];
    const totals = {};
    for (const [date, users] of Object.entries(log)) {
        if (date >= from && date <= to) {
            for (const [user, cnt] of Object.entries(users)) {
                totals[user] = (totals[user] || 0) + cnt;
            }
        }
    }
    return totals;
};

// ── Report times ─────────────────────────
const getReportTimes  = () => { try { return JSON.parse(localStorage.getItem(REPORT_TIMES_KEY) || '{}'); } catch { return {}; } };
const saveReportTime  = (key, val) => { const t = getReportTimes(); t[key] = val; localStorage.setItem(REPORT_TIMES_KEY, JSON.stringify(t)); };

// ── Helpers ───────────────────────────────
const isConfigured = () => BOT_TOKEN && BOT_TOKEN.length > 10;
const fmt  = (n) => Number(n || 0).toLocaleString('en-US');
const dateOnly = () => new Date().toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' });
const timeOnly = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });

// ── Design System ─────────────────────────
const SEP  = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';
const FOOT = '▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱';

const HDR = {
    newOrder      : '🔵━━━━━━━━━━━━━━━━━━━━━━━━🔵',
    processing    : '🟡━━━━━━━━━━━━━━━━━━━━━━━━🟡',
    activated     : '🟢━━━━━━━━━━━━━━━━━━━━━━━━🟢',
    deactivated   : '🟠━━━━━━━━━━━━━━━━━━━━━━━━🟠',
    reverted      : '🔵━━━━━━━━━━━━━━━━━━━━━━━━🔵',
    payment       : '💚━━━━━━━━━━━━━━━━━━━━━━━━💚',
    renewal       : '🔄━━━━━━━━━━━━━━━━━━━━━━━━🔄',
    stock         : '🟦━━━━━━━━━━━━━━━━━━━━━━━━🟦',
    stockDel      : '🔴━━━━━━━━━━━━━━━━━━━━━━━━🔴',
    stockEdit     : '🔶━━━━━━━━━━━━━━━━━━━━━━━━🔶',
    pull          : '🟤━━━━━━━━━━━━━━━━━━━━━━━━🟤',
    statusChange  : '🔷━━━━━━━━━━━━━━━━━━━━━━━━🔷',
    problem       : '🔴━━━━━━━━━━━━━━━━━━━━━━━━🔴',
    resolved      : '🟢━━━━━━━━━━━━━━━━━━━━━━━━🟢',
    expense       : '🟣━━━━━━━━━━━━━━━━━━━━━━━━🟣',
    expenseEdit   : '🔶━━━━━━━━━━━━━━━━━━━━━━━━🔶',
    expenseDel    : '⭕━━━━━━━━━━━━━━━━━━━━━━━━⭕',
    saleFinance   : '💵━━━━━━━━━━━━━━━━━━━━━━━━💵',
    reportDay     : '📊━━━━━━━━━━━━━━━━━━━━━━━━📊',
    reportWeek    : '📈━━━━━━━━━━━━━━━━━━━━━━━━📈',
    reportMonth   : '🗓━━━━━━━━━━━━━━━━━━━━━━━━🗓',
};

const footer = () => `\n${FOOT}\n   💎  <i>Diaa Store</i>  •  <code>${dateOnly()}  ${timeOnly()}</code>`;

// ── Core API ──────────────────────────────
const sendToChat = async (chatId, text) => {
    if (!isConfigured()) return false;
    const url     = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload = { chat_id: String(chatId), text, parse_mode: 'HTML', disable_web_page_preview: true };

    try {
        const res = await Promise.race([
            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 9000)),
        ]);
        if (res.ok) { const d = await res.json(); return d?.result?.message_id || true; }
    } catch { /* try XHR */ }

    try {
        return await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout  = 9000;
            xhr.onload   = () => { try { resolve(JSON.parse(xhr.responseText)?.result?.message_id || true); } catch { resolve(true); } };
            xhr.onerror  = () => reject(new Error('xhr'));
            xhr.ontimeout= () => reject(new Error('xhr-timeout'));
            xhr.send(JSON.stringify(payload));
        });
    } catch { return false; }
};

const deleteMessage = async (chatId, msgId) => {
    if (!msgId || !isConfigured()) return false;
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: String(chatId), message_id: msgId }),
        });
        return (await res.json()).ok;
    } catch { return false; }
};

const editMessage = async (chatId, msgId, text) => {
    if (!msgId || !isConfigured()) return false;
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: String(chatId), message_id: msgId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        });
        return (await res.json()).ok;
    } catch { return false; }
};

// ── Group-specific senders ────────────────
const sendNotice  = (type, text) => { const p = getPrefs(); if (p[type] === false) return null; return sendToChat(CHAT_IDS.notice, text); };
const sendStock   = (type, text) => { const p = getPrefs(); if (p[type] === false) return null; return sendToChat(CHAT_IDS.stock, text); };
const sendSales   = (type, text) => { const p = getPrefs(); if (p[type] === false) return null; return sendToChat(CHAT_IDS.sales, text); };
const sendReport  = (text)       => sendToChat(CHAT_IDS.report, text);

// ── Contact icons ─────────────────────────
const contactIcon = (ch) => {
    if (ch === 'واتساب') return '🟢';
    if (ch === 'ماسنجر') return '🔵';
    if (ch === 'تليجرام') return '✈️';
    return '💬';
};

// ==========================================
// Report Builders
// ==========================================

const buildEmployeeSection = (salesList, pullsByUser) => {
    const ordersByUser      = {};
    const activationsByUser = {};

    salesList.forEach(s => {
        const mod = s.moderator || s.created_by || 'Admin';
        ordersByUser[mod] = (ordersByUser[mod] || 0) + 1;
        if (s.is_activated && s.activated_by) {
            activationsByUser[s.activated_by] = (activationsByUser[s.activated_by] || 0) + 1;
        }
    });

    const allUsers = new Set([
        ...Object.keys(ordersByUser),
        ...Object.keys(activationsByUser),
        ...Object.keys(pullsByUser),
    ]);

    if (allUsers.size === 0) return `   ⚪  لا يوجد نشاط موظفين\n`;

    let txt = '';
    allUsers.forEach(user => {
        const orders = ordersByUser[user]      || 0;
        const acts   = activationsByUser[user] || 0;
        const pulls  = pullsByUser[user]       || 0;
        txt += `   👤  <b>${user}</b>\n`;
        if (orders > 0) txt += `         📦 أوردرات:  <code>${orders}</code> طلب\n`;
        if (acts   > 0) txt += `         ✅ تفعيلات:  <code>${acts}</code> تفعيل\n`;
        if (pulls  > 0) txt += `         📤 سحبات:   <code>${pulls}</code> عنصر\n`;
    });
    return txt;
};

const buildDailyReport = async (dateStr) => {
    const day      = dateStr || new Date().toISOString().split('T')[0];
    const dayStart = day + 'T00:00:00';
    const dayEnd   = day + 'T23:59:59';

    const [{ data: sales }, { data: expenses }] = await Promise.all([
        supabase.from('sales').select('*').gte('date', dayStart).lte('date', dayEnd),
        supabase.from('expenses').select('*').gte('date', day).lte('date', day + 'Z'),
    ]);

    const salesList  = sales    || [];
    const expList    = expenses || [];
    const revenue    = salesList.reduce((s, x) => s + Number(x.final_price || 0), 0);
    const totalExp   = expList.reduce((s, x) => s + Number(x.amount || 0), 0);
    const netProfit  = revenue - totalExp;
    const profitable = netProfit >= 0;

    const pullsByUser = getPullsForPeriod(dayStart, dayEnd);
    const label = new Date(day).toLocaleDateString('ar-EG', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    return (
        `${HDR.reportDay}\n` +
        `📊  <b>التقرير اليومي</b>  •  <code>DAILY REPORT</code>\n` +
        `${SEP}\n\n` +
        `   📅  <b>${label}</b>\n\n` +
        `${SEP}\n\n` +
        `💰  <b>الملخص المالي</b>\n\n` +
        `   📈  الإيرادات:      <b>${fmt(revenue)} EGP</b>\n` +
        `   📉  المصروفات:     <b>${fmt(totalExp)} EGP</b>\n` +
        `   ${profitable ? '✅' : '🔴'}  صافي الربح:   <b>${profitable ? '+' : ''}${fmt(netProfit)} EGP</b>\n` +
        `   📦  عدد الطلبات:   <b>${salesList.length} طلب</b>\n\n` +
        `${SEP}\n\n` +
        `👥  <b>أداء الموظفين</b>\n\n` +
        buildEmployeeSection(salesList, pullsByUser) +
        footer()
    );
};

const buildWeeklyReport = async () => {
    const now         = new Date();
    const dayOfWeek   = now.getDay();
    const weekStart   = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const startStr = weekStart.toISOString().split('T')[0];
    const endStr   = now.toISOString().split('T')[0];

    const [{ data: sales }, { data: expenses }] = await Promise.all([
        supabase.from('sales').select('*').gte('date', startStr).lte('date', endStr + 'T23:59:59'),
        supabase.from('expenses').select('*').gte('date', startStr).lte('date', endStr + 'T23:59:59'),
    ]);

    const salesList = sales    || [];
    const expList   = expenses || [];
    const revenue   = salesList.reduce((s, x) => s + Number(x.final_price || 0), 0);
    const totalExp  = expList.reduce((s, x) => s + Number(x.amount || 0), 0);
    const netProfit = revenue - totalExp;
    const profitable= netProfit >= 0;

    const pullsByUser = getPullsForPeriod(startStr + 'T00:00:00', endStr + 'T23:59:59');
    const labelStart  = weekStart.toLocaleDateString('ar-EG', { day: '2-digit', month: 'long' });
    const labelEnd    = now.toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        `${HDR.reportWeek}\n` +
        `📈  <b>التقرير الأسبوعي</b>  •  <code>WEEKLY REPORT</code>\n` +
        `${SEP}\n\n` +
        `   📅  <b>${labelStart} — ${labelEnd}</b>\n\n` +
        `${SEP}\n\n` +
        `💰  <b>الملخص المالي</b>\n\n` +
        `   📈  الإيرادات:       <b>${fmt(revenue)} EGP</b>\n` +
        `   📉  المصروفات:      <b>${fmt(totalExp)} EGP</b>\n` +
        `   ${profitable ? '✅' : '🔴'}  صافي الربح:    <b>${profitable ? '+' : ''}${fmt(netProfit)} EGP</b>\n` +
        `   📦  إجمالي الطلبات: <b>${salesList.length} طلب</b>\n\n` +
        `${SEP}\n\n` +
        `👥  <b>أداء الموظفين — هذا الأسبوع</b>\n\n` +
        buildEmployeeSection(salesList, pullsByUser) +
        footer()
    );
};

const buildMonthlyReport = async () => {
    const now         = new Date();
    const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);
    const startStr    = monthStart.toISOString().split('T')[0];
    const endStr      = now.toISOString().split('T')[0];

    const [{ data: sales }, { data: expenses }] = await Promise.all([
        supabase.from('sales').select('*').gte('date', startStr).lte('date', endStr + 'T23:59:59'),
        supabase.from('expenses').select('*').gte('date', startStr).lte('date', endStr + 'T23:59:59'),
    ]);

    const salesList = sales    || [];
    const expList   = expenses || [];
    const revenue   = salesList.reduce((s, x) => s + Number(x.final_price || 0), 0);
    const totalExp  = expList.reduce((s, x) => s + Number(x.amount || 0), 0);
    const netProfit = revenue - totalExp;
    const profitable= netProfit >= 0;

    const pullsByUser = getPullsForPeriod(startStr + 'T00:00:00', endStr + 'T23:59:59');
    const monthName   = monthStart.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

    return (
        `${HDR.reportMonth}\n` +
        `🗓  <b>التقرير الشهري</b>  •  <code>MONTHLY REPORT</code>\n` +
        `${SEP}\n\n` +
        `   📅  <b>${monthName}</b>\n\n` +
        `${SEP}\n\n` +
        `💰  <b>الملخص المالي الشهري</b>\n\n` +
        `   📈  إجمالي الإيرادات:  <b>${fmt(revenue)} EGP</b>\n` +
        `   📉  إجمالي المصروفات: <b>${fmt(totalExp)} EGP</b>\n` +
        `   ${profitable ? '✅' : '🔴'}  صافي الربح:      <b>${profitable ? '+' : ''}${fmt(netProfit)} EGP</b>\n` +
        `   📦  إجمالي الطلبات:   <b>${salesList.length} طلب</b>\n\n` +
        `${SEP}\n\n` +
        `👥  <b>تقرير الموظفين — هذا الشهر</b>\n\n` +
        buildEmployeeSection(salesList, pullsByUser) +
        footer()
    );
};

// ==========================================
// Auto Scheduler (runs when module loads)
// ==========================================
const checkScheduledReports = async () => {
    if (!isConfigured()) return;
    const prefs = getPrefs();
    const times = getReportTimes();
    const now   = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const hour     = now.getHours();

    // Daily — every midnight (hour 0)
    if (prefs.dailyReport !== false && hour === 0 && times.lastDaily !== todayStr) {
        try {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const text = await buildDailyReport(yesterday.toISOString().split('T')[0]);
            await sendReport(text);
            saveReportTime('lastDaily', todayStr);
        } catch (e) { console.warn('Daily report failed:', e); }
    }

    // Weekly — Sunday midnight
    if (prefs.weeklyReport !== false && now.getDay() === 0 && hour === 0) {
        const weekKey = todayStr;
        if (times.lastWeekly !== weekKey) {
            try {
                const text = await buildWeeklyReport();
                await sendReport(text);
                saveReportTime('lastWeekly', weekKey);
            } catch (e) { console.warn('Weekly report failed:', e); }
        }
    }

    // Monthly — 1st day of month midnight
    if (prefs.monthlyReport !== false && now.getDate() === 1 && hour === 0) {
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (times.lastMonthly !== monthKey) {
            try {
                const text = await buildMonthlyReport();
                await sendReport(text);
                saveReportTime('lastMonthly', monthKey);
            } catch (e) { console.warn('Monthly report failed:', e); }
        }
    }
};

// Start scheduler: check every 3 minutes
setTimeout(checkScheduledReports, 3000);
setInterval(checkScheduledReports, 3 * 60 * 1000);

// ==========================================
// Exported Telegram Object
// ==========================================
const telegram = {
    CHAT_IDS,
    getPrefs,
    savePrefs,
    DEFAULT_PREFS,
    trackPull,

    // ======================================
    // Connectivity
    // ======================================
    testConnection: async () => {
        if (!isConfigured()) return { ok: false, error: 'Bot not configured' };
        const text =
            `${HDR.activated}\n` +
            `🤖  <b>DIAA STORE</b>  —  System Check\n` +
            `${SEP}\n\n` +
            `   ✅  <b>الاتصال ناجح — متصل</b>\n` +
            `   📱  الجهاز:  <code>${/Mobi/i.test(navigator.userAgent) ? 'موبايل' : 'كمبيوتر'}</code>\n` +
            footer();
        const results = await Promise.all([
            sendToChat(CHAT_IDS.notice, text),
            sendToChat(CHAT_IDS.stock, text),
            sendToChat(CHAT_IDS.sales, text),
            sendToChat(CHAT_IDS.report, text),
        ]);
        const ok = results.some(r => r !== false);
        return ok ? { ok: true } : { ok: false, error: 'فشل الإرسال لكل الجروبات' };
    },

    testGroup: async (groupKey) => {
        if (!isConfigured()) return false;
        const labels = { notice: '📣 Notice', stock: '📦 Stock', sales: '💰 Sales', report: '📊 Report' };
        const text =
            `${HDR.activated}\n` +
            `🤖  <b>DIAA STORE</b>  —  Group Test\n` +
            `${SEP}\n\n` +
            `   ✅  <b>اختبار ناجح</b>\n` +
            `   🏷  الجروب:  <code>${labels[groupKey] || groupKey}</code>\n` +
            footer();
        return sendToChat(CHAT_IDS[groupKey], text);
    },

    // ======================================
    // 📣 NOTICE GROUP — Orders & Status
    // ======================================

    // 🔵 New Sale / New Order
    newSale: async (sale) => {
        const name    = sale.customerName || sale.customerEmail || 'عميل';
        const price   = Number(sale.finalPrice || 0).toLocaleString();
        const channel = contactIcon(sale.contactChannel);
        const paid    = sale.isPaid ? '✅ مدفوع بالكامل' : '🔴 غير مدفوع';
        const discount = sale.discount > 0
            ? `\n   🏷  الخصم:  <s>${Number(sale.originalPrice || 0).toLocaleString()}</s> ➜ <b>${price} EGP</b>`
            : '';

        // ── Notice: order tracking ──
        const noticeText =
            `${HDR.newOrder}\n` +
            `📦  <b>أوردر جديد</b>  •  <code>NEW ORDER</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل:   <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف:   <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   📧  الإيميل:  <code>${sale.customerEmail}</code>\n` : '') +
            `   ${channel}  التواصل:  ${sale.contactChannel || 'غير محدد'}\n` +
            `\n${SEP}\n\n` +
            `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
            `   💰  السعر:   <b>${price} EGP</b>${discount}\n` +
            `   💳  الدفع:   ${paid}\n` +
            (!sale.isPaid && sale.remainingAmount > 0 ? `   💸  المتبقي: <b>${Number(sale.remainingAmount).toLocaleString()} EGP</b>\n` : '') +
            (sale.paymentMethod ? `   🏦  المحفظة: ${sale.paymentMethod}\n` : '') +
            `\n${SEP}\n\n` +
            `   🔵  <b>الحالة:  ▸ قيد التفعيل ◂</b>\n` +
            (sale.moderator ? `   👨‍💼  بواسطة: <b>${sale.moderator}</b>\n` : '') +
            footer();

        const msgId = await sendNotice('newSale', noticeText);
        const saleKey = sale.id || `${sale.customerEmail || sale.customerName}_${sale.productName}_${Date.now()}`;
        if (msgId && typeof msgId === 'number') saveMsgId(saleKey, msgId);
        sale._telegramKey = saleKey;
        sale._telegramMsgId = msgId;

        // ── Sales group: financial entry ──
        const prefs = getPrefs();
        if (prefs.salesFinancial !== false) {
            const salesText =
                `${HDR.saleFinance}\n` +
                `💵  <b>إيراد جديد</b>  •  <code>NEW REVENUE</code>\n` +
                `${SEP}\n\n` +
                `   👤  العميل:  <b>${name}</b>\n` +
                `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
                `   💰  المبلغ:  <b>${price} EGP</b>\n` +
                `   💳  الدفع:   ${paid}\n` +
                (!sale.isPaid && sale.remainingAmount > 0 ? `   💸  متبقي:  <b>${Number(sale.remainingAmount).toLocaleString()} EGP</b>\n` : '') +
                (sale.paymentMethod ? `   🏦  محفظة:  ${sale.paymentMethod}\n` : '') +
                (sale.moderator ? `   👨‍💼  بواسطة: <b>${sale.moderator}</b>\n` : '') +
                footer();
            sendToChat(CHAT_IDS.sales, salesText);
        }
    },

    // ✅ Sale Activated
    saleActivated: async (sale, activatedBy) => {
        const name  = sale.customerName || sale.customerEmail || 'عميل';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const by    = activatedBy || sale.moderator || 'Admin';

        const saleKey = sale.id || sale._telegramKey;
        if (saleKey) {
            const oldId = getMsgId(saleKey);
            if (oldId) { await deleteMessage(CHAT_IDS.notice, oldId); removeMsgId(saleKey); }
        }

        const text =
            `${HDR.activated}\n` +
            `✅  <b>تم التفعيل</b>  •  <code>ACTIVATED</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل:  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف:  <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   📧  الإيميل: <code>${sale.customerEmail}</code>\n` : '') +
            `\n${SEP}\n\n` +
            `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
            `   💰  السعر:   <b>${price} EGP</b>\n` +
            `   💳  الدفع:   ${sale.isPaid ? '✅ مدفوع' : '🔴 غير مدفوع'}\n` +
            `\n${SEP}\n\n` +
            `   🟢  <b>الحالة:  ▸ تم التفعيل ✓ ◂</b>\n` +
            `   👨‍💼  فعّله:  <b>${by}</b>\n` +
            footer();

        sendNotice('saleActivated', text);
    },

    // 🟠 Sale Deactivated
    saleDeactivated: async (sale, deactivatedBy) => {
        const name  = sale.customerName || sale.customerEmail || 'عميل';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const by    = deactivatedBy || 'Admin';

        const saleKey = sale.id || sale._telegramKey;
        if (saleKey) {
            const oldId = getMsgId(saleKey);
            if (oldId) { await deleteMessage(CHAT_IDS.notice, oldId); removeMsgId(saleKey); }
        }

        const text =
            `${HDR.deactivated}\n` +
            `🟠  <b>إلغاء التفعيل</b>  •  <code>DEACTIVATED</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل:  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف:  <code>${sale.customerPhone}</code>\n` : '') +
            `\n${SEP}\n\n` +
            `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
            `   💰  السعر:   <b>${price} EGP</b>\n` +
            `\n${SEP}\n\n` +
            `   🟠  <b>الحالة:  ▸ قيد التفعيل ◂</b>\n` +
            `   👨‍💼  ألغاه:  <b>${by}</b>\n` +
            footer();

        const prefs = getPrefs();
        if (prefs.saleActivated === false) return;
        const msgId = await sendToChat(CHAT_IDS.notice, text);
        if (saleKey && msgId && typeof msgId === 'number') saveMsgId(saleKey, msgId);
    },

    // ⚙️ Sale Processing
    saleProcessing: async (sale, processingBy) => {
        const name      = sale.customerName || sale.customerEmail || 'عميل';
        const price     = Number(sale.finalPrice || 0).toLocaleString();
        const processor = processingBy || sale.moderator || 'Admin';
        const saleKey   = sale.id || sale._telegramKey;
        const oldMsgId  = saleKey ? getMsgId(saleKey) : null;

        const text =
            `${HDR.processing}\n` +
            `⚙️  <b>قيد التنفيذ</b>  •  <code>PROCESSING</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل:  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف:  <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   📧  الإيميل: <code>${sale.customerEmail}</code>\n` : '') +
            `\n${SEP}\n\n` +
            `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
            `   💰  السعر:   <b>${price} EGP</b>\n` +
            `   💳  الدفع:   ${sale.isPaid ? '✅ مدفوع' : '🔴 غير مدفوع'}\n` +
            `\n${SEP}\n\n` +
            `   🟡  <b>الحالة:  ▸ قيد التنفيذ ◂</b>\n` +
            `   👨‍💼  يعمل عليه: <b>${processor}</b>\n` +
            footer();

        if (oldMsgId) {
            const edited = await editMessage(CHAT_IDS.notice, oldMsgId, text);
            if (edited) return;
        }
        const prefs = getPrefs();
        if (prefs.saleProcessing === false) return;
        const msgId = await sendToChat(CHAT_IDS.notice, text);
        if (saleKey && msgId && typeof msgId === 'number') saveMsgId(saleKey, msgId);
    },

    // 🔵 Sale Reverted → back to pending
    saleReverted: async (sale) => {
        const name    = sale.customerName || sale.customerEmail || 'عميل';
        const channel = contactIcon(sale.contactChannel);
        const price   = Number(sale.finalPrice || 0).toLocaleString();
        const saleKey = sale.id || sale._telegramKey;
        const oldMsgId= saleKey ? getMsgId(saleKey) : null;

        const text =
            `${HDR.reverted}\n` +
            `📦  <b>أوردر جديد</b>  •  <code>NEW ORDER</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل:  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف:  <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   📧  الإيميل: <code>${sale.customerEmail}</code>\n` : '') +
            `   ${channel}  التواصل: ${sale.contactChannel || 'غير محدد'}\n` +
            `\n${SEP}\n\n` +
            `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
            `   💰  السعر:   <b>${price} EGP</b>\n` +
            `   💳  الدفع:   ${sale.isPaid ? '✅ مدفوع' : '🔴 غير مدفوع'}\n` +
            `\n${SEP}\n\n` +
            `   🔵  <b>الحالة:  ▸ قيد التفعيل ◂</b>\n` +
            (sale.moderator ? `   👨‍💼  بواسطة: <b>${sale.moderator}</b>\n` : '') +
            footer();

        if (oldMsgId) await editMessage(CHAT_IDS.notice, oldMsgId, text);
    },

    // 💚 Debt Paid
    debtPaid: (sale, actionBy) => {
        const name  = sale.customerName || sale.customerEmail || 'عميل';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const by    = actionBy || sale.moderator || 'Admin';

        const text =
            `${HDR.payment}\n` +
            `💰  <b>تم الدفع</b>  •  <code>PAYMENT RECEIVED</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل:  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف:  <code>${sale.customerPhone}</code>\n` : '') +
            `\n${SEP}\n\n` +
            `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
            `   💵  المبلغ:  <b>${price} EGP</b>\n` +
            (sale.paymentMethod ? `   🏦  المحفظة: ${sale.paymentMethod}\n` : '') +
            `\n${SEP}\n\n` +
            `   💚  <b>الحالة:  ▸ تم الدفع بالكامل ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة: <b>${by}</b>\n` +
            footer();

        sendNotice('debtPaid', text);
        // Also to sales group
        const prefs = getPrefs();
        if (prefs.salesFinancial !== false) sendToChat(CHAT_IDS.sales, text);
    },

    // 🔄 Sale Renewed
    saleRenewed: (sale, duration, actionBy) => {
        const name  = sale.customerName || sale.customerEmail || 'عميل';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const by    = actionBy || sale.moderator || 'Admin';

        const text =
            `${HDR.renewal}\n` +
            `🔄  <b>تجديد اشتراك</b>  •  <code>RENEWAL</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل:  <b>${name}</b>\n` +
            (sale.customerEmail ? `   📧  الإيميل: <code>${sale.customerEmail}</code>\n` : '') +
            `\n${SEP}\n\n` +
            `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
            `   ⏱  المدة:    <b>${duration || 30} يوم</b>\n` +
            `   💰  السعر:   <b>${price} EGP</b>\n` +
            `\n${SEP}\n\n` +
            `   🟢  <b>الحالة:  ▸ تم التجديد بنجاح ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة: <b>${by}</b>\n` +
            footer();

        sendNotice('saleRenewed', text);
        const prefs = getPrefs();
        if (prefs.salesFinancial !== false) sendToChat(CHAT_IDS.sales, text);
    },

    // 🔴 New Problem
    newProblem: (problem, actionBy) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.problem}\n` +
            `🚨  <b>مشكلة جديدة</b>  •  <code>NEW PROBLEM</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل:  <b>${problem.accountEmail || '-'}</b>\n` +
            `   📝  الوصف:  ${problem.description || '-'}\n` +
            `\n${SEP}\n\n` +
            `   🔴  <b>الحالة:  ▸ قيد المعالجة ◂</b>\n` +
            `   👨‍💼  سجّلها: <b>${by}</b>\n` +
            footer();

        sendNotice('newProblem', text);
    },

    // 🟢 Problem Resolved
    problemResolved: (problem, actionBy) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.resolved}\n` +
            `✅  <b>تم حل المشكلة</b>  •  <code>RESOLVED</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل:  <b>${problem.accountEmail || '-'}</b>\n` +
            `   📝  الوصف:  ${problem.description || '-'}\n` +
            `\n${SEP}\n\n` +
            `   🟢  <b>الحالة:  ▸ تم الحل ✓ ◂</b>\n` +
            `   👨‍💼  حلّها:  <b>${by}</b>\n` +
            footer();

        sendNotice('problemResolved', text);
    },

    // ======================================
    // 📦 STOCK GROUP — Inventory Movements
    // ======================================

    // 🟦 Stock Added
    stockAdded: (sectionName, count, actionBy, availableAfter) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.stock}\n` +
            `📦  <b>إضافة مخزون</b>  •  <code>STOCK ADDED</code>\n` +
            `${SEP}\n\n` +
            `   📂  القسم:           <b>${sectionName}</b>\n` +
            `   📊  الكمية المضافة: <b>+${count}</b> عنصر\n` +
            (availableAfter !== undefined ? `   🟢  المتاح الآن:    <b>${availableAfter}</b> عنصر\n` : '') +
            `\n${SEP}\n\n` +
            `   🟦  <b>الحالة:  ▸ تمت الإضافة ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة:  <b>${by}</b>\n` +
            footer();

        sendStock('stockAdded', text);
    },

    // 🟤 Inventory Pulled
    inventoryPulled: (sectionName, email, actionBy, availableAfter) => {
        const by = actionBy || 'Admin';
        trackPull(by);   // Track employee pull

        const text =
            `${HDR.pull}\n` +
            `📤  <b>سحب من المخزون</b>  •  <code>INVENTORY PULL</code>\n` +
            `${SEP}\n\n` +
            `   📂  القسم:           <b>${sectionName}</b>\n` +
            `   📧  الحساب:         <code>${email || '-'}</code>\n` +
            (availableAfter !== undefined ? `   🟡  المتاح بعد السحب: <b>${availableAfter}</b> عنصر\n` : '') +
            `\n${SEP}\n\n` +
            `   🟤  <b>الحالة:  ▸ تم السحب ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة:  <b>${by}</b>\n` +
            footer();

        sendStock('inventoryPulled', text);
    },

    // 🔷 Stock Status Changed
    stockStatusChanged: (sectionName, email, oldStatus, newStatus, actionBy, availableAfter) => {
        const by = actionBy || 'Admin';
        const statusLabels = {
            available : '🟢 متاح',
            used      : '🟡 مستخدم',
            completed : '⚫ مكتمل',
            damaged   : '🔴 تالف',
            returned  : '🟠 مرتجع',
        };

        const text =
            `${HDR.statusChange}\n` +
            `🔷  <b>تعديل حالة المخزون</b>  •  <code>STATUS CHANGE</code>\n` +
            `${SEP}\n\n` +
            `   📂  القسم:    <b>${sectionName}</b>\n` +
            `   📧  الحساب:  <code>${email || '-'}</code>\n` +
            `   🔀  التغيير: <s>${statusLabels[oldStatus] || oldStatus}</s>  ➡  <b>${statusLabels[newStatus] || newStatus}</b>\n` +
            (availableAfter !== undefined ? `   🟢  المتاح الآن: <b>${availableAfter}</b> عنصر\n` : '') +
            `\n${SEP}\n\n` +
            `   🔷  <b>الحالة:  ▸ تم التعديل ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة:  <b>${by}</b>\n` +
            footer();

        sendStock('stockEdited', text);
    },

    // 🔴 Stock Deleted
    stockDeleted: (sectionName, email, actionBy, availableAfter) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.stockDel}\n` +
            `🗑  <b>حذف من المخزون</b>  •  <code>STOCK DELETED</code>\n` +
            `${SEP}\n\n` +
            `   📂  القسم:          <b>${sectionName}</b>\n` +
            (email ? `   📧  الحساب:        <code>${email}</code>\n` : '') +
            (availableAfter !== undefined ? `   🟡  المتاح الآن:  <b>${availableAfter}</b> عنصر\n` : '') +
            `\n${SEP}\n\n` +
            `   🔴  <b>الحالة:  ▸ تم الحذف ◂</b>\n` +
            `   👨‍💼  حذفه:   <b>${by}</b>\n` +
            footer();

        sendStock('stockDeleted', text);
    },

    // ======================================
    // 💰 SALES GROUP — Financial Movements
    // ======================================

    // 🟣 Expense Added
    expenseAdded: (expense, actionBy) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.expense}\n` +
            `💸  <b>مصروف جديد</b>  •  <code>NEW EXPENSE</code>\n` +
            `${SEP}\n\n` +
            `   📝  الوصف:     <b>${expense.description || '-'}</b>\n` +
            `   💰  المبلغ:    <b>${fmt(expense.amount)} EGP</b>\n` +
            `   📂  النوع:     ${expense.type || '-'}\n` +
            (expense.walletName ? `   🏦  المحفظة:  <b>${expense.walletName}</b>\n` : '') +
            (expense.expenseCategory ? `   🏷  التصنيف: ${expense.expenseCategory === 'stock' ? '📦 مخزون' : '📅 يومي / تشغيلي'}\n` : '') +
            `\n${SEP}\n\n` +
            `   🟣  <b>الحالة:  ▸ تم التسجيل ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة: <b>${by}</b>\n` +
            footer();

        sendSales('expenseAdded', text);
    },

    // 🔶 Expense Edited
    expenseEdited: (oldExpense, newExpense, actionBy) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.expenseEdit}\n` +
            `✏️  <b>تعديل مصروف</b>  •  <code>EXPENSE EDITED</code>\n` +
            `${SEP}\n\n` +
            `   📝  الوصف:    <b>${newExpense.description || oldExpense.description || '-'}</b>\n` +
            `   💰  المبلغ:   <s>${fmt(oldExpense.amount)} EGP</s>  ➡  <b>${fmt(newExpense.amount)} EGP</b>\n` +
            `   📂  النوع:    ${newExpense.type || oldExpense.type || '-'}\n` +
            (oldExpense.walletName ? `   🏦  المحفظة: <b>${oldExpense.walletName}</b>\n` : '') +
            `\n${SEP}\n\n` +
            `   🔶  <b>الحالة:  ▸ تم التعديل ✓ ◂</b>\n` +
            `   👨‍💼  عدّله:  <b>${by}</b>\n` +
            footer();

        sendSales('expenseAdded', text);
    },

    // ⭕ Expense Deleted
    expenseDeleted: (expense, actionBy) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.expenseDel}\n` +
            `🗑  <b>حذف مصروف</b>  •  <code>EXPENSE DELETED</code>\n` +
            `${SEP}\n\n` +
            `   📝  الوصف:    <b>${expense.description || '-'}</b>\n` +
            `   💰  المبلغ:   <b>${fmt(expense.amount)} EGP</b>\n` +
            `   📂  النوع:    ${expense.type || '-'}\n` +
            (expense.walletName || expense.wallet_name
                ? `   🏦  المحفظة: <b>${expense.walletName || expense.wallet_name}</b>  (تم الاسترداد ✅)\n`
                : '') +
            `\n${SEP}\n\n` +
            `   ⭕  <b>الحالة:  ▸ تم الحذف ◂</b>\n` +
            `   👨‍💼  حذفه:   <b>${by}</b>\n` +
            footer();

        sendSales('expenseAdded', text);
    },

    // ======================================
    // 💵 SALARY PAYMENT — Sales group
    // ======================================
    salaryPayment: (empName, amount, walletName, actionBy, notes) => {
        const text =
            HDR.expense + '\n\n' +
            '   💼  <b>قبض مرتب موظف</b>\n' +
            '\n' + SEP + '\n\n' +
            '   👤  الموظف:   <b>' + empName + '</b>\n' +
            '   💰  المبلغ:   <b>' + fmt(amount) + ' ج.م</b>\n' +
            '   🏦  المحفظة:  <b>' + (walletName || 'غير محدد') + '</b>\n' +
            (notes ? '   📝  ملاحظة:   <b>' + notes + '</b>\n' : '') +
            '   👨‍💼  بواسطة:   <b>' + (actionBy || 'Admin') + '</b>\n' +
            footer();
        sendSales('expenseAdded', text);
    },

    // ======================================
    // 📊 REPORT GROUP — Scheduled & On-demand
    // ======================================

    sendDailyReport: async (dateStr) => {
        const text = await buildDailyReport(dateStr);
        const ok   = await sendReport(text);
        if (ok) saveReportTime('lastManualDaily', new Date().toISOString());
        return ok;
    },

    sendWeeklyReport: async () => {
        const text = await buildWeeklyReport();
        const ok   = await sendReport(text);
        if (ok) saveReportTime('lastManualWeekly', new Date().toISOString());
        return ok;
    },

    sendMonthlyReport: async () => {
        const text = await buildMonthlyReport();
        const ok   = await sendReport(text);
        if (ok) saveReportTime('lastManualMonthly', new Date().toISOString());
        return ok;
    },

    getReportTimes,

    // ======================================
    // Utility
    // ======================================
    deleteOldMessage: async (saleId) => {
        const msgId = getMsgId(saleId);
        if (msgId) { await deleteMessage(CHAT_IDS.notice, msgId); removeMsgId(saleId); }
    },

    custom: (title, body) => {
        const text = `📢  <b>${title}</b>\n${SEP}\n\n${body}\n` + footer();
        sendNotice('custom', text);
    },
};

export default telegram;
