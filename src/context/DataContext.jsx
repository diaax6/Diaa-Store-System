import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
    productsAPI,
    salesAPI,
    accountsAPI,
    expensesAPI,
    walletsAPI,
    customersAPI,
    sectionsAPI,
    problemsAPI
} from '../services/api';

const DataContext = createContext();
const SORT_KEY = 'service-hub_product_order';

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

    // --- Refresh All Data ---
    const refreshData = useCallback(async () => {
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
                problemsData
            ] = await Promise.all([
                salesAPI.getAll(),
                accountsAPI.getAll(),
                expensesAPI.getAll(),
                productsAPI.getAll(),
                customersAPI.getAll(),
                walletsAPI.getAll(),
                walletsAPI.getTransactions(),
                sectionsAPI.getAll(),
                problemsAPI.getAll()
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

            // Calculate stats
            const totalRevenue = salesData.reduce((a, b) => a + (Number(b.finalPrice || b.final_price) || 0), 0);
            const totalExpenses = expensesData.reduce((a, b) => a + (Number(b.amount) || 0), 0);
            const netProfit = totalRevenue - totalExpenses;

            setStats({
                revenue: totalRevenue,
                netProfit: totalRevenue,
                expenses: totalExpenses,
                final: netProfit
            });

        } catch (error) {
            console.error("Data fetch error", error);
        }
        setLoading(false);
    }, [user]);

    // Load data when user logs in
    useEffect(() => {
        refreshData();
    }, [user, refreshData]);

    return (
        <DataContext.Provider value={{
            sales, accounts, expenses, products, customers, wallets, transactions, sections, problems, stats,
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