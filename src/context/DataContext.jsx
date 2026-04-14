import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import {
    productsAPI,
    salesAPI,
    accountsAPI,
    expensesAPI,
    walletsAPI,
    customersAPI,
    sectionsAPI,
    problemsAPI,
    inventoryLogsAPI,
    employeesAPI
} from '../services/api';
import telegram from '../services/telegram';

const DataContext = createContext();
const SORT_KEY = 'diaa-store_product_order';

const getSavedOrder = () => {
    try { return JSON.parse(localStorage.getItem(SORT_KEY) || '{}'); } catch { return {}; }
};

const sortProducts = (products, orderMap) => {
    return [...products].sort((a, b) => {
        const catA = (a.category || 'بدون تصنيف').toLowerCase();
        const catB = (b.category || 'بدون تصنيف').toLowerCase();
        if (catA !== catB) return catA.localeCompare(catB);
        return (orderMap[a.id] ?? 999) - (orderMap[b.id] ?? 999);
    });
};

// الجداول اللي هنراقبها في الوقت الحقيقي
const REALTIME_TABLES = [
    'sales',
    'products',
    'accounts',
    'customers',
    'wallets',
    'wallet_transactions',
    'expenses',
    'inventory_sections',
    'problems',
    'attendance',
    'employees',
    'salary_payments',
    'employee_actions',
    'users',
    'inventory_logs',
];

export const DataProvider = ({ children }) => {
    const { user } = useAuth();

    // --- Data States ---
    const [sales, setSales] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [rawProducts, setRawProducts] = useState([]);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [wallets, setWallets] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [sections, setSections] = useState([]);
    const [problems, setProblems] = useState([]);
    const [inventoryLogs, setInventoryLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [productSortOrder, setProductSortOrder] = useState(getSavedOrder);

    // --- Stats State ---
    const [stats, setStats] = useState({
        revenue: 0,
        netProfit: 0,
        expenses: 0,
        final: 0
    });

    // --- Control States ---
    const [activeTab, setActiveTab] = useState('dashboard');
    const [renewalTarget, setRenewalTarget] = useState(null);

    // --- Realtime refs ---
    const realtimeTimerRef = useRef(null);
    const syncChannelRef = useRef(null);

    // إعادة ترتيب المنتجات عند تغيير الترتيب أو البيانات
    useEffect(() => {
        setProducts(sortProducts(rawProducts, productSortOrder));
    }, [rawProducts, productSortOrder]);

    // تحريك منتج — متاحة لكل الكومبوننتس
    const reorderProducts = (productId, direction) => {
        const sorted = sortProducts(rawProducts, productSortOrder);
        const product = sorted.find(p => p.id === productId);
        if (!product) return;

        const cat = product.category || 'بدون تصنيف';
        const catProducts = sorted.filter(p => (p.category || 'بدون تصنيف') === cat);
        const idx = catProducts.findIndex(p => p.id === productId);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= catProducts.length) return;

        const newOrder = { ...productSortOrder };
        catProducts.forEach((p, i) => { newOrder[p.id] = i; });
        newOrder[catProducts[idx].id] = swapIdx;
        newOrder[catProducts[swapIdx].id] = idx;

        localStorage.setItem(SORT_KEY, JSON.stringify(newOrder));
        setProductSortOrder(newOrder);

        // محاولة حفظ في الداتابيز (اختياري)
        productsAPI.updateSortOrder([
            { id: catProducts[idx].id, sort_order: swapIdx },
            { id: catProducts[swapIdx].id, sort_order: idx },
        ]).catch(() => {});
    };

    // ============ DATA FETCHING ============

    // جلب البيانات من الداتابيز (داخلي — بدون بث)
    const _fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            const [
                salesData,
                accountsData,
                expensesData,
                productsData,
                customersData,
                walletsData,
                txnData,
                sectionsData,
                problemsData,
                logsData
            ] = await Promise.all([
                salesAPI.getAll(),
                accountsAPI.getAll(),
                expensesAPI.getAll(),
                productsAPI.getAll(),
                customersAPI.getAll(),
                walletsAPI.getAll(),
                walletsAPI.getTransactions(),
                sectionsAPI.getAll(),
                problemsAPI.getAll(),
                inventoryLogsAPI.getAll().catch(() => [])
            ]);

            setSales(salesData);
            setAccounts(accountsData);
            setExpenses(expensesData);
            setRawProducts(productsData.map(p => ({
                ...p,
                inventoryProduct: p.inventory_product,
                fulfillmentType: p.fulfillment_type,
            })));
            setCustomers(customersData);
            setWallets(walletsData);
            setTransactions(txnData);
            setSections(sectionsData);
            setProblems(problemsData);
            setInventoryLogs(logsData);

            // Calculate stats — only count 'paid' expenses in profit
            const totalRevenue = salesData.reduce((a, b) => a + (Number(b.finalPrice || b.final_price) || 0), 0);
            const paidExpenses = expensesData.filter(e => (e.approvalStatus || e.approval_status) === 'paid');
            const totalExpenses = paidExpenses.reduce((a, b) => a + (Number(b.amount) || 0), 0);
            const allExpenses = expensesData.reduce((a, b) => a + (Number(b.amount) || 0), 0);
            const netProfit = totalRevenue - totalExpenses;

            setStats({
                revenue: totalRevenue,
                netProfit: totalRevenue,
                expenses: totalExpenses,
                allExpenses: allExpenses,
                final: netProfit
            });

        } catch (error) {
            console.error("Data fetch error", error);
        }
        setLoading(false);
    }, [user]);

    // تحديث البيانات + بث إشارة لباقي الأجهزة المتصلة
    const refreshData = useCallback(async () => {
        await _fetchData();
        // بث إشارة تحديث لكل الأجهزة الثانية
        try {
            if (syncChannelRef.current) {
                syncChannelRef.current.send({
                    type: 'broadcast',
                    event: 'data_changed',
                    payload: { ts: Date.now() }
                });
            }
        } catch (e) {
            // تجاهل أخطاء البث
        }
    }, [_fetchData]);

    // تحميل البيانات أول مرة لما المستخدم يسجل دخول
    useEffect(() => {
        _fetchData();
    }, [user, _fetchData]);

    // ============ AUTO-SALARY: إضافة مرتبات الموظفين تلقائياً ============
    useEffect(() => {
        if (!user || user.role !== 'admin') return;

        const DAY_EN = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        const today = new Date();
        const todayDay = DAY_EN[today.getDay()];
        const todayStr = today.toISOString().split('T')[0];
        const autoKey = `diaa-store_auto_salary_${todayStr}`;

        // Check if already processed today
        if (localStorage.getItem(autoKey)) return;

        const checkAndAddSalaries = async () => {
            try {
                const emps = await employeesAPI.getAll();
                const payDayEmps = emps.filter(e => e.isActive && e.payDay === todayDay);
                if (payDayEmps.length === 0) {
                    localStorage.setItem(autoKey, 'no_employees');
                    return;
                }

                // Check which employees already have salary expenses for today
                const { data: todayExpenses } = await supabase
                    .from('expenses')
                    .select('*')
                    .eq('expense_category', 'salary')
                    .gte('date', todayStr)
                    .lte('date', todayStr + 'T23:59:59');

                const existingEmpIds = (todayExpenses || []).map(e => e.employee_id).filter(Boolean);
                const calcNet = (emp) => {
                    const absenceTotal = (emp.absenceDays || 0) * (emp.absenceDeductionPerDay || 0);
                    return (emp.baseSalary || 0) + (emp.bonus || 0) - (emp.deductions || 0) - absenceTotal;
                };

                const toAdd = payDayEmps.filter(e => !existingEmpIds.includes(e.id));
                if (toAdd.length === 0) {
                    localStorage.setItem(autoKey, 'already_added');
                    return;
                }

                // Add salary expenses for each employee
                const addedList = [];
                for (const emp of toAdd) {
                    const net = calcNet(emp);
                    if (net <= 0) continue;
                    await supabase.from('expenses').insert({
                        type: 'مرتب موظف',
                        amount: net,
                        description: `مرتب ${emp.name} — يوم القبض`,
                        date: todayStr,
                        expense_category: 'salary',
                        approval_status: 'pending',
                        employee_id: emp.id,
                    });
                    addedList.push({ name: emp.name, amount: net });
                }

                if (addedList.length > 0) {
                    telegram.autoSalaryAdded(addedList);
                    await _fetchData(); // Refresh to show new expenses
                }
                localStorage.setItem(autoKey, 'done');
            } catch (err) {
                console.error('Auto-salary error:', err);
            }
        };

        // Run after a short delay to not block initial load
        const timer = setTimeout(checkAndAddSalaries, 3000);
        return () => clearTimeout(timer);
    }, [user, _fetchData]);

    // ============ SUPABASE REALTIME (DUAL APPROACH) ============
    // 1) postgres_changes — يراقب تغييرات الداتابيز مباشرة (محتاج تفعيل Replication)
    // 2) broadcast — بث من جهاز لجهاز (يشتغل دايماً بدون إعدادات إضافية)
    useEffect(() => {
        if (!user) return;

        // Debounced fetch — عشان لو في تغييرات كتير في نفس الوقت ميعملش fetch كل مرة
        const debouncedFetch = () => {
            if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
            realtimeTimerRef.current = setTimeout(() => {
                _fetchData();
            }, 500);
        };

        // ========= Channel 1: postgres_changes =========
        const pgChannel = supabase.channel('realtime-pg-changes');
        REALTIME_TABLES.forEach(table => {
            pgChannel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table },
                (payload) => {
                    console.log(`🔄 DB change [${table}]:`, payload.eventType);
                    debouncedFetch();
                }
            );
        });
        pgChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Postgres changes: subscribed');
            }
        });

        // ========= Channel 2: Broadcast (client-to-client sync) =========
        // self: false — عشان اللي بيبث ميستقبلش رسالته التانية ومتعملش loop
        const syncChannel = supabase.channel('diaa-store-sync', {
            config: { broadcast: { self: false } }
        });
        syncChannel.on('broadcast', { event: 'data_changed' }, () => {
            console.log('📡 Broadcast received: data changed by another client');
            debouncedFetch();
        });
        syncChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Broadcast sync: subscribed');
                syncChannelRef.current = syncChannel;
            }
        });

        // تنظيف عند الخروج
        return () => {
            if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
            syncChannelRef.current = null;
            supabase.removeChannel(pgChannel);
            supabase.removeChannel(syncChannel);
            console.log('🔌 Realtime: unsubscribed from all channels');
        };
    }, [user, _fetchData]);

    return (
        <DataContext.Provider value={{
            sales, accounts, expenses, products, customers, wallets, transactions, sections, problems, inventoryLogs, stats,
            activeTab, setActiveTab,
            renewalTarget, setRenewalTarget,
            refreshData, reorderProducts,
            loading
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => useContext(DataContext);