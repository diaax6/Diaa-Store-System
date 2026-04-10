// ==========================================
// Telegram Bot Notification Service
// Supports multiple chat IDs (comma-separated)
// ==========================================

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const CHAT_IDS_RAW = import.meta.env.VITE_TELEGRAM_CHAT_ID || '';

// Parse comma-separated chat IDs
const CHAT_IDS = CHAT_IDS_RAW.split(',').map(id => id.trim()).filter(Boolean);

const isConfigured = () => {
    return BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE' && CHAT_IDS.length > 0;
};

// Send to a single chat ID
const sendToChat = async (chatId, text) => {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) return true;
    } catch (e) {
        // Fetch failed (likely CORS)
    }

    try {
        // Fallback: GET request with URL params
        const params = new URLSearchParams({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: 'true',
        });
        const img = new Image();
        img.src = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?${params.toString()}`;
        return true;
    } catch (e2) {
        // GET fallback failed
    }

    try {
        // Fallback 2: sendBeacon
        const beaconData = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(url, beaconData);
        return true;
    } catch (e3) {
        console.error(`[Telegram] Failed to send to ${chatId}`);
    }

    return false;
};

// Send message to ALL configured chat IDs
const sendMessage = async (text) => {
    if (!isConfigured()) {
        console.warn('[Telegram] Bot not configured — skipping');
        return;
    }

    for (const chatId of CHAT_IDS) {
        await sendToChat(chatId, text);
    }
    console.log(`[Telegram] ✅ Sent to ${CHAT_IDS.length} chat(s)`);
};

// ==========================================
// Notification Templates
// ==========================================

const telegram = {
    stockAdded: (sectionName, count) => {
        sendMessage(
            `📦 مخزون جديد\n\n` +
            `📂 القسم: ${sectionName}\n` +
            `📊 العدد: ${count} عنصر\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

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

    newProblem: (problem) => {
        sendMessage(
            `⚠️ مشكلة جديدة\n\n` +
            `📧 الحساب: ${problem.accountEmail || '-'}\n` +
            `📝 الوصف: ${problem.description || '-'}\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    problemResolved: (problem) => {
        sendMessage(
            `✅ مشكلة محلولة\n\n` +
            `📧 الحساب: ${problem.accountEmail || '-'}\n` +
            `📝 الوصف: ${problem.description || '-'}\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    expenseAdded: (expense) => {
        sendMessage(
            `💸 مصروف جديد\n\n` +
            `📝 الوصف: ${expense.description || '-'}\n` +
            `💰 المبلغ: ${Number(expense.amount || 0).toLocaleString()} ج.م\n` +
            `📂 النوع: ${expense.type || '-'}\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    inventoryPulled: (sectionName, email) => {
        sendMessage(
            `📤 سحب من المخزون\n\n` +
            `📂 القسم: ${sectionName}\n` +
            `📧 الحساب: ${email || '-'}\n` +
            `📅 ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        );
    },

    custom: (title, body) => {
        sendMessage(`📢 ${title}\n\n${body}`);
    },
};

export default telegram;
