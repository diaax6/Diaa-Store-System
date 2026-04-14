import { supabase } from '../lib/supabase';
import telegram from './telegram';

// ==========================================
// API Service - Replaces all localStorage ops
// ==========================================

// ============ AUTH ============
export const authAPI = {
    async login(username, password) {
        const cleanUsername = (username || '').trim();
        const cleanPassword = (password || '').trim();

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', cleanUsername)
            .single();

        if (error || !data) {
            console.error('Supabase Login Error:', error, 'Data:', data);
            return { status: 'error', message: 'بيانات خطأ' };
        }

        // Import bcryptjs dynamically for password comparison
        let bcrypt;
        try {
            bcrypt = await import('bcryptjs');
            if (bcrypt.default) bcrypt = bcrypt.default;
        } catch (e) {
            console.error('Bcrypt import error:', e);
            return { status: 'error', message: 'خطأ داخلي' };
        }
        
        const valid = await bcrypt.compare(cleanPassword, data.password);
        if (!valid) {
            console.error('Password mismatch');
            return { status: 'error', message: 'بيانات خطأ' };
        }

        // Generate token
        const token = crypto.randomUUID() + '-' + Date.now();
        await supabase.from('users').update({ token }).eq('id', data.id);

        return {
            status: 'success',
            token,
            user: {
                id: data.id,
                username: data.username,
                role: data.role,
                permissions: data.permissions || [],
                base_salary: data.base_salary,
                vodafone_cash: data.vodafone_cash
            }
        };
    },

    async checkAuth(token) {
        if (!token) return null;
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('token', token)
            .single();
        if (error || !data) return null;
        return {
            id: data.id,
            username: data.username,
            role: data.role,
            permissions: data.permissions || [],
            base_salary: data.base_salary,
            vodafone_cash: data.vodafone_cash
        };
    },

    async logout(token) {
        if (!token) return;
        await supabase.from('users').update({ token: null }).eq('token', token);
    }
};

// ============ PRODUCTS ============
export const productsAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) console.error('Products fetch error:', error);
        return data || [];
    },

    async create(product) {
        const id = 'PRD-' + Date.now();
        const row = {
            id,
            name: product.name,
            price: product.price,
            duration: product.duration || 30,
            description: product.description || '',
            category: product.category || '',
            inventory_product: product.inventoryProduct || '',
            fulfillment_type: product.fulfillmentType || 'client_account',
        };
        const { error } = await supabase.from('products').insert(row);
        if (error) throw error;
        return id;
    },

    async update(id, product) {
        const updates = {
            name: product.name,
            price: product.price,
            duration: product.duration || 30,
            description: product.description || '',
            category: product.category || '',
            inventory_product: product.inventoryProduct || '',
            fulfillment_type: product.fulfillmentType || 'client_account',
        };
        const { error } = await supabase.from('products').update(updates).eq('id', id);
        if (error) throw error;
    },

    async updateSortOrder(items) {
        // items = [{ id, sort_order }]
        // هذه العملية اختيارية — لو عمود sort_order مش موجود مش هتعمل مشكلة
        try {
            for (const item of items) {
                await supabase.from('products').update({ sort_order: item.sort_order }).eq('id', item.id);
            }
        } catch (e) {
            console.warn('sort_order column may not exist yet:', e.message);
        }
    },

    async delete(id) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
    },

    // Sync name changes across related tables
    async syncNameChange(oldName, newName) {
        await supabase.from('accounts').update({ product_name: newName }).eq('product_name', oldName);
        await supabase.from('sales').update({ product_name: newName }).eq('product_name', oldName);
        await supabase.from('products').update({ inventory_product: newName }).eq('inventory_product', oldName);
    }
};

// ============ INVENTORY SECTIONS ============
export const sectionsAPI = {
    async getAll() {
        const { data } = await supabase
            .from('inventory_sections')
            .select('*')
            .order('created_at', { ascending: false });
        return data || [];
    },

    async create(section) {
        const id = 'SEC-' + Date.now();
        const { error } = await supabase.from('inventory_sections').insert({
            id,
            name: section.name,
            type: section.type || 'accounts',
        });
        if (error) throw error;
        return id;
    },

    async delete(id, sectionName) {
        await supabase.from('accounts').delete().eq('product_name', sectionName);
        await supabase.from('inventory_sections').delete().eq('id', id);
    }
};

// ============ ACCOUNTS (Inventory) ============
export const accountsAPI = {
    async getAll() {
        const { data } = await supabase
            .from('accounts')
            .select('*')
            .order('created_at', { ascending: false });
        return (data || []).map(a => ({
            ...a,
            productName: a.product_name,
            twoFA: a.two_fa,
            createdBy: a.created_by,
            createdAt: a.created_at,
            isWorkspace: a.is_workspace || false,
            workspaceMembers: a.workspace_members || 0,
            workspaceCost: a.workspace_cost || 0,
        }));
    },

    async create(account) {
        const { data, error } = await supabase.from('accounts').insert({
            email: account.email,
            password: account.password || '',
            two_fa: account.twoFA || '',
            product_name: account.productName,
            status: account.status || 'available',
            allowed_uses: account.allowed_uses,
            current_uses: account.current_uses || 0,
            created_by: account.createdBy || 'Admin',
            is_workspace: account.isWorkspace || false,
            workspace_members: account.workspaceMembers || 0,
            workspace_cost: account.workspaceCost || 0,
        }).select().single();
        if (error) throw error;
        // Calculate available count after adding
        const { data: countData } = await supabase.from('accounts').select('id').eq('product_name', account.productName).eq('status', 'available');
        const availableAfter = (countData || []).length;
        telegram.stockAdded(account.productName, 1, account.createdBy || 'Admin', availableAfter);
        return data;
    },

    async createBulk(accounts) {
        const rows = accounts.map(a => ({
            email: a.email,
            password: a.password || '',
            two_fa: a.twoFA || '',
            product_name: a.productName,
            status: 'available',
            allowed_uses: a.allowed_uses,
            current_uses: 0,
            created_by: a.createdBy || 'Admin',
            is_workspace: a.isWorkspace || false,
            workspace_members: a.workspaceMembers || 0,
            workspace_cost: a.workspaceCost || 0,
        }));
        const { error } = await supabase.from('accounts').insert(rows);
        if (error) throw error;
        // Calculate available count after bulk adding
        const productName = accounts[0]?.productName || 'غير محدد';
        const { data: countData } = await supabase.from('accounts').select('id').eq('product_name', productName).eq('status', 'available');
        const availableAfter = (countData || []).length;
        telegram.stockAdded(productName, rows.length, accounts[0]?.createdBy || 'Admin', availableAfter);
    },

    async update(id, updates) {
        const dbUpdates = {};
        if (updates.email !== undefined) dbUpdates.email = updates.email;
        if (updates.password !== undefined) dbUpdates.password = updates.password;
        if (updates.twoFA !== undefined) dbUpdates.two_fa = updates.twoFA;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.allowed_uses !== undefined) dbUpdates.allowed_uses = updates.allowed_uses;
        if (updates.current_uses !== undefined) dbUpdates.current_uses = updates.current_uses;
        if (updates.productName !== undefined) dbUpdates.product_name = updates.productName;
        if (updates.isWorkspace !== undefined) dbUpdates.is_workspace = updates.isWorkspace;
        if (updates.workspaceMembers !== undefined) dbUpdates.workspace_members = updates.workspaceMembers;
        if (updates.workspaceCost !== undefined) dbUpdates.workspace_cost = updates.workspaceCost;

        const { error } = await supabase.from('accounts').update(dbUpdates).eq('id', id);
        if (error) throw error;

        // Send status change notification if status changed
        if (updates.status !== undefined && updates._oldStatus && updates._oldStatus !== updates.status) {
            const { data: countData } = await supabase.from('accounts').select('id').eq('product_name', updates._productName).eq('status', 'available');
            const availableAfter = (countData || []).length;
            telegram.stockStatusChanged(updates._productName, updates.email || updates._email, updates._oldStatus, updates.status, updates._actionBy, availableAfter);
        }
    },

    async delete(id, accountData, actionBy) {
        // Fetch account info before deleting (for notification)
        let acc = accountData;
        if (!acc) {
            const { data } = await supabase.from('accounts').select('*').eq('id', id).single();
            acc = data;
        }
        await supabase.from('accounts').delete().eq('id', id);
        if (acc) {
            // Calculate remaining available count after delete
            const { data: countData } = await supabase
                .from('accounts')
                .select('id')
                .eq('product_name', acc.product_name || acc.productName)
                .eq('status', 'available');
            const availableAfter = (countData || []).length;
            telegram.stockDeleted(
                acc.product_name || acc.productName || 'غير محدد',
                acc.email,
                actionBy || acc.created_by || 'Admin',
                availableAfter
            );
        }
    },

    async pullNext(sectionName, actionBy) {
        // Get next available account for a section
        const { data } = await supabase
            .from('accounts')
            .select('*')
            .eq('product_name', sectionName)
            .in('status', ['available', 'used'])
            .order('created_at', { ascending: true });

        const available = (data || []).filter(a =>
            a.status === 'available' || (a.status === 'used' && (a.allowed_uses === -1 || a.current_uses < a.allowed_uses))
        );

        if (available.length === 0) return { empty: true };

        const target = available[0];
        const newUses = target.current_uses + 1;
        const newStatus = (target.allowed_uses !== -1 && newUses >= target.allowed_uses) ? 'completed' : 'used';

        await supabase.from('accounts').update({
            current_uses: newUses,
            status: newStatus
        }).eq('id', target.id);

        const result = {
            ...target,
            current_uses: newUses,
            status: newStatus,
            productName: target.product_name,
            twoFA: target.two_fa,
        };
        telegram.inventoryPulled(sectionName, target.email, actionBy, available.length - 1);
        return result;
    }
};

// ============ CUSTOMERS ============
export const customersAPI = {
    async getAll() {
        const { data } = await supabase
            .from('customers')
            .select('*')
            .order('last_order_date', { ascending: false });
        return (data || []).map(c => ({
            ...c,
            contactChannel: c.contact_channel,
            createdAt: c.created_at,
            lastOrderDate: c.last_order_date,
        }));
    },

    async upsert(customer) {
        // Check if exists by name+phone
        const { data: existing } = await supabase
            .from('customers')
            .select('*')
            .eq('name', customer.name)
            .eq('phone', customer.phone || '')
            .maybeSingle();

        if (existing) {
            await supabase.from('customers').update({
                email: customer.email || existing.email,
                contact_channel: customer.contactChannel || existing.contact_channel,
                last_order_date: new Date().toISOString()
            }).eq('id', existing.id);
            return existing.id;
        }

        const id = 'CUS-' + Date.now();
        await supabase.from('customers').insert({
            id,
            name: customer.name,
            phone: customer.phone || '',
            email: customer.email || '',
            contact_channel: customer.contactChannel || 'واتساب',
        });
        return id;
    },

    async updateLastOrder(id, email) {
        const updates = { last_order_date: new Date().toISOString() };
        if (email) updates.email = email;
        await supabase.from('customers').update(updates).eq('id', id);
    }
};

// ============ SALES ============
export const salesAPI = {
    async getAll() {
        const { data } = await supabase
            .from('sales')
            .select('*')
            .order('date', { ascending: false });
        return (data || []).map(s => ({
            ...s,
            productName: s.product_name,
            originalPrice: s.original_price,
            finalPrice: s.final_price,
            customerId: s.customer_id,
            customerName: s.customer_name,
            customerPhone: s.customer_phone,
            customerEmail: s.customer_email,
            contactChannel: s.contact_channel,
            isPaid: s.is_paid,
            remainingAmount: s.remaining_amount,
            paymentMethod: s.payment_method,
            walletId: s.wallet_id,
            walletName: s.wallet_name,
            expiryDate: s.expiry_date,
            assignedAccountEmail: s.assigned_account_email,
            assignedAccountId: s.assigned_account_id,
            fromInventory: s.from_inventory,
            saleType: s.sale_type || 'personal',
            workspaceEmail: s.workspace_email || '',
            isActivated: s.is_activated || false,
            customerPassword: s.customer_password || '',
            processingStatus: s.processing_status || 'new',
            processingBy: s.processing_by || '',
            activatedBy: s.activated_by || '',
        }));
    },

    async create(sale) {
        const insertData = {
            product_name: sale.productName,
            original_price: sale.originalPrice,
            discount: sale.discount || 0,
            final_price: sale.finalPrice,
            duration: sale.duration || 30,
            expiry_date: sale.expiryDate,
            customer_id: sale.customerId || null,
            customer_name: sale.customerName || '',
            customer_phone: sale.customerPhone || '',
            customer_email: sale.customerEmail || '',
            contact_channel: sale.contactChannel || 'واتساب',
            is_paid: sale.isPaid,
            remaining_amount: sale.remainingAmount || 0,
            payment_method: sale.paymentMethod || '',
            wallet_id: sale.walletId || null,
            wallet_name: sale.walletName || '',
            notes: sale.notes || '',
            moderator: sale.moderator || 'Admin',
            assigned_account_email: sale.assignedAccountEmail || '',
            assigned_account_id: sale.assignedAccountId || null,
            from_inventory: sale.fromInventory || false,
            sale_type: sale.saleType || 'personal',
            workspace_email: sale.workspaceEmail || '',
            is_activated: sale.isActivated || false,
            customer_password: sale.customerPassword || '',
            processing_status: 'new',
            processing_by: '',
            activated_by: '',
        };
        // لو فيه تاريخ مخصوص (تسجيل بتاريخ قديم)
        if (sale.date) {
            insertData.date = sale.date;
        }
        const { data, error } = await supabase.from('sales').insert(insertData).select().single();
        if (error) {
            // Fallback: if processing columns don't exist yet, retry without them
            if (error.message && error.message.includes('schema cache')) {
                delete insertData.processing_status;
                delete insertData.processing_by;
                delete insertData.activated_by;
                const { data: data2, error: error2 } = await supabase.from('sales').insert(insertData).select().single();
                if (error2) throw error2;
                telegram.newSale({ ...sale, id: data2.id });
                return data2;
            }
            throw error;
        }
        telegram.newSale({ ...sale, id: data.id });
        return data;
    },

    async update(id, sale) {
        const { error } = await supabase.from('sales').update({
            product_name: sale.productName,
            original_price: sale.originalPrice,
            discount: sale.discount || 0,
            final_price: sale.finalPrice,
            duration: sale.duration,
            expiry_date: sale.expiryDate,
            customer_id: sale.customerId || null,
            customer_name: sale.customerName || '',
            customer_phone: sale.customerPhone || '',
            customer_email: sale.customerEmail || '',
            contact_channel: sale.contactChannel || 'واتساب',
            is_paid: sale.isPaid,
            remaining_amount: sale.remainingAmount || 0,
            payment_method: sale.paymentMethod || '',
            wallet_id: sale.walletId || null,
            wallet_name: sale.walletName || '',
            notes: sale.notes || '',
            sale_type: sale.saleType || 'personal',
            workspace_email: sale.workspaceEmail || '',
            is_activated: sale.isActivated !== undefined ? sale.isActivated : false,
            customer_password: sale.customerPassword || '',
        }).eq('id', id);
        if (error) throw error;
    },

    async delete(id) {
        await supabase.from('sales').delete().eq('id', id);
    },

    async togglePaid(id, isPaid, finalPrice, saleInfo, actionBy) {
        await supabase.from('sales').update({
            is_paid: isPaid,
            remaining_amount: isPaid ? 0 : finalPrice
        }).eq('id', id);
        if (isPaid && saleInfo) telegram.debtPaid(saleInfo, actionBy);
    },

    async toggleActivated(id, isActivated, saleInfo, activatedBy) {
        const updates = {
            is_activated: isActivated,
            processing_status: isActivated ? 'activated' : 'new',
            activated_by: isActivated ? (activatedBy || 'Admin') : '',
        };
        // لو بنلغي التفعيل — نرجع الحالة لـ new
        if (!isActivated) {
            updates.processing_by = '';
        }
        const { error } = await supabase.from('sales').update(updates).eq('id', id);
        if (error && error.message && error.message.includes('schema cache')) {
            // Fallback: columns don't exist yet
            await supabase.from('sales').update({ is_activated: isActivated }).eq('id', id);
        }
        if (isActivated && saleInfo) {
            telegram.saleActivated(saleInfo, activatedBy);
        } else if (!isActivated && saleInfo) {
            telegram.saleDeactivated(saleInfo, activatedBy);
        }
    },

    async setProcessing(id, status, saleInfo, processingBy) {
        // status: 'processing' or 'new' (revert)
        const updates = {
            processing_status: status,
            processing_by: status === 'processing' ? (processingBy || '') : '',
        };
        const { error } = await supabase.from('sales').update(updates).eq('id', id);
        if (error && error.message && error.message.includes('schema cache')) {
            // Columns don't exist yet — skip silently
            console.warn('Processing columns not found. Run SQL migration.');
            return;
        }
        if (status === 'processing' && saleInfo) {
            telegram.saleProcessing(saleInfo, processingBy);
        } else if (status === 'new' && saleInfo) {
            telegram.saleReverted(saleInfo);
        }
    }
};

// ============ EXPENSES ============
export const expensesAPI = {
    async getAll() {
        const { data } = await supabase
            .from('expenses')
            .select('*')
            .order('created_at', { ascending: false });
        return (data || []).map(e => ({
            ...e,
            walletId: e.wallet_id,
            walletName: e.wallet_name,
            expenseCategory: e.expense_category || 'daily',
        }));
    },

    async create(expense) {
        const { data, error } = await supabase.from('expenses').insert({
            type: expense.type,
            amount: expense.amount,
            description: expense.description || '',
            date: expense.date,
            wallet_id: expense.walletId || '',
            wallet_name: expense.walletName || '',
            expense_category: expense.expenseCategory || 'daily',
        }).select().single();
        if (error) throw error;
        telegram.expenseAdded(expense, expense.actionBy);
        return data;
    },

    async update(id, expense) {
        const updates = {
            type: expense.type,
            amount: expense.amount,
            description: expense.description || '',
            date: expense.date,
        };
        if (expense.expenseCategory !== undefined) updates.expense_category = expense.expenseCategory;
        const { error } = await supabase.from('expenses').update(updates).eq('id', id);
        if (error) throw error;
        if (expense._oldExpense) {
            telegram.expenseEdited(expense._oldExpense, expense, expense._actionBy);
        }
    },

    async delete(id, expenseData, actionBy) {
        await supabase.from('expenses').delete().eq('id', id);
        if (expenseData) {
            telegram.expenseDeleted(expenseData, actionBy);
        }
    }
};

// ============ WALLETS ============
export const walletsAPI = {
    async getAll() {
        const { data } = await supabase
            .from('wallets')
            .select('*')
            .order('created_at', { ascending: false });
        return (data || []).map(w => ({
            ...w,
            initialBalance: w.initial_balance,
            createdBy: w.created_by,
            createdAt: w.created_at,
        }));
    },

    async create(wallet) {
        const { data, error } = await supabase.from('wallets').insert({
            name: wallet.name,
            currency: wallet.currency || 'EGP',
            initial_balance: wallet.initialBalance || 0,
            balance: wallet.initialBalance || 0,
            created_by: wallet.createdBy || 'Admin',
        }).select().single();
        if (error) throw error;
        return data;
    },

    async update(id, updates) {
        const dbUpdates = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
        if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
        const { error } = await supabase.from('wallets').update(dbUpdates).eq('id', id);
        if (error) throw error;
    },

    async delete(id) {
        await supabase.from('wallet_transactions').delete().eq('wallet_id', id);
        await supabase.from('wallets').delete().eq('id', id);
    },

    async deposit(walletId, amount, description, source, by) {
        // Get current wallet
        const { data: wallet } = await supabase.from('wallets').select('*').eq('id', walletId).single();
        if (!wallet) return;

        const newBalance = Number(wallet.balance) + Number(amount);
        await supabase.from('wallets').update({ balance: newBalance }).eq('id', walletId);

        await supabase.from('wallet_transactions').insert({
            wallet_id: walletId,
            type: 'deposit',
            amount: Number(amount),
            description,
            source: source || 'يدوي',
            balance_after: newBalance,
            created_by: by || 'System',
        });

        return newBalance;
    },

    async withdraw(walletId, amount, description, source, by) {
        const { data: wallet } = await supabase.from('wallets').select('*').eq('id', walletId).single();
        if (!wallet) return;

        const newBalance = Number(wallet.balance) - Number(amount);
        await supabase.from('wallets').update({ balance: newBalance }).eq('id', walletId);

        await supabase.from('wallet_transactions').insert({
            wallet_id: walletId,
            type: 'withdraw',
            amount: Number(amount),
            description,
            source: source || 'يدوي',
            balance_after: newBalance,
            created_by: by || 'System',
        });

        return newBalance;
    },

    async getTransactions(walletId) {
        const query = supabase.from('wallet_transactions').select('*').order('date', { ascending: false });
        if (walletId) query.eq('wallet_id', walletId);
        const { data } = await query;
        return (data || []).map(t => ({
            ...t,
            walletId: t.wallet_id,
            balanceAfter: t.balance_after,
            by: t.created_by,
        }));
    },

    async deleteTransaction(txn) {
        // Reverse the transaction
        const { data: wallet } = await supabase.from('wallets').select('*').eq('id', txn.wallet_id || txn.walletId).single();
        if (wallet) {
            const newBalance = txn.type === 'deposit'
                ? Number(wallet.balance) - Number(txn.amount)
                : Number(wallet.balance) + Number(txn.amount);
            await supabase.from('wallets').update({ balance: newBalance }).eq('id', wallet.id);
        }
        await supabase.from('wallet_transactions').delete().eq('id', txn.id);
    }
};

// ============ USERS MANAGEMENT ============
export const usersAPI = {
    async getAll() {
        const { data } = await supabase
            .from('users')
            .select('id, username, role, permissions, base_salary, vodafone_cash, created_at')
            .order('id', { ascending: true });
        return (data || []).map(u => ({
            ...u,
            // Keep permissions as-is (already JSONB from Supabase)
        }));
    },

    async save(userData) {
        if (userData.id) {
            // Update existing
            const updates = {
                username: userData.username,
                role: userData.role || 'moderator',
                permissions: userData.permissions || [],
                base_salary: userData.base_salary || 0,
                vodafone_cash: userData.vodafone_cash || '',
            };
            if (userData.password) {
                const bcrypt = await import('bcryptjs');
                updates.password = await bcrypt.hash(userData.password, 10);
            }
            const { error } = await supabase.from('users').update(updates).eq('id', userData.id);
            if (error) { console.error('Update user error:', error); throw error; }
        } else {
            // Create new
            const bcrypt = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            const { error } = await supabase.from('users').insert({
                username: userData.username,
                password: hashedPassword,
                role: userData.role || 'moderator',
                permissions: userData.permissions || [],
                base_salary: userData.base_salary || 0,
                vodafone_cash: userData.vodafone_cash || '',
            });
            if (error) { console.error('Create user error:', error); throw error; }
        }
    },

    async delete(id) {
        await supabase.from('users').delete().eq('id', id);
    }
};

// ============ ATTENDANCE ============
export const attendanceAPI = {
    async getByMonth(month) {
        const { data } = await supabase
            .from('attendance')
            .select('*')
            .like('date', `${month}%`)
            .order('date', { ascending: false });
        return (data || []).map(a => ({
            ...a,
            user_id: a.user_id,
            check_in: a.check_in,
            bonus: a.bonus,
        }));
    },

    async checkIn(userId, date, time) {
        // Check if already checked in
        const { data: existing } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle();

        if (existing && existing.check_in) return { alreadyExists: true };

        if (existing) {
            // Update existing record
            await supabase.from('attendance').update({ check_in: time }).eq('id', existing.id);
        } else {
            await supabase.from('attendance').insert({
                user_id: userId,
                date,
                check_in: time,
                bonus: 0,
            });
        }
        return { success: true };
    },

    async addBonus(userId, date, amount) {
        const { data: existing } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle();

        if (existing) {
            const newBonus = Number(existing.bonus || 0) + Number(amount);
            await supabase.from('attendance').update({ bonus: newBonus }).eq('id', existing.id);
        } else {
            await supabase.from('attendance').insert({
                user_id: userId,
                date,
                check_in: null,
                bonus: Number(amount),
            });
        }
    },

    async getUserHistory(userId, from, to) {
        const { data } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .gte('date', from)
            .lte('date', to)
            .order('date', { ascending: false });
        return data || [];
    }
};

// ============ PROBLEMS ============
export const problemsAPI = {
    async getAll() {
        const { data } = await supabase
            .from('problems')
            .select('*')
            .order('created_at', { ascending: false });
        return (data || []).map(p => ({
            ...p,
            customerName: p.customer_name,
            phoneNumber: p.phone_number,
            productName: p.product_name,
            isResolved: p.is_resolved || false,
            resolvedAt: p.resolved_at || null,
        }));
    },

    async create(problem) {
        const { data, error } = await supabase.from('problems').insert({
            sale_id: problem.saleId,
            customer_name: problem.customerName || '',
            phone_number: problem.phoneNumber || '',
            product_name: problem.productName || '',
            description: problem.description,
            replacement_account_id: problem.replacementAccountId || null,
            is_resolved: false,
        }).select().single();
        if (error) throw error;
        telegram.newProblem({ accountEmail: problem.customerName, description: problem.description }, problem.actionBy);
        return data;
    },

    async markResolved(id, problemInfo) {
        const { error } = await supabase.from('problems').update({
            is_resolved: true,
            resolved_at: new Date().toISOString(),
        }).eq('id', id);
        if (error) throw error;
        if (problemInfo) telegram.problemResolved({ accountEmail: problemInfo.customerName, description: problemInfo.description }, problemInfo.actionBy);
    },

    async delete(id) {
        const { error } = await supabase.from('problems').delete().eq('id', id);
        if (error) throw error;
    },
};

// ============ QUICK LINKS ============
export const quickLinksAPI = {
    async getAll() {
        const { data } = await supabase
            .from('quick_links')
            .select('*')
            .order('created_at', { ascending: true });
        return (data || []).map(l => ({
            id: l.id,
            label: l.label,
            url: l.url,
            createdBy: l.created_by,
            createdAt: l.created_at,
        }));
    },

    async create(link) {
        const { error } = await supabase.from('quick_links').insert({
            label: link.label,
            url: link.url,
            created_by: link.createdBy || 'Admin',
        });
        if (error) throw error;
    },

    async delete(id) {
        const { error } = await supabase.from('quick_links').delete().eq('id', id);
        if (error) throw error;
    },
};

// ============ EMPLOYEES ============
export const employeesAPI = {
    async getAll() {
        const { data } = await supabase
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false });
        return (data || []).map(e => ({
            ...e,
            baseSalary: e.base_salary,
            absenceDays: e.absence_days,
            absenceDeductionPerDay: e.absence_deduction_per_day,
            isActive: e.is_active,
            joinDate: e.join_date,
            payDay: e.pay_day || 'thursday',
            linked_user_id: e.linked_user_id || null,
        }));
    },

    async create(emp) {
        const { data, error } = await supabase.from('employees').insert({
            name: emp.name,
            phone: emp.phone || '',
            role: emp.role || '',
            base_salary: emp.baseSalary || 0,
            bonus: emp.bonus || 0,
            deductions: emp.deductions || 0,
            absence_days: emp.absenceDays || 0,
            absence_deduction_per_day: emp.absenceDeductionPerDay || 0,
            notes: emp.notes || '',
            is_active: emp.isActive !== false,
            join_date: emp.joinDate || new Date().toISOString().split('T')[0],
            pay_day: emp.payDay || 'thursday',
            linked_user_id: emp.linked_user_id || null,
        }).select().single();
        if (error) throw error;
        return data;
    },

    async update(id, emp) {
        const updates = {};
        if (emp.name !== undefined) updates.name = emp.name;
        if (emp.phone !== undefined) updates.phone = emp.phone;
        if (emp.role !== undefined) updates.role = emp.role;
        if (emp.baseSalary !== undefined) updates.base_salary = emp.baseSalary;
        if (emp.bonus !== undefined) updates.bonus = emp.bonus;
        if (emp.deductions !== undefined) updates.deductions = emp.deductions;
        if (emp.absenceDays !== undefined) updates.absence_days = emp.absenceDays;
        if (emp.absenceDeductionPerDay !== undefined) updates.absence_deduction_per_day = emp.absenceDeductionPerDay;
        if (emp.notes !== undefined) updates.notes = emp.notes;
        if (emp.isActive !== undefined) updates.is_active = emp.isActive;
        if (emp.payDay !== undefined) updates.pay_day = emp.payDay;
        if (emp.linked_user_id !== undefined) updates.linked_user_id = emp.linked_user_id || null;
        const { error } = await supabase.from('employees').update(updates).eq('id', id);
        if (error) throw error;
    },

    async delete(id) {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
    },
};

// ============ SALARY PAYMENTS ============
export const salaryPaymentsAPI = {
    async getAll() {
        const { data } = await supabase.from('salary_payments').select('*').order('payment_date', { ascending: false });
        return (data || []).map(p => ({ ...p, employeeId: p.employee_id, paymentDate: p.payment_date, walletId: p.wallet_id, walletName: p.wallet_name }));
    },
    async getByEmployee(employeeId) {
        const { data } = await supabase.from('salary_payments').select('*').eq('employee_id', employeeId).order('payment_date', { ascending: false });
        return (data || []).map(p => ({ ...p, employeeId: p.employee_id, paymentDate: p.payment_date, walletId: p.wallet_id, walletName: p.wallet_name }));
    },
    async create(payment) {
        const { data, error } = await supabase.from('salary_payments').insert({
            employee_id: payment.employeeId,
            amount: payment.amount,
            payment_date: payment.paymentDate || new Date().toISOString().split('T')[0],
            notes: payment.notes || '',
            wallet_id: payment.walletId || null,
            wallet_name: payment.walletName || '',
        }).select().single();
        if (error) throw error;

        // Record as expense
        if (payment.amount > 0) {
            const expDate = payment.paymentDate || new Date().toISOString().split('T')[0];
            await supabase.from('expenses').insert({
                type: 'قبض موظف',
                amount: payment.amount,
                description: `مرتب ${payment.empName || 'موظف'}${payment.notes ? ' — ' + payment.notes : ''}`,
                date: expDate,
                wallet_id: payment.walletId || '',
                wallet_name: payment.walletName || '',
                expense_category: 'salary',
            });

            // Deduct from wallet
            if (payment.walletId) {
                const { data: wallet } = await supabase.from('wallets').select('*').eq('id', payment.walletId).single();
                if (wallet) {
                    const newBalance = Number(wallet.balance) - Number(payment.amount);
                    await supabase.from('wallets').update({ balance: newBalance }).eq('id', payment.walletId);
                    await supabase.from('wallet_transactions').insert({
                        wallet_id: payment.walletId,
                        type: 'withdraw',
                        amount: Number(payment.amount),
                        description: `قبض مرتب ${payment.empName || 'موظف'}`,
                        source: 'مرتبات',
                        balance_after: newBalance,
                        created_by: payment.actionBy || 'System',
                    });
                }
            }

            // Telegram notification
            telegram.salaryPayment(payment.empName || 'موظف', payment.amount, payment.walletName, payment.actionBy, payment.notes);
        }

        return data;
    },
    async delete(id) {
        const { error } = await supabase.from('salary_payments').delete().eq('id', id);
        if (error) throw error;
    },
};

// ============ EMPLOYEE ACTIONS ============
export const employeeActionsAPI = {
    async getByEmployee(employeeId) {
        const { data } = await supabase.from('employee_actions').select('*').eq('employee_id', employeeId).order('action_date', { ascending: false });
        return (data || []).map(a => ({ ...a, employeeId: a.employee_id, actionType: a.action_type, actionDate: a.action_date }));
    },
    async create(action) {
        const { data, error } = await supabase.from('employee_actions').insert({
            employee_id: action.employeeId, action_type: action.actionType,
            amount: action.amount || 0, description: action.description || '',
            action_date: action.actionDate || new Date().toISOString().split('T')[0],
        }).select().single();
        if (error) throw error;
        return data;
    },
    async delete(id) {
        const { error } = await supabase.from('employee_actions').delete().eq('id', id);
        if (error) throw error;
    },
};

// ============ SHIFTS ============
export const shiftsAPI = {
    async getAll() {
        const { data } = await supabase
            .from('shifts')
            .select('*, shift_employees(employee_id)')
            .order('created_at', { ascending: true });
        return (data || []).map(s => ({
            ...s,
            employeeIds: (s.shift_employees || []).map(se => se.employee_id),
        }));
    },

    async create(shift) {
        const { data, error } = await supabase.from('shifts').insert({
            name: shift.name,
            start_time: shift.startTime || '08:00',
            end_time: shift.endTime || '16:00',
            color: shift.color || 'blue',
        }).select().single();
        if (error) throw error;
        return data;
    },

    async update(id, shift) {
        const updates = {};
        if (shift.name !== undefined) updates.name = shift.name;
        if (shift.startTime !== undefined) updates.start_time = shift.startTime;
        if (shift.endTime !== undefined) updates.end_time = shift.endTime;
        if (shift.color !== undefined) updates.color = shift.color;
        const { error } = await supabase.from('shifts').update(updates).eq('id', id);
        if (error) throw error;
    },

    async delete(id) {
        const { error } = await supabase.from('shifts').delete().eq('id', id);
        if (error) throw error;
    },

    async addEmployee(shiftId, employeeId) {
        const { error } = await supabase.from('shift_employees').insert({
            shift_id: shiftId,
            employee_id: employeeId,
        });
        if (error && !error.message?.includes('duplicate')) throw error;
    },

    async removeEmployee(shiftId, employeeId) {
        const { error } = await supabase
            .from('shift_employees')
            .delete()
            .eq('shift_id', shiftId)
            .eq('employee_id', employeeId);
        if (error) throw error;
    },
};

// Add wallet_id & wallet_name columns to salary_payments if not exists (handled by SQL migration)

