// ==========================================
// Telegram Bot Notification Service v7
// - Color-coded status messages
// - Professional visual identity per event
// - Edit & Delete message support
// - Message tracking per sale
// ==========================================

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '';
const GROUP_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || '-1003976824578';

const PREFS_KEY = 'ds_telegram_prefs';
const MSG_STORE_KEY = 'ds_telegram_msgs';

const DEFAULT_PREFS = {
    newSale: true,
    saleProcessing: true,
    saleActivated: true,
    debtPaid: true,
    saleRenewed: true,
    stockAdded: true,
    inventoryPulled: true,
    newProblem: true,
    problemResolved: true,
    expenseAdded: true,
};

const getPrefs = () => {
    try {
        const saved = localStorage.getItem(PREFS_KEY);
        if (saved) return { ...DEFAULT_PREFS, ...JSON.parse(saved) };
    } catch (e) { /* ignore */ }
    return { ...DEFAULT_PREFS };
};

const savePrefs = (prefs) => { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); };

// ==========================================
// Message ID Store
// ==========================================
const getMsgStore = () => {
    try {
        const saved = localStorage.getItem(MSG_STORE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return {};
};
const saveMsgId = (saleId, messageId) => {
    const store = getMsgStore(); store[saleId] = messageId;
    localStorage.setItem(MSG_STORE_KEY, JSON.stringify(store));
};
const getMsgId  = (saleId) => getMsgStore()[saleId] || null;
const removeMsgId = (saleId) => {
    const store = getMsgStore(); delete store[saleId];
    localStorage.setItem(MSG_STORE_KEY, JSON.stringify(store));
};

const isConfigured = () => BOT_TOKEN && BOT_TOKEN.length > 10;

const dateOnly = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const timeOnly = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });

// ==========================================
// Design System — Color-coded Visual Identity
// ==========================================
const SEP  = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';
const FOOT = '▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱';

// Status header bars — each type has its own visual identity
const HDR = {
    newOrder:     '🔵━━━━━━━━━━━━━━━━━━━━━━━━🔵',
    processing:   '🟡━━━━━━━━━━━━━━━━━━━━━━━━🟡',
    activated:    '🟢━━━━━━━━━━━━━━━━━━━━━━━━🟢',
    deactivated:  '🟠━━━━━━━━━━━━━━━━━━━━━━━━🟠',
    reverted:     '🔵━━━━━━━━━━━━━━━━━━━━━━━━🔵',
    payment:      '💚━━━━━━━━━━━━━━━━━━━━━━━━💚',
    renewal:      '🔄━━━━━━━━━━━━━━━━━━━━━━━━🔄',
    stock:        '🟦━━━━━━━━━━━━━━━━━━━━━━━━🟦',
    pull:         '🟤━━━━━━━━━━━━━━━━━━━━━━━━🟤',
    statusChange: '🔷━━━━━━━━━━━━━━━━━━━━━━━━🔷',
    problem:      '🔴━━━━━━━━━━━━━━━━━━━━━━━━🔴',
    resolved:     '🟢━━━━━━━━━━━━━━━━━━━━━━━━🟢',
    expense:      '🟣━━━━━━━━━━━━━━━━━━━━━━━━🟣',
    expenseEdit:  '🔶━━━━━━━━━━━━━━━━━━━━━━━━🔶',
    expenseDel:   '⭕━━━━━━━━━━━━━━━━━━━━━━━━⭕',
};

const footer = () => `\n${FOOT}\n   💎  <i>Diaa Store</i>  •  <code>${dateOnly()}  ${timeOnly()}</code>`;

// ==========================================
// API Methods
// ==========================================
const sendToChat = async (chatId, text) => {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload = { chat_id: String(chatId), text, parse_mode: 'HTML', disable_web_page_preview: true };

    try {
        const res = await Promise.race([
            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
        ]);
        if (res.ok) { const data = await res.json(); return data?.result?.message_id || true; }
    } catch (e) { /* fallback */ }

    try {
        const msgId = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 8000;
            xhr.onload  = () => { try { resolve(JSON.parse(xhr.responseText)?.result?.message_id || true); } catch { resolve(true); } };
            xhr.onerror = () => reject(new Error('XHR error'));
            xhr.ontimeout = () => reject(new Error('XHR timeout'));
            xhr.send(JSON.stringify(payload));
        });
        return msgId;
    } catch (e) { /* ignore */ }

    try {
        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            if (navigator.sendBeacon(url, blob)) return true;
        }
    } catch (e) { /* ignore */ }

    return false;
};

const deleteMessage = async (chatId, messageId) => {
    if (!messageId || !isConfigured()) return false;
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: String(chatId), message_id: messageId }),
        });
        return (await res.json()).ok;
    } catch { return false; }
};

const editMessage = async (chatId, messageId, text) => {
    if (!messageId || !isConfigured()) return false;
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: String(chatId), message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        });
        return (await res.json()).ok;
    } catch { return false; }
};

const sendMessage = async (type, text) => {
    if (!isConfigured()) return null;
    const prefs = getPrefs();
    if (prefs[type] === false) return null;
    return sendToChat(GROUP_CHAT_ID, text);
};

const contactIcon = (ch) => {
    if (ch === 'واتساب') return '🟢';
    if (ch === 'ماسنجر') return '🔵';
    if (ch === 'تليجرام') return '✈️';
    return '💬';
};

// ==========================================
// Message Templates v7 — Color-coded
// ==========================================
const telegram = {
    getPrefs,
    savePrefs,
    DEFAULT_PREFS,

    testConnection: async () => {
        if (!isConfigured()) return { ok: false, error: 'Bot not configured' };
        const text =
            `${HDR.activated}\n` +
            `🤖  <b>DIAA STORE</b>  —  System Check\n` +
            `${SEP}\n\n` +
            `   ✅  <b>الاتصال ناجح — متصل</b>\n` +
            `   📱  الجهاز:  <code>${/Mobi/i.test(navigator.userAgent) ? 'موبايل' : 'كمبيوتر'}</code>\n` +
            footer();
        const ok = await sendToChat(GROUP_CHAT_ID, text);
        return ok ? { ok: true } : { ok: false, error: 'Failed to send' };
    },

    // =====================================
    // 🔵 NEW SALE — قيد التفعيل
    // =====================================
    newSale: async (sale) => {
        const name    = sale.customerName || sale.customerEmail || 'عميل';
        const price   = Number(sale.finalPrice || 0).toLocaleString();
        const channel = contactIcon(sale.contactChannel);
        const paid    = sale.isPaid ? '✅ مدفوع بالكامل' : '🔴 غير مدفوع';
        const discount = sale.discount > 0
            ? `\n   🏷  الخصم:  <s>${Number(sale.originalPrice || 0).toLocaleString()}</s> ➜ <b>${price} EGP</b>`
            : '';

        const text =
            `${HDR.newOrder}\n` +
            `📦  <b>أوردر جديد</b>  •  <code>NEW ORDER</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل：  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف：  <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   📧  الإيميل：  <code>${sale.customerEmail}</code>\n` : '') +
            `   ${channel}  التواصل：  ${sale.contactChannel || 'غير محدد'}\n` +
            `\n${SEP}\n\n` +
            `   🛒  المنتج：  <b>${sale.productName}</b>\n` +
            `   💰  السعر：  <b>${price} EGP</b>${discount}\n` +
            `   💳  الدفع：  ${paid}\n` +
            (!sale.isPaid && sale.remainingAmount > 0 ? `   💸  المتبقي：  <b>${Number(sale.remainingAmount).toLocaleString()} EGP</b>\n` : '') +
            (sale.paymentMethod ? `   🏦  المحفظة：  ${sale.paymentMethod}\n` : '') +
            `\n${SEP}\n\n` +
            `   🔵  <b>الحالة：  ▸ قيد التفعيل ◂</b>\n` +
            (sale.moderator ? `   👨‍💼  بواسطة：  <b>${sale.moderator}</b>\n` : '') +
            footer();

        const msgId = await sendMessage('newSale', text);
        const saleKey = sale.id || `${sale.customerEmail || sale.customerName}_${sale.productName}_${Date.now()}`;
        if (msgId && typeof msgId === 'number') saveMsgId(saleKey, msgId);
        sale._telegramKey = saleKey;
        sale._telegramMsgId = msgId;
    },

    // =====================================
    // 🟢 SALE ACTIVATED
    // =====================================
    saleActivated: async (sale, activatedBy) => {
        const name      = sale.customerName || sale.customerEmail || 'عميل';
        const price     = Number(sale.finalPrice || 0).toLocaleString();
        const moderator = activatedBy || sale.moderator || 'Admin';

        const saleKey = sale.id || sale._telegramKey;
        if (saleKey) {
            const oldMsgId = getMsgId(saleKey);
            if (oldMsgId) { await deleteMessage(GROUP_CHAT_ID, oldMsgId); removeMsgId(saleKey); }
        }

        const text =
            `${HDR.activated}\n` +
            `✅  <b>تم التفعيل</b>  •  <code>ACTIVATED</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل：  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف：  <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   📧  الإيميل：  <code>${sale.customerEmail}</code>\n` : '') +
            `\n${SEP}\n\n` +
            `   🛒  المنتج：  <b>${sale.productName}</b>\n` +
            `   💰  السعر：  <b>${price} EGP</b>\n` +
            `   💳  الدفع：  ${sale.isPaid ? '✅ مدفوع' : '🔴 غير مدفوع'}\n` +
            `\n${SEP}\n\n` +
            `   🟢  <b>الحالة：  ▸ تم التفعيل ✓ ◂</b>\n` +
            `   👨‍💼  فعّله：  <b>${moderator}</b>\n` +
            footer();

        sendMessage('saleActivated', text);
    },

    // =====================================
    // 🟠 SALE DEACTIVATED — إلغاء التفعيل
    // =====================================
    saleDeactivated: async (sale, deactivatedBy) => {
        const name  = sale.customerName || sale.customerEmail || 'عميل';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const by    = deactivatedBy || 'Admin';

        const saleKey = sale.id || sale._telegramKey;
        if (saleKey) {
            const oldMsgId = getMsgId(saleKey);
            if (oldMsgId) { await deleteMessage(GROUP_CHAT_ID, oldMsgId); removeMsgId(saleKey); }
        }

        const text =
            `${HDR.deactivated}\n` +
            `🟠  <b>إلغاء التفعيل</b>  •  <code>DEACTIVATED</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل：  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف：  <code>${sale.customerPhone}</code>\n` : '') +
            `\n${SEP}\n\n` +
            `   🛒  المنتج：  <b>${sale.productName}</b>\n` +
            `   💰  السعر：  <b>${price} EGP</b>\n` +
            `\n${SEP}\n\n` +
            `   🟠  <b>الحالة：  ▸ قيد التفعيل ◂</b>\n` +
            `   👨‍💼  ألغاه：  <b>${by}</b>\n` +
            footer();

        const prefs = getPrefs();
        if (prefs.saleActivated === false) return;
        const msgId = await sendToChat(GROUP_CHAT_ID, text);
        if (saleKey && msgId && typeof msgId === 'number') saveMsgId(saleKey, msgId);
    },

    // =====================================
    // 🟡 SALE PROCESSING — قيد التنفيذ
    // =====================================
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
            `   👤  العميل：  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف：  <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   📧  الإيميل：  <code>${sale.customerEmail}</code>\n` : '') +
            `\n${SEP}\n\n` +
            `   🛒  المنتج：  <b>${sale.productName}</b>\n` +
            `   💰  السعر：  <b>${price} EGP</b>\n` +
            `   💳  الدفع：  ${sale.isPaid ? '✅ مدفوع' : '🔴 غير مدفوع'}\n` +
            `\n${SEP}\n\n` +
            `   🟡  <b>الحالة：  ▸ قيد التنفيذ ◂</b>\n` +
            `   👨‍💼  يعمل عليه：  <b>${processor}</b>\n` +
            footer();

        if (oldMsgId) {
            const edited = await editMessage(GROUP_CHAT_ID, oldMsgId, text);
            if (edited) return;
        }

        const prefs = getPrefs();
        if (prefs.saleProcessing === false) return;
        const msgId = await sendToChat(GROUP_CHAT_ID, text);
        if (saleKey && msgId && typeof msgId === 'number') saveMsgId(saleKey, msgId);
    },

    // =====================================
    // 🔵 SALE REVERTED — رجع لقيد التفعيل
    // =====================================
    saleReverted: async (sale) => {
        const name    = sale.customerName || sale.customerEmail || 'عميل';
        const channel = contactIcon(sale.contactChannel);
        const price   = Number(sale.finalPrice || 0).toLocaleString();
        const saleKey = sale.id || sale._telegramKey;
        const oldMsgId = saleKey ? getMsgId(saleKey) : null;

        const text =
            `${HDR.reverted}\n` +
            `📦  <b>أوردر جديد</b>  •  <code>NEW ORDER</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل：  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف：  <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   📧  الإيميل：  <code>${sale.customerEmail}</code>\n` : '') +
            `   ${channel}  التواصل：  ${sale.contactChannel || 'غير محدد'}\n` +
            `\n${SEP}\n\n` +
            `   🛒  المنتج：  <b>${sale.productName}</b>\n` +
            `   💰  السعر：  <b>${price} EGP</b>\n` +
            `   💳  الدفع：  ${sale.isPaid ? '✅ مدفوع' : '🔴 غير مدفوع'}\n` +
            `\n${SEP}\n\n` +
            `   🔵  <b>الحالة：  ▸ قيد التفعيل ◂</b>\n` +
            (sale.moderator ? `   👨‍💼  بواسطة：  <b>${sale.moderator}</b>\n` : '') +
            footer();

        if (oldMsgId) await editMessage(GROUP_CHAT_ID, oldMsgId, text);
    },

    // =====================================
    // 💚 DEBT PAID — تم الدفع
    // =====================================
    debtPaid: (sale, actionBy) => {
        const name  = sale.customerName || sale.customerEmail || 'عميل';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const by    = actionBy || sale.moderator || 'Admin';

        const text =
            `${HDR.payment}\n` +
            `💰  <b>تم الدفع</b>  •  <code>PAYMENT RECEIVED</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل：  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف：  <code>${sale.customerPhone}</code>\n` : '') +
            `\n${SEP}\n\n` +
            `   🛒  المنتج：  <b>${sale.productName}</b>\n` +
            `   💵  المبلغ：  <b>${price} EGP</b>\n` +
            (sale.paymentMethod ? `   🏦  المحفظة：  ${sale.paymentMethod}\n` : '') +
            `\n${SEP}\n\n` +
            `   💚  <b>الحالة：  ▸ تم الدفع بالكامل ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة：  <b>${by}</b>\n` +
            footer();

        sendMessage('debtPaid', text);
    },

    // =====================================
    // 🔄 SALE RENEWED — تجديد
    // =====================================
    saleRenewed: (sale, duration, actionBy) => {
        const name  = sale.customerName || sale.customerEmail || 'عميل';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const by    = actionBy || sale.moderator || 'Admin';

        const text =
            `${HDR.renewal}\n` +
            `🔄  <b>تجديد اشتراك</b>  •  <code>RENEWAL</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل：  <b>${name}</b>\n` +
            (sale.customerEmail ? `   📧  الإيميل：  <code>${sale.customerEmail}</code>\n` : '') +
            `\n${SEP}\n\n` +
            `   🛒  المنتج：  <b>${sale.productName}</b>\n` +
            `   ⏱  المدة：  <b>${duration || 30} يوم</b>\n` +
            `   💰  السعر：  <b>${price} EGP</b>\n` +
            `\n${SEP}\n\n` +
            `   🟢  <b>الحالة：  ▸ تم التجديد بنجاح ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة：  <b>${by}</b>\n` +
            footer();

        sendMessage('saleRenewed', text);
    },

    // =====================================
    // 🟦 STOCK ADDED — إضافة مخزون
    // =====================================
    stockAdded: (sectionName, count, actionBy, availableAfter) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.stock}\n` +
            `📦  <b>إضافة مخزون</b>  •  <code>STOCK ADDED</code>\n` +
            `${SEP}\n\n` +
            `   📂  القسم：  <b>${sectionName}</b>\n` +
            `   📊  الكمية المضافة：  <b>+${count}</b> عنصر\n` +
            (availableAfter !== undefined ? `   🟢  المتاح الآن：  <b>${availableAfter}</b> عنصر\n` : '') +
            `\n${SEP}\n\n` +
            `   🟦  <b>الحالة：  ▸ تمت الإضافة ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة：  <b>${by}</b>\n` +
            footer();

        sendMessage('stockAdded', text);
    },

    // =====================================
    // 🟤 INVENTORY PULLED — سحب من المخزون
    // =====================================
    inventoryPulled: (sectionName, email, actionBy, availableAfter) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.pull}\n` +
            `📤  <b>سحب من المخزون</b>  •  <code>INVENTORY PULL</code>\n` +
            `${SEP}\n\n` +
            `   📂  القسم：  <b>${sectionName}</b>\n` +
            `   📧  الحساب：  <code>${email || '-'}</code>\n` +
            (availableAfter !== undefined ? `   🟡  المتاح بعد السحب：  <b>${availableAfter}</b> عنصر\n` : '') +
            `\n${SEP}\n\n` +
            `   🟤  <b>الحالة：  ▸ تم السحب ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة：  <b>${by}</b>\n` +
            footer();

        sendMessage('inventoryPulled', text);
    },

    // =====================================
    // 🔷 STOCK STATUS CHANGED
    // =====================================
    stockStatusChanged: (sectionName, email, oldStatus, newStatus, actionBy, availableAfter) => {
        const by = actionBy || 'Admin';
        const statusLabels = {
            available: '🟢 متاح',
            used:      '🟡 مستخدم',
            completed: '⚫ مكتمل',
            damaged:   '🔴 تالف',
            returned:  '🟠 مرتجع',
        };

        const text =
            `${HDR.statusChange}\n` +
            `🔷  <b>تعديل حالة المخزون</b>  •  <code>STATUS CHANGE</code>\n` +
            `${SEP}\n\n` +
            `   📂  القسم：  <b>${sectionName}</b>\n` +
            `   📧  الحساب：  <code>${email || '-'}</code>\n` +
            `   🔀  التغيير：  <s>${statusLabels[oldStatus] || oldStatus}</s>  ➡  <b>${statusLabels[newStatus] || newStatus}</b>\n` +
            (availableAfter !== undefined ? `   🟢  المتاح الآن：  <b>${availableAfter}</b> عنصر\n` : '') +
            `\n${SEP}\n\n` +
            `   🔷  <b>الحالة：  ▸ تم التعديل ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة：  <b>${by}</b>\n` +
            footer();

        sendMessage('stockAdded', text);
    },

    // =====================================
    // 🔴 NEW PROBLEM — مشكلة جديدة
    // =====================================
    newProblem: (problem, actionBy) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.problem}\n` +
            `🚨  <b>مشكلة جديدة</b>  •  <code>NEW PROBLEM</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل：  <b>${problem.accountEmail || '-'}</b>\n` +
            `   📝  الوصف：  ${problem.description || '-'}\n` +
            `\n${SEP}\n\n` +
            `   🔴  <b>الحالة：  ▸ قيد المعالجة ◂</b>\n` +
            `   👨‍💼  سجّلها：  <b>${by}</b>\n` +
            footer();

        sendMessage('newProblem', text);
    },

    // =====================================
    // 🟢 PROBLEM RESOLVED — تم الحل
    // =====================================
    problemResolved: (problem, actionBy) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.resolved}\n` +
            `✅  <b>تم حل المشكلة</b>  •  <code>RESOLVED</code>\n` +
            `${SEP}\n\n` +
            `   👤  العميل：  <b>${problem.accountEmail || '-'}</b>\n` +
            `   📝  الوصف：  ${problem.description || '-'}\n` +
            `\n${SEP}\n\n` +
            `   🟢  <b>الحالة：  ▸ تم الحل ✓ ◂</b>\n` +
            `   👨‍💼  حلّها：  <b>${by}</b>\n` +
            footer();

        sendMessage('problemResolved', text);
    },

    // =====================================
    // 🟣 NEW EXPENSE — مصروف جديد
    // =====================================
    expenseAdded: (expense, actionBy) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.expense}\n` +
            `💸  <b>مصروف جديد</b>  •  <code>NEW EXPENSE</code>\n` +
            `${SEP}\n\n` +
            `   📝  الوصف：  <b>${expense.description || '-'}</b>\n` +
            `   💰  المبلغ：  <b>${Number(expense.amount || 0).toLocaleString()} EGP</b>\n` +
            `   📂  النوع：  ${expense.type || '-'}\n` +
            (expense.walletName ? `   🏦  المحفظة：  <b>${expense.walletName}</b>\n` : '') +
            (expense.expenseCategory ? `   🏷  التصنيف：  ${expense.expenseCategory === 'stock' ? '📦 مخزون' : '📅 يومي / تشغيلي'}\n` : '') +
            `\n${SEP}\n\n` +
            `   🟣  <b>الحالة：  ▸ تم التسجيل ✓ ◂</b>\n` +
            `   👨‍💼  بواسطة：  <b>${by}</b>\n` +
            footer();

        sendMessage('expenseAdded', text);
    },

    // =====================================
    // 🔶 EXPENSE EDITED — تعديل مصروف
    // =====================================
    expenseEdited: (oldExpense, newExpense, actionBy) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.expenseEdit}\n` +
            `✏️  <b>تعديل مصروف</b>  •  <code>EXPENSE EDITED</code>\n` +
            `${SEP}\n\n` +
            `   📝  الوصف：  <b>${newExpense.description || oldExpense.description || '-'}</b>\n` +
            `   💰  المبلغ：  <s>${Number(oldExpense.amount || 0).toLocaleString()} EGP</s>  ➡  <b>${Number(newExpense.amount || 0).toLocaleString()} EGP</b>\n` +
            `   📂  النوع：  ${newExpense.type || oldExpense.type || '-'}\n` +
            (oldExpense.walletName ? `   🏦  المحفظة：  <b>${oldExpense.walletName}</b>\n` : '') +
            `\n${SEP}\n\n` +
            `   🔶  <b>الحالة：  ▸ تم التعديل ✓ ◂</b>\n` +
            `   👨‍💼  عدّله：  <b>${by}</b>\n` +
            footer();

        sendMessage('expenseAdded', text);
    },

    // =====================================
    // ⭕ EXPENSE DELETED — حذف مصروف
    // =====================================
    expenseDeleted: (expense, actionBy) => {
        const by = actionBy || 'Admin';

        const text =
            `${HDR.expenseDel}\n` +
            `🗑  <b>حذف مصروف</b>  •  <code>EXPENSE DELETED</code>\n` +
            `${SEP}\n\n` +
            `   📝  الوصف：  <b>${expense.description || '-'}</b>\n` +
            `   💰  المبلغ：  <b>${Number(expense.amount || 0).toLocaleString()} EGP</b>\n` +
            `   📂  النوع：  ${expense.type || '-'}\n` +
            (expense.walletName || expense.wallet_name ? `   🏦  المحفظة：  <b>${expense.walletName || expense.wallet_name}</b>  (تم الاسترداد ✅)\n` : '') +
            `\n${SEP}\n\n` +
            `   ⭕  <b>الحالة：  ▸ تم الحذف ◂</b>\n` +
            `   👨‍💼  حذفه：  <b>${by}</b>\n` +
            footer();

        sendMessage('expenseAdded', text);
    },

    // =====================================
    // CUSTOM MESSAGE
    // =====================================
    custom: (title, body) => {
        const text =
            `📢  <b>${title}</b>\n` +
            `${SEP}\n\n` +
            `${body}\n` +
            footer();
        sendMessage('custom', text);
    },

    // Utility
    deleteOldMessage: async (saleId) => {
        const msgId = getMsgId(saleId);
        if (msgId) { await deleteMessage(GROUP_CHAT_ID, msgId); removeMsgId(saleId); }
    },
};

export default telegram;
