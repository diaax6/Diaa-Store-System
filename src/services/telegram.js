// ==========================================
// Telegram Bot Notification Service
// ==========================================

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

const isConfigured = () => {
    return BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE' && CHAT_ID && CHAT_ID !== 'YOUR_CHAT_ID_HERE';
};

// Send a raw message to Telegram
// Uses multiple methods to bypass CORS issues in browsers
const sendMessage = async (text) => {
    if (!isConfigured()) {
        console.warn('[Telegram] Bot not configured — skipping notification');
        return;
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload = {
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    };

    try {
        // Method 1: Standard fetch
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            console.log('[Telegram] ✅ Notification sent');
            return;
        }
    } catch (e) {
        console.warn('[Telegram] Standard fetch failed, trying alternatives...', e.message);
    }

    try {
        // Method 2: URL-encoded GET request (CORS-friendly fallback)
        const params = new URLSearchParams({
            chat_id: CHAT_ID,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: 'true',
        });
        const getUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?${params.toString()}`;
        
        // Use a dynamic script/image trick to bypass CORS
        const img = new Image();
        img.src = getUrl;
        console.log('[Telegram] ✅ Notification sent (GET fallback)');
        return;
    } catch (e2) {
        console.warn('[Telegram] GET fallback failed:', e2.message);
    }

    try {
        // Method 3: Use navigator.sendBeacon (fire-and-forget, works cross-origin)
        const beaconData = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(url, beaconData);
        console.log('[Telegram] ✅ Notification sent (sendBeacon)');
    } catch (e3) {
        console.error('[Telegram] All methods failed:', e3.message);
    }
};

// ==========================================
// Notification Templates
// ==========================================

const telegram = {
    // 📦 Stock / Inventory added
    stockAdded: (sectionName, count, type = 'accounts') => {
        const icon = type === 'codes' ? '🔑' : '🛡️';
        sendMessage(
            `${icon} مخزون جديد\n\n` +
            `📂 القسم: ${sectionName}\n` +
            `📊 العدد: ${count} عنصر\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    // 🆕 New sale created
    newSale: (sale) => {
        const name = sale.customerName || sale.customerEmail || 'عميل';
        const paid = sale.isPaid ? '✅ مدفوع' : '⏳ غير مدفوع';
        const activated = sale.isActivated ? '✅ مفعّل' : '❌ غير مفعّل';
        sendMessage(
            `🛒 بيع جديد\n\n` +
            `👤 العميل: ${name}\n` +
            `📦 المنتج: ${sale.productName}\n` +
            `💰 السعر: ${Number(sale.finalPrice || 0).toLocaleString()} ج.م\n` +
            `💳 الدفع: ${paid}\n` +
            `🔓 التفعيل: ${activated}\n` +
            (sale.paymentMethod ? `🏦 المحفظة: ${sale.paymentMethod}\n` : '') +
            (sale.moderator ? `👨‍💻 بواسطة: ${sale.moderator}\n` : '') +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    // ✅ Sale activated
    saleActivated: (sale) => {
        const name = sale.customerName || sale.customerEmail || 'عميل';
        sendMessage(
            `✅ تم التفعيل\n\n` +
            `👤 العميل: ${name}\n` +
            `📦 المنتج: ${sale.productName}\n` +
            `📧 الإيميل: ${sale.customerEmail || '-'}\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    // 💰 Debt paid
    debtPaid: (sale) => {
        const name = sale.customerName || sale.customerEmail || 'عميل';
        sendMessage(
            `💰 تم الدفع\n\n` +
            `👤 العميل: ${name}\n` +
            `📦 المنتج: ${sale.productName}\n` +
            `💵 المبلغ: ${Number(sale.finalPrice || 0).toLocaleString()} ج.م\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    // 🔄 Sale renewed
    saleRenewed: (sale, newDuration) => {
        const name = sale.customerName || sale.customerEmail || 'عميل';
        sendMessage(
            `🔄 تجديد اشتراك\n\n` +
            `👤 العميل: ${name}\n` +
            `📦 المنتج: ${sale.productName}\n` +
            `⏱️ المدة: ${newDuration || 30} يوم\n` +
            `💰 السعر: ${Number(sale.finalPrice || 0).toLocaleString()} ج.م\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    // ⚠️ New problem reported
    newProblem: (problem) => {
        sendMessage(
            `⚠️ مشكلة جديدة\n\n` +
            `📧 الحساب: ${problem.accountEmail || '-'}\n` +
            `📝 الوصف: ${problem.description || '-'}\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    // ✅ Problem resolved
    problemResolved: (problem) => {
        sendMessage(
            `✅ مشكلة محلولة\n\n` +
            `📧 الحساب: ${problem.accountEmail || '-'}\n` +
            `📝 الوصف: ${problem.description || '-'}\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    // 💸 Expense added
    expenseAdded: (expense) => {
        sendMessage(
            `💸 مصروف جديد\n\n` +
            `📝 الوصف: ${expense.description || '-'}\n` +
            `💰 المبلغ: ${Number(expense.amount || 0).toLocaleString()} ج.م\n` +
            `📂 النوع: ${expense.type || '-'}\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    // 📤 Inventory pulled
    inventoryPulled: (sectionName, email) => {
        sendMessage(
            `📤 سحب من المخزون\n\n` +
            `📂 القسم: ${sectionName}\n` +
            `📧 الحساب: ${email || '-'}\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    // Custom message
    custom: (title, body) => {
        sendMessage(`📢 ${title}\n\n${body}`);
    },
};

export default telegram;
