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

export const DataProvider = ({ children }) => {
    const { user } = useAuth();

    // --- Data States ---
    const [sales, setSales] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [wallets, setWallets] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [sections, setSections] = useState([]);
    const [problems, setProblems] = useState([]);
    const [loading, setLoading] = useState(false);

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
            setProducts(productsData.map(p => ({
                ...p,
                inventoryProduct: p.inventory_product,
                fulfillmentType: p.fulfillment_type,
            })).sort((a, b) => {
                // ترتيب حسب التصنيف ثم الترتيب المحفوظ محلياً
                const catA = (a.category || 'بدون تصنيف').toLowerCase();
                const catB = (b.category || 'بدون تصنيف').toLowerCase();
                if (catA !== catB) return catA.localeCompare(catB);
                let orderMap = {};
                try { orderMap = JSON.parse(localStorage.getItem('service-hub_product_order') || '{}'); } catch {}
                return (orderMap[a.id] ?? 999) - (orderMap[b.id] ?? 999);
            }));
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
            refreshData,
            loading
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => useContext(DataContext);