/**
 * Supabase Compatibility Layer
 * ─────────────────────────────────────────────────────────────────
 * Replaces @supabase/supabase-js with a zero-dependency fetch wrapper.
 * Implements the exact same API surface that the app uses, routing all
 * requests to our self-hosted Express/PostgreSQL backend.
 *
 * Supported:
 *  - supabase.from(table).select/insert/update/delete + all filters
 *  - supabase.functions.invoke(func, { body })
 *  - supabase.channel().on(...).subscribe() → replaced by 5s polling
 *  - supabase.removeChannel() / removeAllChannels()
 *
 * Environment Variables (same as before, just point VITE_SUPABASE_URL to new server):
 *  VITE_SUPABASE_URL  = https://sys.diaastore.cloud
 *  VITE_SUPABASE_ANON_KEY = (kept for backward compat, unused)
 * ─────────────────────────────────────────────────────────────────
 */

const API_URL = (() => {
    // ALWAYS use the same origin the page was loaded from.
    // This means the app works on ANY domain/IP without rebuilding:
    //   https://sys.diaastore.cloud  →  calls sys.diaastore.cloud
    //   https://sys.diaa.store       →  calls sys.diaa.store
    //   http://79.137.74.166:4000    →  calls 79.137.74.166:4000
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    // SSR/build fallback
    return (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
})();

const TOKEN_KEY = 'diaa-store_token';
const POLL_INTERVAL_MS = 6000; // 6 seconds for realtime replacement

// Active polling intervals (for cleanup)
const _activeChannels = new Set();

function _getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
}

function _getHeaders(extra = {}) {
    return {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'anon',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || 'anon'}`,
        'x-user-token': _getToken(),
        ...extra,
    };
}

// ─── Query Builder ────────────────────────────────────────────────
class QueryBuilder {
    constructor(table) {
        this._table      = table;
        this._fields     = '*';
        this._count      = false;   // count=exact requested
        this._filters    = [];      // [{ col, op, val }]
        this._orders     = [];      // [{ col, asc }]
        this._limitVal   = null;
        this._single     = false;
        this._maybeSingle = false;
        // Mutation state
        this._mode       = 'select'; // 'select'|'insert'|'update'|'delete'
        this._body       = null;
    }

    // ── Field selection ──────────────────────────────────────────
    select(fields = '*', opts = {}) {
        this._fields = fields;
        if (opts.count === 'exact') this._count = true;
        return this;
    }

    // ── Filters ──────────────────────────────────────────────────
    eq(col, val)    { this._filters.push({ col, op: 'eq',   val }); return this; }
    neq(col, val)   { this._filters.push({ col, op: 'neq',  val }); return this; }
    gt(col, val)    { this._filters.push({ col, op: 'gt',   val }); return this; }
    gte(col, val)   { this._filters.push({ col, op: 'gte',  val }); return this; }
    lt(col, val)    { this._filters.push({ col, op: 'lt',   val }); return this; }
    lte(col, val)   { this._filters.push({ col, op: 'lte',  val }); return this; }
    like(col, val)  { this._filters.push({ col, op: 'like', val }); return this; }
    ilike(col, val) { this._filters.push({ col, op: 'ilike',val }); return this; }
    is(col, val)    { this._filters.push({ col, op: 'is',   val }); return this; }
    in(col, vals)   { this._filters.push({ col, op: 'in',   val: vals }); return this; }
    contains(col, val) { this._filters.push({ col, op: 'cs', val }); return this; }

    // ── Ordering & limiting ──────────────────────────────────────
    order(col, opts = {}) {
        this._orders.push({ col, asc: opts.ascending !== false });
        return this;
    }
    limit(n) { this._limitVal = n; return this; }

    // ── Result shaping ───────────────────────────────────────────
    single()      { this._single      = true; return this; }
    maybeSingle() { this._maybeSingle = true; return this; }

    // ── Mutations ────────────────────────────────────────────────
    insert(data) { this._mode = 'insert'; this._body = data; return this; }
    update(data) { this._mode = 'update'; this._body = data; return this; }
    delete()     { this._mode = 'delete'; return this; }
    upsert(data, _opts) {
        // Manual upsert — try insert, fall back to update on conflict
        this._mode = 'upsert';
        this._body = data;
        return this;
    }

    // ── URL builder ──────────────────────────────────────────────
    _buildUrl() {
        const params = new URLSearchParams();

        if (this._fields && this._fields !== '*' && this._mode === 'select') {
            // Simplify nested selects — just take column names
            const cols = this._fields.split(',').map(c => c.trim().split(':')[0].split('(')[0].trim());
            params.set('select', cols.join(','));
        }

        this._filters.forEach(({ col, op, val }) => {
            if (op === 'in') {
                const list = Array.isArray(val) ? val.join(',') : val;
                params.set(col, `in.(${list})`);
            } else if (val === null || val === undefined) {
                params.set(col, 'is.null');
            } else {
                params.set(col, `${op}.${val}`);
            }
        });

        if (this._orders.length > 0) {
            params.set('order', this._orders.map(o => `${o.col}.${o.asc ? 'asc' : 'desc'}`).join(','));
        }

        if (this._limitVal) params.set('limit', String(this._limitVal));

        const qs = params.toString();
        return `${API_URL}/rest/v1/${this._table}${qs ? '?' + qs : ''}`;
    }

    // ── Core execution ───────────────────────────────────────────
    async _execute() {
        const headers = _getHeaders();
        let method = 'GET';
        let body   = null;

        switch (this._mode) {
            case 'insert':
                method = 'POST';
                body   = JSON.stringify(this._body);
                headers['Prefer'] = 'return=representation';
                break;
            case 'update':
                method = 'PATCH';
                body   = JSON.stringify(this._body);
                headers['Prefer'] = 'return=representation';
                break;
            case 'delete':
                method = 'DELETE';
                break;
            case 'upsert':
                // try insert, the server handles RETURNING *
                method = 'POST';
                body   = JSON.stringify(this._body);
                headers['Prefer'] = 'return=representation';
                break;
            default:
                if (this._count) headers['Prefer'] = 'count=exact';
        }

        const url = this._buildUrl();

        try {
            const res = await fetch(url, { method, headers, body });

            // DELETE → no body expected
            if (method === 'DELETE') {
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { data: null, error: err };
                }
                return { data: null, error: null };
            }

            // Count query
            if (this._count) {
                const contentRange = res.headers.get('Content-Range') || '0-0/0';
                const total = parseInt(contentRange.split('/').pop(), 10) || 0;
                const data  = res.ok ? await res.json().catch(() => []) : [];
                return { data, error: null, count: total };
            }

            const raw = await res.json();

            if (!res.ok) return { data: null, error: raw };

            // INSERT / UPDATE / UPSERT — return first item or array
            if (this._mode === 'insert' || this._mode === 'upsert') {
                if (Array.isArray(this._body)) {
                    return { data: Array.isArray(raw) ? raw : [raw], error: null };
                }
                return { data: Array.isArray(raw) ? (raw[0] ?? raw) : raw, error: null };
            }

            if (this._mode === 'update') {
                return { data: Array.isArray(raw) ? (raw[0] ?? raw) : raw, error: null };
            }

            // SELECT single / maybeSingle
            if (this._single) {
                const row = Array.isArray(raw) ? raw[0] : raw;
                if (!row) return { data: null, error: { code: 'PGRST116', message: 'no rows returned' } };
                return { data: row, error: null };
            }
            if (this._maybeSingle) {
                const row = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
                return { data: row, error: null };
            }

            return { data: Array.isArray(raw) ? raw : [raw], error: null };

        } catch (e) {
            console.error(`[supabase-compat] ${method} ${url} error:`, e.message);
            return { data: null, error: { message: e.message } };
        }
    }

    // Make this thenable so `await supabase.from(...)...` works
    then(resolve, reject) {
        return this._execute().then(resolve, reject);
    }
}

// ─── Channel (Realtime replacement via polling) ───────────────────
class Channel {
    constructor(name, opts = {}) {
        this._name      = name;
        this._handlers  = []; // { type, filter, cb }
        this._intervalId = null;
        this._broadcastMode = !!(opts.config?.broadcast);
    }

    on(type, filter, cb) {
        this._handlers.push({ type, filter, cb });
        return this;
    }

    subscribe(statusCb) {
        // Always report SUBSCRIBED
        if (typeof statusCb === 'function') {
            setTimeout(() => statusCb('SUBSCRIBED'), 0);
        }

        if (!this._broadcastMode && this._handlers.length > 0) {
            // Start polling for postgres_changes channels
            this._intervalId = setInterval(() => {
                const pgHandlers = this._handlers.filter(h => h.type === 'postgres_changes');
                if (pgHandlers.length > 0) {
                    // Fire first handler — DataContext debouncedFetch does the rest
                    pgHandlers[0].cb({ eventType: 'poll', new: {}, old: {} });
                }
            }, POLL_INTERVAL_MS);
        }

        _activeChannels.add(this);
        return this;
    }

    unsubscribe() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
        _activeChannels.delete(this);
        return this;
    }

    // Broadcast send — no-op in this setup (polling handles multi-device sync)
    send(_payload) {
        return Promise.resolve({ status: 'ok' });
    }
}

// ─── Main supabase export ─────────────────────────────────────────
export const supabase = {
    from(table) {
        return new QueryBuilder(table);
    },

    functions: {
        async invoke(funcName, options = {}) {
            try {
                const res = await fetch(`${API_URL}/functions/v1/${funcName}`, {
                    method: 'POST',
                    headers: _getHeaders(),
                    body: JSON.stringify(options.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { data: null, error: data };
                return { data, error: null };
            } catch (e) {
                console.warn(`[supabase-compat] functions.invoke(${funcName}) error:`, e.message);
                return { data: null, error: { message: e.message } };
            }
        },
    },

    channel(name, opts = {}) {
        return new Channel(name, opts);
    },

    removeChannel(ch) {
        if (ch && typeof ch.unsubscribe === 'function') ch.unsubscribe();
    },

    removeAllChannels() {
        _activeChannels.forEach(ch => ch.unsubscribe());
        _activeChannels.clear();
    },
};
