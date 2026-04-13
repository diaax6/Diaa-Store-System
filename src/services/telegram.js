// ==========================================
// Telegram Bot Notification Service v6
// - Ultra-professional message design
// - Edit & Delete message support
// - Message tracking per sale
// - Status lifecycle: Pending → Activated
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

const savePrefs = (prefs) => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
};

// ==========================================
// Message ID Store (track messages per sale)
// ==========================================
const getMsgStore = () => {
    try {
        const saved = localStorage.getItem(MSG_STORE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return {};
};

const saveMsgId = (saleId, messageId) => {
    const store = getMsgStore();
    store[saleId] = messageId;
    localStorage.setItem(MSG_STORE_KEY, JSON.stringify(store));
};

const getMsgId = (saleId) => {
    const store = getMsgStore();
    return store[saleId] || null;
};

const removeMsgId = (saleId) => {
    const store = getMsgStore();
    delete store[saleId];
    localStorage.setItem(MSG_STORE_KEY, JSON.stringify(store));
};

const isConfigured = () => BOT_TOKEN && BOT_TOKEN.length > 10;

const timestamp = () => {
    const now = new Date();
    const d = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const t = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${d} • ${t}`;
};

const dateOnly = () => {
    const now = new Date();
    return now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const timeOnly = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// ==========================================
// Design System — Premium Unicode Elements
// ==========================================
const LINE_TOP     = '╔══════════════════════════╗';
const LINE_MID     = '╠══════════════════════════╣';
const LINE_BOT     = '╚══════════════════════════╝';
const DOT_LINE     = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const DASH_LINE    = '─────────────────────────────';
const THIN_LINE    = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

// ==========================================
// API Methods
// ==========================================
const sendToChat = async (chatId, text) => {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload = { chat_id: String(chatId), text, parse_mode: 'HTML', disable_web_page_preview: true };

    try {
        const res = await Promise.race([
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
        ]);
        if (res.ok) {
            const data = await res.json();
            console.log('[TG] ✅ Sent via fetch');
            return data?.result?.message_id || true;
        }
        console.warn('[TG] fetch non-ok:', res.status);
    } catch (e) {
        console.warn('[TG] fetch failed:', e.message);
    }

    // Fallback: XHR
    try {
        const msgId = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 8000;
            xhr.onload = () => {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data?.result?.message_id || true);
                } catch { resolve(true); }
            };
            xhr.onerror = () => reject(new Error('XHR error'));
            xhr.ontimeout = () => reject(new Error('XHR timeout'));
            xhr.send(JSON.stringify(payload));
        });
        console.log('[TG] ✅ Sent via XHR');
        return msgId;
    } catch (e) {
        console.warn('[TG] XHR failed:', e.message);
    }

    // Fallback: sendBeacon (no message_id returned)
    try {
        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            const sent = navigator.sendBeacon(url, blob);
            if (sent) { console.log('[TG] ✅ Sent via sendBeacon'); return true; }
        }
    } catch (e) { /* ignore */ }

    console.error('[TG] ❌ All send methods failed');
    return false;
};

const deleteMessage = async (chatId, messageId) => {
    if (!messageId || !isConfigured()) return false;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: String(chatId), message_id: messageId }),
        });
        const data = await res.json();
        if (data.ok) { console.log('[TG] 🗑️ Deleted message:', messageId); return true; }
        console.warn('[TG] Delete failed:', data.description);
    } catch (e) {
        console.warn('[TG] Delete error:', e.message);
    }
    return false;
};

const editMessage = async (chatId, messageId, text) => {
    if (!messageId || !isConfigured()) return false;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: String(chatId), message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        });
        const data = await res.json();
        if (data.ok) { console.log('[TG] ✏️ Edited message:', messageId); return true; }
        console.warn('[TG] Edit failed:', data.description);
    } catch (e) {
        console.warn('[TG] Edit error:', e.message);
    }
    return false;
};

// Send to group
const sendMessage = async (type, text) => {
    if (!isConfigured()) { console.warn('[TG] Not configured'); return null; }
    const prefs = getPrefs();
    if (prefs[type] === false) {
        console.log(`[TG] "${type}" is disabled`);
        return null;
    }
    return sendToChat(GROUP_CHAT_ID, text);
};

// ==========================================
// Helper functions
// ==========================================
const contactIcon = (ch) => {
    if (ch === 'واتساب') return '🟢';
    if (ch === 'ماسنجر') return '🔵';
    if (ch === 'تليجرام') return '🔷';
    return '💬';
};

const paymentStatusEmoji = (isPaid) => isPaid ? '✅' : '🔴';
const paymentStatusText = (isPaid) => isPaid ? 'تم الدفع ✓' : 'لم يتم الدفع';

// ==========================================
// Professional Message Templates v6
// ==========================================

const telegram = {
    getPrefs,
    savePrefs,
    DEFAULT_PREFS,

    testConnection: async () => {
        if (!isConfigured()) return { ok: false, error: 'Bot not configured' };
        const text =
            `🤖  <b>DIAA STORE</b>  •  System Check\n` +
            `${THIN_LINE}\n\n` +
            `   ✅  <b>الاتصال ناجح</b>\n\n` +
            `${DOT_LINE}\n\n` +
            `   📡  الحالة:  <code>متصل</code>\n` +
            `   📱  الجهاز:  <code>${/Mobi/i.test(navigator.userAgent) ? 'موبايل' : 'كمبيوتر'}</code>\n` +
            `   📅  التاريخ:  <code>${dateOnly()}</code>\n` +
            `   🕐  الوقت:  <code>${timeOnly()}</code>\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store Management System</i>`;
        const ok = await sendToChat(GROUP_CHAT_ID, text);
        return ok ? { ok: true } : { ok: false, error: 'Failed to send' };
    },

    // ============================
    // NEW SALE — قيد التفعيل
    // ============================
    newSale: async (sale) => {
        const name = sale.customerName || sale.customerEmail || 'عميل';
        const paid = sale.isPaid ? '✅ مدفوع بالكامل' : '🔴 غير مدفوع';
        const channel = contactIcon(sale.contactChannel);
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const discount = sale.discount > 0
            ? `\n   🏷  الخصم:  <s>${Number(sale.originalPrice || 0).toLocaleString()}</s>  ➜  <b>${price} EGP</b>`
            : '';

        const text =
            `📦  <b>أوردر جديد</b>  •  <code>NEW ORDER</code>\n` +
            `${THIN_LINE}\n\n` +
            `   👤  العميل:  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف:  <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   📧  الإيميل:  <code>${sale.customerEmail}</code>\n` : '') +
            `   ${channel}  التواصل:  ${sale.contactChannel || 'غير محدد'}\n\n` +
            `${DOT_LINE}\n\n` +
            `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
            `   💰  السعر:  <b>${price} EGP</b>${discount}\n` +
            `   💳  الدفع:  ${paid}\n` +
            (!sale.isPaid && sale.remainingAmount > 0
                ? `   💸  المتبقي:  <b>${Number(sale.remainingAmount).toLocaleString()} EGP</b>\n`
                : '') +
            (sale.paymentMethod ? `   🏦  المحفظة:  ${sale.paymentMethod}\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   ⏳  <b>الحالة:  ▸ قيد التفعيل ◂</b>\n\n` +
            (sale.moderator ? `   👨‍💼  بواسطة:  <b>${sale.moderator}</b>\n` : '') +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        const msgId = await sendMessage('newSale', text);

        // Store message ID for later edit/delete
        const saleKey = sale.id || `${sale.customerEmail || sale.customerName}_${sale.productName}_${Date.now()}`;
        if (msgId && typeof msgId === 'number') {
            saveMsgId(saleKey, msgId);
        }
        sale._telegramKey = saleKey;
        sale._telegramMsgId = msgId;
    },

    // ============================
    // SALE ACTIVATED — Delete old + Send new
    // ============================
    saleActivated: async (sale, activatedBy) => {
        const name = sale.customerName || sale.customerEmail || 'عميل';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const moderator = activatedBy || sale.moderator || 'Admin';

        // Try to delete old "pending" message
        const saleKey = sale.id || sale._telegramKey;
        if (saleKey) {
            const oldMsgId = getMsgId(saleKey);
            if (oldMsgId) {
                await deleteMessage(GROUP_CHAT_ID, oldMsgId);
                removeMsgId(saleKey);
            }
        }

        // Send new professional "activated" message
        const text =
            `✅  <b>تم التفعيل</b>  •  <code>ACTIVATED</code>\n` +
            `${THIN_LINE}\n\n` +
            `   👤  العميل:  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف:  <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   📧  الإيميل:  <code>${sale.customerEmail}</code>\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
            `   💰  السعر:  <b>${price} EGP</b>\n` +
            `   💳  الدفع:  ${sale.isPaid ? '✅ مدفوع' : '🔴 غير مدفوع'}\n` +
            `\n${DOT_LINE}\n\n` +
            `   ✅  <b>الحالة:  ▸ تم التفعيل ◂</b>\n` +
            `   👨‍💼  فعّله:  <b>${moderator}</b>\n\n` +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        sendMessage('saleActivated', text);
    },

    // ============================
    // SALE DEACTIVATED — Cancel activation, revert to pending
    // ============================
    saleDeactivated: async (sale, deactivatedBy) => {
        const name = sale.customerName || sale.customerEmail || '\u0639\u0645\u064a\u0644';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const by = deactivatedBy || 'Admin';

        // Delete old "activated" message
        const saleKey = sale.id || sale._telegramKey;
        if (saleKey) {
            const oldMsgId = getMsgId(saleKey);
            if (oldMsgId) {
                await deleteMessage(GROUP_CHAT_ID, oldMsgId);
                removeMsgId(saleKey);
            }
        }

        // Send new "deactivated / back to pending" message
        const text =
            `\u26a0\ufe0f  <b>\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062a\u0641\u0639\u064a\u0644</b>  \u2022  <code>DEACTIVATED</code>\n` +
            `${THIN_LINE}\n\n` +
            `   \ud83d\udc64  \u0627\u0644\u0639\u0645\u064a\u0644:  <b>${name}</b>\n` +
            (sale.customerPhone ? `   \ud83d\udcf1  \u0627\u0644\u0647\u0627\u062a\u0641:  <code>${sale.customerPhone}</code>\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   \ud83d\uded2  \u0627\u0644\u0645\u0646\u062a\u062c:  <b>${sale.productName}</b>\n` +
            `   \ud83d\udcb0  \u0627\u0644\u0633\u0639\u0631:  <b>${price} EGP</b>\n` +
            `\n${DOT_LINE}\n\n` +
            `   \u23f3  <b>\u0627\u0644\u062d\u0627\u0644\u0629:  \u25b8 \u0642\u064a\u062f \u0627\u0644\u062a\u0641\u0639\u064a\u0644 \u25c2</b>\n` +
            `   \ud83d\udc68\u200d\ud83d\udcbc  \u0623\u0644\u063a\u0627\u0647:  <b>${by}</b>\n\n` +
            `   \ud83d\udcc5  ${dateOnly()}  \u2022  \ud83d\udd50 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   \ud83d\udc8e  <i>Diaa Store</i>`;

        const prefs = getPrefs();
        if (prefs.saleActivated === false) return;
        const msgId = await sendToChat(GROUP_CHAT_ID, text);
        if (saleKey && msgId && typeof msgId === 'number') {
            saveMsgId(saleKey, msgId);
        }
    },

    // ============================
    // DEBT PAID
    // ============================
    debtPaid: (sale, actionBy) => {
        const name = sale.customerName || sale.customerEmail || 'عميل';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const by = actionBy || sale.moderator || 'Admin';

        const text =
            `💰  <b>تم الدفع</b>  •  <code>PAYMENT RECEIVED</code>\n` +
            `${THIN_LINE}\n\n` +
            `   👤  العميل:  <b>${name}</b>\n` +
            (sale.customerPhone ? `   📱  الهاتف:  <code>${sale.customerPhone}</code>\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
            `   💵  المبلغ:  <b>${price} EGP</b>\n` +
            (sale.paymentMethod ? `   🏦  المحفظة:  ${sale.paymentMethod}\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   ✅  <b>تم الدفع بالكامل</b>\n` +
            `   👨‍💼  بواسطة:  <b>${by}</b>\n\n` +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        sendMessage('debtPaid', text);
    },

    // ============================
    // SALE RENEWED
    // ============================
    saleRenewed: (sale, duration, actionBy) => {
        const name = sale.customerName || sale.customerEmail || 'عميل';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const by = actionBy || sale.moderator || 'Admin';

        const text =
            `🔄  <b>تجديد اشتراك</b>  •  <code>RENEWAL</code>\n` +
            `${THIN_LINE}\n\n` +
            `   👤  العميل:  <b>${name}</b>\n` +
            (sale.customerEmail ? `   📧  الإيميل:  <code>${sale.customerEmail}</code>\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   🛒  المنتج:  <b>${sale.productName}</b>\n` +
            `   ⏱  المدة:  <b>${duration || 30} يوم</b>\n` +
            `   💰  السعر:  <b>${price} EGP</b>\n` +
            `\n${DOT_LINE}\n\n` +
            `   ✅  <b>تم التجديد بنجاح</b>\n` +
            `   👨‍💼  بواسطة:  <b>${by}</b>\n\n` +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        sendMessage('saleRenewed', text);
    },

    // ============================
    // STOCK ADDED
    // ============================
    stockAdded: (sectionName, count, actionBy, availableAfter) => {
        const by = actionBy || 'Admin';
        const text =
            `📦  <b>تحديث المخزون</b>  •  <code>STOCK UPDATE</code>\n` +
            `${THIN_LINE}\n\n` +
            `   📂  القسم:  <b>${sectionName}</b>\n` +
            `   📊  الكمية المضافة:  <b>+${count}</b> عنصر\n` +
            (availableAfter !== undefined ? `   🟢  المتاح الآن:  <b>${availableAfter}</b> عنصر\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   ✅  <b>تم إضافة المخزون</b>\n` +
            `   👨‍💼  بواسطة:  <b>${by}</b>\n\n` +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        sendMessage('stockAdded', text);
    },

    // ============================
    // INVENTORY PULLED
    // ============================
    inventoryPulled: (sectionName, email, actionBy, availableAfter) => {
        const by = actionBy || 'Admin';
        const text =
            `📤  <b>سحب من المخزون</b>  •  <code>INVENTORY PULL</code>\n` +
            `${THIN_LINE}\n\n` +
            `   📂  القسم:  <b>${sectionName}</b>\n` +
            `   📧  الحساب:  <code>${email || '-'}</code>\n` +
            (availableAfter !== undefined ? `   🟢  المتاح بعد السحب:  <b>${availableAfter}</b> عنصر\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   ✅  <b>تم السحب من المخزون</b>\n` +
            `   👨‍💼  بواسطة:  <b>${by}</b>\n\n` +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        sendMessage('inventoryPulled', text);
    },

    // ============================
    // NEW PROBLEM
    // ============================
    newProblem: (problem, actionBy) => {
        const by = actionBy || 'Admin';
        const text =
            `⚠️  <b>مشكلة جديدة</b>  •  <code>NEW PROBLEM</code>\n` +
            `${THIN_LINE}\n\n` +
            `   👤  العميل:  <b>${problem.accountEmail || '-'}</b>\n` +
            `   📝  الوصف:  ${problem.description || '-'}\n\n` +
            `${DOT_LINE}\n\n` +
            `   🔴  <b>الحالة:  ▸ قيد المعالجة ◂</b>\n` +
            `   👨‍💼  سجّلها:  <b>${by}</b>\n\n` +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        sendMessage('newProblem', text);
    },

    // ============================
    // PROBLEM RESOLVED
    // ============================
    problemResolved: (problem, actionBy) => {
        const by = actionBy || 'Admin';
        const text =
            `🟢  <b>تم حل المشكلة</b>  •  <code>RESOLVED</code>\n` +
            `${THIN_LINE}\n\n` +
            `   👤  العميل:  <b>${problem.accountEmail || '-'}</b>\n` +
            `   📝  الوصف:  ${problem.description || '-'}\n\n` +
            `${DOT_LINE}\n\n` +
            `   ✅  <b>الحالة:  ▸ تم الحل ◂</b>\n` +
            `   👨‍💼  حلّها:  <b>${by}</b>\n\n` +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        sendMessage('problemResolved', text);
    },

    // ============================
    // NEW EXPENSE
    // ============================
    expenseAdded: (expense, actionBy) => {
        const by = actionBy || 'Admin';
        const walletLine = expense.walletName ? `   🏦  المحفظة:  <b>${expense.walletName}</b>\n` : '';
        const text =
            `💸  <b>مصروف جديد</b>  •  <code>NEW EXPENSE</code>\n` +
            `${THIN_LINE}\n\n` +
            `   📝  الوصف:  <b>${expense.description || '-'}</b>\n` +
            `   💰  المبلغ:  <b>${Number(expense.amount || 0).toLocaleString()} EGP</b>\n` +
            `   📂  النوع:  ${expense.type || '-'}\n` +
            walletLine +
            (expense.expenseCategory ? `   🏷  التصنيف:  ${expense.expenseCategory === 'stock' ? 'مخزون' : 'يومي / تشغيلي'}\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   👨‍💼  بواسطة:  <b>${by}</b>\n` +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        sendMessage('expenseAdded', text);
    },

    // ============================
    // STOCK STATUS CHANGED
    // ============================
    stockStatusChanged: (sectionName, email, oldStatus, newStatus, actionBy, availableAfter) => {
        const by = actionBy || 'Admin';
        const statusLabels = { available: 'متاح ✅', used: 'مستخدم 🟡', completed: 'مكتمل ⚫', damaged: 'تالف 🔴', returned: 'مرتجع 🟠' };
        const text =
            `🔄  <b>تعديل حالة المخزون</b>  •  <code>STATUS CHANGE</code>\n` +
            `${THIN_LINE}\n\n` +
            `   📂  القسم:  <b>${sectionName}</b>\n` +
            `   📧  الحساب:  <code>${email || '-'}</code>\n` +
            `   🔀  الحالة:  <s>${statusLabels[oldStatus] || oldStatus}</s>  ➡  <b>${statusLabels[newStatus] || newStatus}</b>\n` +
            (availableAfter !== undefined ? `   🟢  المتاح الآن:  <b>${availableAfter}</b> عنصر\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   👨‍💼  بواسطة:  <b>${by}</b>\n` +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        sendMessage('stockAdded', text);
    },

    // ============================
    // EXPENSE EDITED
    // ============================
    expenseEdited: (oldExpense, newExpense, actionBy) => {
        const by = actionBy || 'Admin';
        const text =
            `✏️  <b>تعديل مصروف</b>  •  <code>EXPENSE EDITED</code>\n` +
            `${THIN_LINE}\n\n` +
            `   📝  الوصف:  <b>${newExpense.description || oldExpense.description || '-'}</b>\n` +
            `   💰  المبلغ:  <s>${Number(oldExpense.amount || 0).toLocaleString()} EGP</s>  ➡  <b>${Number(newExpense.amount || 0).toLocaleString()} EGP</b>\n` +
            `   📂  النوع:  ${newExpense.type || oldExpense.type || '-'}\n` +
            (oldExpense.walletName ? `   🏦  المحفظة:  <b>${oldExpense.walletName}</b>\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   👨‍💼  عدّله:  <b>${by}</b>\n` +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        sendMessage('expenseAdded', text);
    },

    // ============================
    // EXPENSE DELETED
    // ============================
    expenseDeleted: (expense, actionBy) => {
        const by = actionBy || 'Admin';
        const text =
            `🗑  <b>حذف مصروف</b>  •  <code>EXPENSE DELETED</code>\n` +
            `${THIN_LINE}\n\n` +
            `   📝  الوصف:  <b>${expense.description || '-'}</b>\n` +
            `   💰  المبلغ:  <b>${Number(expense.amount || 0).toLocaleString()} EGP</b>\n` +
            `   📂  النوع:  ${expense.type || '-'}\n` +
            (expense.walletName || expense.wallet_name ? `   🏦  المحفظة:  <b>${expense.walletName || expense.wallet_name}</b>  (تم الاسترداد ✅)\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   ❌  <b>تم حذف المصروف</b>\n` +
            `   👨‍💼  حذفه:  <b>${by}</b>\n` +
            `   📅  ${dateOnly()}  •  🕐 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   💎  <i>Diaa Store</i>`;

        sendMessage('expenseAdded', text);
    },

    // ============================
    // SALE PROCESSING — Edit existing message
    // ============================
    saleProcessing: async (sale, processingBy) => {
        const name = sale.customerName || sale.customerEmail || '\u0639\u0645\u064a\u0644';
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const processor = processingBy || sale.moderator || 'Admin';

        const saleKey = sale.id || sale._telegramKey;
        const oldMsgId = saleKey ? getMsgId(saleKey) : null;

        const text =
            `\u2699\uFE0F  <b>\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630</b>  \u2022  <code>PROCESSING</code>\n` +
            `${THIN_LINE}\n\n` +
            `   \uD83D\uDC64  \u0627\u0644\u0639\u0645\u064A\u0644:  <b>${name}</b>\n` +
            (sale.customerPhone ? `   \uD83D\uDCF1  \u0627\u0644\u0647\u0627\u062A\u0641:  <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   \uD83D\uDCE7  \u0627\u0644\u0625\u064A\u0645\u064A\u0644:  <code>${sale.customerEmail}</code>\n` : '') +
            `\n${DOT_LINE}\n\n` +
            `   \uD83D\uDED2  \u0627\u0644\u0645\u0646\u062A\u062C:  <b>${sale.productName}</b>\n` +
            `   \uD83D\uDCB0  \u0627\u0644\u0633\u0639\u0631:  <b>${price} EGP</b>\n` +
            `   \uD83D\uDCB3  \u0627\u0644\u062F\u0641\u0639:  ${sale.isPaid ? '\u2705 \u0645\u062F\u0641\u0648\u0639' : '\uD83D\uDD34 \u063A\u064A\u0631 \u0645\u062F\u0641\u0648\u0639'}\n` +
            `\n${DOT_LINE}\n\n` +
            `   \u2699\uFE0F  <b>\u0627\u0644\u062D\u0627\u0644\u0629:  \u25B8 \u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u25C2</b>\n` +
            `   \uD83D\uDC68\u200D\uD83D\uDCBC  \u064A\u0639\u0645\u0644 \u0639\u0644\u064A\u0647:  <b>${processor}</b>\n\n` +
            `   \uD83D\uDCC5  ${dateOnly()}  \u2022  \uD83D\uDD50 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   \uD83D\uDC8E  <i>Diaa Store</i>`;

        // Try to edit old message first
        if (oldMsgId) {
            const edited = await editMessage(GROUP_CHAT_ID, oldMsgId, text);
            if (edited) return;
        }

        // Fallback: send new message if edit fails
        const prefs = getPrefs();
        if (prefs.saleProcessing === false) return;
        const msgId = await sendToChat(GROUP_CHAT_ID, text);
        if (saleKey && msgId && typeof msgId === 'number') {
            saveMsgId(saleKey, msgId);
        }
    },

    // ============================
    // SALE REVERTED — Edit message back to pending
    // ============================
    saleReverted: async (sale) => {
        const name = sale.customerName || sale.customerEmail || '\u0639\u0645\u064a\u0644';
        const channel = contactIcon(sale.contactChannel);
        const price = Number(sale.finalPrice || 0).toLocaleString();
        const paid = sale.isPaid ? '\u2705 \u0645\u062f\u0641\u0648\u0639 \u0628\u0627\u0644\u0643\u0627\u0645\u0644' : '\uD83D\uDD34 \u063a\u064a\u0631 \u0645\u062f\u0641\u0648\u0639';

        const saleKey = sale.id || sale._telegramKey;
        const oldMsgId = saleKey ? getMsgId(saleKey) : null;

        const text =
            `\uD83D\uDCE6  <b>\u0623\u0648\u0631\u062F\u0631 \u062C\u062F\u064A\u062F</b>  \u2022  <code>NEW ORDER</code>\n` +
            `${THIN_LINE}\n\n` +
            `   \uD83D\uDC64  \u0627\u0644\u0639\u0645\u064A\u0644:  <b>${name}</b>\n` +
            (sale.customerPhone ? `   \uD83D\uDCF1  \u0627\u0644\u0647\u0627\u062A\u0641:  <code>${sale.customerPhone}</code>\n` : '') +
            (sale.customerEmail ? `   \uD83D\uDCE7  \u0627\u0644\u0625\u064A\u0645\u064A\u0644:  <code>${sale.customerEmail}</code>\n` : '') +
            `   ${channel}  \u0627\u0644\u062A\u0648\u0627\u0635\u0644:  ${sale.contactChannel || '\u063a\u064a\u0631 \u0645\u062d\u062f\u062f'}\n\n` +
            `${DOT_LINE}\n\n` +
            `   \uD83D\uDED2  \u0627\u0644\u0645\u0646\u062A\u062C:  <b>${sale.productName}</b>\n` +
            `   \uD83D\uDCB0  \u0627\u0644\u0633\u0639\u0631:  <b>${price} EGP</b>\n` +
            `   \uD83D\uDCB3  \u0627\u0644\u062F\u0641\u0639:  ${paid}\n` +
            `\n${DOT_LINE}\n\n` +
            `   \u23F3  <b>\u0627\u0644\u062D\u0627\u0644\u0629:  \u25B8 \u0642\u064A\u062F \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u25C2</b>\n\n` +
            (sale.moderator ? `   \uD83D\uDC68\u200D\uD83D\uDCBC  \u0628\u0648\u0627\u0633\u0637\u0629:  <b>${sale.moderator}</b>\n` : '') +
            `   \uD83D\uDCC5  ${dateOnly()}  \u2022  \uD83D\uDD50 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   \uD83D\uDC8E  <i>Diaa Store</i>`;

        // Try to edit old message
        if (oldMsgId) {
            await editMessage(GROUP_CHAT_ID, oldMsgId, text);
        }
    },

    // ============================
    // CUSTOM MESSAGE
    // ============================
    custom: (title, body) => {
        const text =
            `\uD83D\uDCE2  <b>${title}</b>\n` +
            `${THIN_LINE}\n\n` +
            `${body}\n\n` +
            `${DOT_LINE}\n\n` +
            `   \uD83D\uDCC5  ${dateOnly()}  \u2022  \uD83D\uDD50 ${timeOnly()}\n\n` +
            `${THIN_LINE}\n` +
            `   \uD83D\uDC8E  <i>Diaa Store</i>`;
        sendMessage('custom', text);
    },

    // Utility: delete old message for a sale
    deleteOldMessage: async (saleId) => {
        const msgId = getMsgId(saleId);
        if (msgId) {
            await deleteMessage(GROUP_CHAT_ID, msgId);
            removeMsgId(saleId);
        }
    },
};

export default telegram;
