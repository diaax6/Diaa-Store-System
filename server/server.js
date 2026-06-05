/**
 * Diaa Store API Server
 * PostgREST-compatible REST API + Edge Functions replacement
 * Replaces Supabase completely — no code changes needed in frontend
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Database Pool ────────────────────────────────────────────────────────────
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'diaastore',
    user: process.env.DB_USER || 'diaastore',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => console.error('DB pool error:', err));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Prefer',
                     'x-user-token', 'x-client-info', 'Range', 'Accept-Profile'],
    exposedHeaders: ['Content-Range', 'X-Total-Count'],
}));
app.use(express.json({ limit: '10mb' }));

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ─── PostgREST Query Parser ───────────────────────────────────────────────────
// Parses PostgREST-style query params into SQL
function parseQuery(tableName, query) {
    const allowedTables = [
        'users', 'products', 'inventory_sections', 'accounts', 'customers',
        'sales', 'expenses', 'wallets', 'wallet_transactions', 'problems',
        'attendance', 'employees', 'salary_payments', 'employee_actions',
        'quick_links', 'inventory_logs'
    ];

    if (!allowedTables.includes(tableName)) {
        throw new Error(`Table '${tableName}' not allowed`);
    }

    let select = '*';
    const conditions = [];
    const values = [];
    let orderBy = '';
    let limit = '';
    let offset = '';
    let isCountOnly = false;

    for (const [key, val] of Object.entries(query)) {
        if (key === 'select') {
            // Parse select — supabase sometimes sends complex selects, we simplify
            if (val === 'count' || val === 'id') {
                select = val === 'count' ? 'COUNT(*) as count' : 'id';
            } else if (val && val !== '*') {
                // Keep only simple column names (no nested)
                const cols = val.split(',').map(c => {
                    const trimmed = c.trim().split('(')[0].split(':')[0].trim();
                    // Handle aliases like col:alias
                    return `"${trimmed}"`;
                }).filter(c => c !== '""');
                select = cols.length > 0 ? cols.join(', ') : '*';
            }
        } else if (key === 'order') {
            // e.g. created_at.desc or created_at.asc,id.asc
            const parts = val.split(',').map(part => {
                const [col, dir] = part.split('.');
                const direction = dir === 'desc' ? 'DESC' : 'ASC';
                return `"${col}" ${direction}`;
            });
            orderBy = `ORDER BY ${parts.join(', ')}`;
        } else if (key === 'limit') {
            limit = `LIMIT ${parseInt(val) || 1000}`;
        } else if (key === 'offset') {
            offset = `OFFSET ${parseInt(val) || 0}`;
        } else {
            // Filter operators: col=eq.value, col=neq.value, col=like.*val*, col=is.null, col=gt.value, col=lt.value, col=gte.value, col=lte.value, col=in.(a,b,c)
            const match = val.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|not\.is)\.(.*)$/s);
            if (match) {
                const [, op, rawVal] = match;
                const idx = values.length + 1;

                if (op === 'is') {
                    if (rawVal === 'null') {
                        conditions.push(`"${key}" IS NULL`);
                    } else if (rawVal === 'not.null' || rawVal === 'true' || rawVal === 'false') {
                        if (rawVal === 'not.null') conditions.push(`"${key}" IS NOT NULL`);
                        else conditions.push(`"${key}" = ${rawVal}`);
                    }
                } else if (op === 'not.is' && rawVal === 'null') {
                    conditions.push(`"${key}" IS NOT NULL`);
                } else if (op === 'in') {
                    // in.(val1,val2,val3)
                    const inVals = rawVal.replace(/^\(|\)$/g, '').split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    const placeholders = inVals.map((v, i) => {
                        values.push(v);
                        return `$${values.length}`;
                    });
                    conditions.push(`"${key}" IN (${placeholders.join(', ')})`);
                } else if (op === 'like' || op === 'ilike') {
                    const likeVal = rawVal.replace(/\*/g, '%');
                    values.push(likeVal);
                    conditions.push(`"${key}" ${op === 'ilike' ? 'ILIKE' : 'LIKE'} $${idx}`);
                } else if (op === 'cs') {
                    // Contains — for JSONB arrays
                    values.push(rawVal);
                    conditions.push(`"${key}" @> $${idx}::jsonb`);
                } else {
                    const sqlOp = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=' }[op];
                    const parsed = rawVal === 'null' ? null :
                                   rawVal === 'true' ? true :
                                   rawVal === 'false' ? false : rawVal;
                    if (parsed === null) {
                        if (op === 'eq') conditions.push(`"${key}" IS NULL`);
                        else conditions.push(`"${key}" IS NOT NULL`);
                    } else {
                        values.push(parsed);
                        conditions.push(`"${key}" ${sqlOp} $${idx}`);
                    }
                }
            }
        }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { select, where, orderBy, limit, offset, values };
}

// ─── PostgREST-compatible REST API ───────────────────────────────────────────

// GET /rest/v1/:table — Select rows
app.get('/rest/v1/:table', async (req, res) => {
    try {
        const { table } = req.params;
        const prefer = req.headers['prefer'] || '';
        const wantsCount = prefer.includes('count=exact');

        const { select, where, orderBy, limit, offset, values } = parseQuery(table, req.query);

        // Count query if requested
        if (wantsCount) {
            const countSQL = `SELECT COUNT(*) FROM "${table}" ${where}`;
            const countResult = await pool.query(countSQL, values);
            const total = parseInt(countResult.rows[0].count);

            // Also fetch the actual rows
            const lim = limit || 'LIMIT 1000';
            const sql = `SELECT ${select} FROM "${table}" ${where} ${orderBy} ${lim} ${offset}`;
            const result = await pool.query(sql, values);
            res.set('Content-Range', `0-${result.rows.length - 1}/${total}`);
            return res.json(result.rows);
        }

        // Regular select
        const sql = `SELECT ${select} FROM "${table}" ${where} ${orderBy} ${limit || 'LIMIT 1000'} ${offset}`;
        const result = await pool.query(sql, values);

        // Handle single()
        if (prefer.includes('single') || req.query._single) {
            if (result.rows.length === 0) return res.status(406).json({ code: 'PGRST116', message: 'no rows returned' });
            return res.json(result.rows[0]);
        }

        res.json(result.rows);
    } catch (e) {
        console.error(`GET /rest/v1/${req.params.table}:`, e.message);
        res.status(400).json({ code: 'ERROR', message: e.message });
    }
});

// POST /rest/v1/:table — Insert row(s)
app.post('/rest/v1/:table', async (req, res) => {
    try {
        const { table } = req.params;
        const prefer = req.headers['prefer'] || '';
        const wantsReturn = prefer.includes('return=representation');

        const allowedTables = [
            'users', 'products', 'inventory_sections', 'accounts', 'customers',
            'sales', 'expenses', 'wallets', 'wallet_transactions', 'problems',
            'attendance', 'employees', 'salary_payments', 'employee_actions',
            'quick_links', 'inventory_logs'
        ];
        if (!allowedTables.includes(table)) return res.status(400).json({ message: 'Table not allowed' });

        const rows = Array.isArray(req.body) ? req.body : [req.body];
        const inserted = [];

        for (const row of rows) {
            const cols = Object.keys(row).filter(k => row[k] !== undefined);
            const vals = cols.map(c => row[c]);
            const placeholders = cols.map((_, i) => `$${i + 1}`);
            const colNames = cols.map(c => `"${c}"`);

            const sql = `INSERT INTO "${table}" (${colNames.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
            const result = await pool.query(sql, vals);
            inserted.push(result.rows[0]);
        }

        if (wantsReturn) {
            return res.status(201).json(inserted.length === 1 ? inserted[0] : inserted);
        }
        res.status(201).json(inserted.length === 1 ? inserted[0] : inserted);
    } catch (e) {
        console.error(`POST /rest/v1/${req.params.table}:`, e.message);
        res.status(400).json({ code: 'ERROR', message: e.message });
    }
});

// PATCH /rest/v1/:table — Update row(s)
app.patch('/rest/v1/:table', async (req, res) => {
    try {
        const { table } = req.params;
        const prefer = req.headers['prefer'] || '';

        const { where, values } = parseQuery(table, req.query);

        const updateCols = Object.keys(req.body).filter(k => req.body[k] !== undefined);
        if (updateCols.length === 0) return res.status(200).json([]);

        const setClauses = updateCols.map((col, i) => `"${col}" = $${values.length + i + 1}`);
        const updateVals = [...values, ...updateCols.map(c => req.body[c])];

        const sql = `UPDATE "${table}" SET ${setClauses.join(', ')} ${where} RETURNING *`;
        const result = await pool.query(sql, updateVals);

        res.json(result.rows);
    } catch (e) {
        console.error(`PATCH /rest/v1/${req.params.table}:`, e.message);
        res.status(400).json({ code: 'ERROR', message: e.message });
    }
});

// DELETE /rest/v1/:table — Delete row(s)
app.delete('/rest/v1/:table', async (req, res) => {
    try {
        const { table } = req.params;
        const { where, values } = parseQuery(table, req.query);

        if (!where) return res.status(400).json({ message: 'DELETE requires a filter' });

        const sql = `DELETE FROM "${table}" ${where}`;
        await pool.query(sql, values);
        res.status(204).send();
    } catch (e) {
        console.error(`DELETE /rest/v1/${req.params.table}:`, e.message);
        res.status(400).json({ code: 'ERROR', message: e.message });
    }
});

// PUT /rest/v1/:table — Upsert
app.put('/rest/v1/:table', async (req, res) => {
    // Treat PUT as PATCH if filter present, else INSERT
    const hasFilter = Object.keys(req.query).some(k => !['select', 'order', 'limit', 'offset'].includes(k));
    if (hasFilter) {
        return app._router.handle({ ...req, method: 'PATCH' }, res, () => {});
    }
    return app._router.handle({ ...req, method: 'POST' }, res, () => {});
});

// ─── Edge Functions (Auth) ────────────────────────────────────────────────────

// POST /functions/v1/auth-login
app.post('/functions/v1/auth-login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.json({ status: 'error', message: 'بيانات ناقصة' });
        }

        const result = await pool.query(
            'SELECT id, username, role, permissions, password, base_salary, vodafone_cash, token FROM users WHERE username = $1',
            [username.trim()]
        );
        const user = result.rows[0];

        if (!user) return res.json({ status: 'error', message: 'بيانات خطأ' });

        const valid = bcrypt.compareSync(password.trim(), user.password);
        if (!valid) return res.json({ status: 'error', message: 'بيانات خطأ' });

        const token = crypto.randomUUID() + '-' + Date.now();
        await pool.query('UPDATE users SET token = $1 WHERE id = $2', [token, user.id]);

        res.json({
            status: 'success',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions || [],
                base_salary: user.base_salary,
                vodafone_cash: user.vodafone_cash,
            }
        });
    } catch (e) {
        console.error('auth-login error:', e);
        res.json({ status: 'error', message: 'خطأ داخلي: ' + e.message });
    }
});

// POST /functions/v1/auth-check
app.post('/functions/v1/auth-check', async (req, res) => {
    try {
        const { token } = req.body || {};
        if (!token) return res.json(null);

        const result = await pool.query(
            'SELECT id, username, role, permissions, base_salary, vodafone_cash FROM users WHERE token = $1',
            [token.trim()]
        );

        if (!result.rows[0]) return res.json(null);
        res.json(result.rows[0]);
    } catch (e) {
        console.error('auth-check error:', e);
        res.json(null);
    }
});

// POST /functions/v1/auth-logout
app.post('/functions/v1/auth-logout', async (req, res) => {
    try {
        const { token } = req.body || {};
        if (token) {
            await pool.query('UPDATE users SET token = NULL WHERE token = $1', [token.trim()]);
        }
        res.json({ status: 'success' });
    } catch (e) {
        res.json({ status: 'success' }); // Non-critical
    }
});

// POST /functions/v1/auth-change-password
app.post('/functions/v1/auth-change-password', async (req, res) => {
    try {
        const { token, oldPassword, newPassword } = req.body || {};
        if (!token || !oldPassword || !newPassword) {
            return res.json({ success: false, message: 'بيانات ناقصة' });
        }

        const result = await pool.query('SELECT id, password FROM users WHERE token = $1', [token.trim()]);
        const user = result.rows[0];

        if (!user) return res.json({ success: false, message: 'جلسة غير صالحة' });

        const valid = bcrypt.compareSync(oldPassword.trim(), user.password);
        if (!valid) return res.json({ success: false, message: 'كلمة المرور القديمة غلط' });

        const hashedPassword = bcrypt.hashSync(newPassword.trim(), 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);

        res.json({ success: true });
    } catch (e) {
        console.error('auth-change-password error:', e);
        res.json({ success: false, message: 'خطأ داخلي' });
    }
});

// POST /functions/v1/auth-save-user
app.post('/functions/v1/auth-save-user', async (req, res) => {
    try {
        const { token, userData } = req.body || {};
        if (!token || !userData) return res.json({ success: false, message: 'بيانات ناقصة' });

        const callerResult = await pool.query('SELECT id, role FROM users WHERE token = $1', [token.trim()]);
        const caller = callerResult.rows[0];

        if (!caller || (caller.role !== 'admin' && caller.role !== 'owner')) {
            return res.json({ success: false, message: 'غير مصرح' });
        }

        if (userData.id) {
            const updates = {};
            if (userData.username) updates.username = userData.username;
            if (userData.role) updates.role = userData.role;
            if (userData.permissions !== undefined) updates.permissions = JSON.stringify(userData.permissions || []);
            if (userData.base_salary !== undefined) updates.base_salary = userData.base_salary;
            if (userData.vodafone_cash !== undefined) updates.vodafone_cash = userData.vodafone_cash;
            if (userData.password && userData.password.trim()) {
                updates.password = bcrypt.hashSync(userData.password.trim(), 10);
            }

            const cols = Object.keys(updates);
            if (cols.length > 0) {
                const setClauses = cols.map((c, i) => `"${c}" = $${i + 2}`);
                await pool.query(
                    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $1`,
                    [userData.id, ...cols.map(c => updates[c])]
                );
            }
        } else {
            if (!userData.password) return res.json({ success: false, message: 'كلمة المرور مطلوبة' });
            await pool.query(
                'INSERT INTO users (username, password, role, permissions, base_salary, vodafone_cash) VALUES ($1, $2, $3, $4, $5, $6)',
                [
                    userData.username,
                    bcrypt.hashSync(userData.password.trim(), 10),
                    userData.role || 'moderator',
                    JSON.stringify(userData.permissions || []),
                    userData.base_salary || 0,
                    userData.vodafone_cash || ''
                ]
            );
        }

        res.json({ success: true });
    } catch (e) {
        console.error('auth-save-user error:', e);
        res.json({ success: false, message: e.message });
    }
});

// POST /functions/v1/telegram-send
app.post('/functions/v1/telegram-send', async (req, res) => {
    try {
        // Optional token validation — if header present, verify it
        const userToken = req.headers['x-user-token'] || '';
        if (userToken) {
            const userRes = await pool.query(
                'SELECT id FROM users WHERE token = $1 LIMIT 1', [userToken.trim()]
            ).catch(() => ({ rows: [] }));
            if (!userRes.rows[0]) {
                return res.json({ ok: false, error: 'غير مصرح' });
            }
        }

        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        if (!BOT_TOKEN) {
            // Bot not configured — log once and return success silently
            // (prevents frontend errors while still functional without bot)
            return res.json({ ok: true, result: { message_id: null }, _note: 'bot_not_configured' });
        }

        const { action, chatId, text, messageId } = req.body || {};
        if (!chatId || !action) return res.json({ ok: false, error: 'missing params' });

        let url, body;
        if (action === 'send') {
            url  = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            body = { chat_id: String(chatId), text, parse_mode: 'HTML', disable_web_page_preview: true };
        } else if (action === 'delete') {
            url  = `https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`;
            body = { chat_id: String(chatId), message_id: messageId };
        } else if (action === 'edit') {
            url  = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
            body = { chat_id: String(chatId), message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true };
        } else {
            return res.json({ ok: false, error: 'unknown action' });
        }

        const tgRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await tgRes.json();
        res.json(data);
    } catch (e) {
        console.error('telegram-send error:', e.message);
        res.json({ ok: false, error: e.message });
    }
});

// ─── Serve React Frontend ─────────────────────────────────────────
const FRONT_DIST = process.env.FRONT_DIR || '/opt/apps/diaa-store-front/dist';
const fs = require('fs');
if (fs.existsSync(FRONT_DIST)) {
    app.use(express.static(FRONT_DIST));
    // SPA fallback — all non-API routes return index.html
    app.get(/^(?!\/rest\/v1|\/functions\/v1|\/health).*$/, (req, res) => {
        res.sendFile(FRONT_DIST + '/index.html');
    });
    console.log(`📁 Serving frontend from ${FRONT_DIST}`);
} else {
    console.log(`ℹ️  Frontend not found at ${FRONT_DIST} — API-only mode`);
}

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Diaa Store API running on port ${PORT}`);
    console.log(`   DB: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
});

module.exports = app;
