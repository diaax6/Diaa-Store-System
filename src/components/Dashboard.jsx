import { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n/index';

export default function Dashboard() {
    useEffect(() => { window.scrollTo(0, 0); }, []);

    const { sales, products, expenses } = useData();
    const { hasPermission, user } = useAuth();
    const { t } = useLang();
    const canViewDailyProfit = user?.role === 'admin' || hasPermission('view_daily_profit');

    const stats = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const totalRevenue  = sales.reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0);
        const totalCollected = sales.filter(s => s.isPaid).reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0);
        const totalRemaining = sales.filter(s => !s.isPaid).reduce((sum, s) => sum + (Number(s.remainingAmount) || Number(s.finalPrice) || 0), 0);
        const totalDiscount  = sales.reduce((sum, s) => sum + (Number(s.discount) || 0), 0);

        const dailySales   = sales.filter(s => new Date(s.date) >= startOfToday);
        const weeklySales  = sales.filter(s => new Date(s.date) >= startOfWeek);
        const monthlySales = sales.filter(s => new Date(s.date) >= startOfMonth);

        const productCounts = {};
        sales.forEach(s => { productCounts[s.productName] = (productCounts[s.productName] || 0) + 1; });
        const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];

        const channelCounts = {};
        sales.forEach(s => { if (s.contactChannel) channelCounts[s.contactChannel] = (channelCounts[s.contactChannel] || 0) + 1; });
        const topChannel = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0];

        const paidExpenses = expenses.filter(e => (e.approvalStatus || e.approval_status || 'pending') === 'paid');
        const dailyExpensesList  = paidExpenses.filter(e => (e.expenseCategory || 'daily') === 'daily');
        const stockExpensesList  = paidExpenses.filter(e => e.expenseCategory === 'stock');
        const salaryExpensesList = paidExpenses.filter(e => e.expenseCategory === 'salary');
        const totalDailyExpenses  = dailyExpensesList.reduce((sum, e)  => sum + (Number(e.amount) || 0), 0);
        const totalStockExpenses  = stockExpensesList.reduce((sum, e)  => sum + (Number(e.amount) || 0), 0);
        const totalSalaryExpenses = salaryExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const totalExpenses = totalDailyExpenses + totalStockExpenses + totalSalaryExpenses;

        const grossProfit = totalRevenue  - totalExpenses;
        const netProfit   = totalCollected - totalExpenses;

        const dailyRevenue = dailySales.reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0);
        const todayPaidExpenses = paidExpenses.filter(e => new Date(e.date) >= startOfToday);
        const todayDailyExpenses = todayPaidExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const dailyProfit = dailyRevenue - todayDailyExpenses;

        return {
            totalSales: sales.length, totalRevenue, totalCollected, totalRemaining, totalDiscount,
            totalExpenses, totalDailyExpenses, totalStockExpenses, totalSalaryExpenses, grossProfit, netProfit,
            dailyCount: dailySales.length, dailyRevenue, dailyProfit, todayDailyExpenses,
            weeklyCount: weeklySales.length, weeklyRevenue: weeklySales.reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0),
            monthlyCount: monthlySales.length, monthlyRevenue: monthlySales.reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0),
            totalProducts: products.length,
            topProduct: topProduct ? topProduct[0] : '-', topProductCount: topProduct ? topProduct[1] : 0,
            topChannel: topChannel ? topChannel[0] : '-', topChannelCount: topChannel ? topChannel[1] : 0,
            paidCount: sales.filter(s => s.isPaid).length, unpaidCount: sales.filter(s => !s.isPaid).length,
        };
    }, [sales, products, expenses]);

    const recentSales  = useMemo(() => [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5), [sales]);
    const productStats = useMemo(() => {
        const map = {};
        sales.forEach(s => {
            if (!map[s.productName]) map[s.productName] = { count: 0, revenue: 0 };
            map[s.productName].count++;
            map[s.productName].revenue += Number(s.finalPrice) || 0;
        });
        return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
    }, [sales]);

    return (
        <div className="space-y-5 animate-fade-in pb-20">

            {/* Salawat Banner — always Arabic */}
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border border-emerald-200/40 text-emerald-600 select-none"
                    style={{ background: 'rgba(16,185,129,0.07)' }}>
                    <i className="fa-solid fa-kaaba text-xs opacity-70"></i>
                    <p className="text-xs font-semibold tracking-wide" dir="rtl">{'اللهم صلِ وسلم على نبينا محمد ﷺ'}</p>
                    <i className="fa-solid fa-mosque text-xs opacity-70"></i>
                </div>
            </div>

            {/* Page Header */}
            <div className="ph-bar">
                <div className="flex items-center gap-3">
                    <div className="ph-icon"><i className="fa-solid fa-chart-pie text-sm"></i></div>
                    <div>
                        <h1 className="ph-title">{t('dash_title')}</h1>
                        <p className="ph-sub">{t('dash_subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                    <span className="font-medium">{stats.totalSales} {t('dash_orders')}</span>
                </div>
            </div>

            {/* KPI Grid — Financial (admin only) */}
            {canViewDailyProfit && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="stat-card stat-indigo">
                        <span className="stat-card-lbl">{t('dash_total_revenue')}</span>
                        <span className="stat-card-val dir-ltr">{stats.totalRevenue.toLocaleString('en-US')}</span>
                        <span className="stat-card-sub">{t('dash_total_revenue_sub')}</span>
                    </div>
                    <div className="stat-card stat-blue">
                        <span className="stat-card-lbl">{t('dash_collected')}</span>
                        <span className="stat-card-val dir-ltr">{stats.totalCollected.toLocaleString('en-US')}</span>
                        <span className="stat-card-sub">{t('dash_collected_sub')}</span>
                    </div>
                    <div className={`stat-card ${stats.grossProfit >= 0 ? 'stat-emerald' : 'stat-red'}`}>
                        <span className="stat-card-lbl">{t('dash_gross_profit')}</span>
                        <span className={`stat-card-val dir-ltr ${stats.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{stats.grossProfit.toLocaleString('en-US')}</span>
                        <span className="stat-card-sub">{t('dash_gross_profit_sub')}</span>
                    </div>
                    <div className={`stat-card ${stats.netProfit >= 0 ? 'stat-emerald' : 'stat-red'}`}>
                        <span className="stat-card-lbl">{t('dash_net_profit')}</span>
                        <span className={`stat-card-val dir-ltr ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{stats.netProfit.toLocaleString('en-US')}</span>
                        <span className="stat-card-sub">{t('dash_net_profit_sub')}</span>
                    </div>
                </div>
            )}

            {/* KPI Grid — Expenses */}
            {canViewDailyProfit && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="stat-card stat-amber">
                        <span className="stat-card-lbl">{t('dash_daily_exp')}</span>
                        <span className="stat-card-val dir-ltr">{stats.totalDailyExpenses.toLocaleString('en-US')}</span>
                        <span className="stat-card-sub">{t('lbl_egp')}</span>
                    </div>
                    <div className="stat-card stat-violet">
                        <span className="stat-card-lbl">{t('dash_stock_exp')}</span>
                        <span className="stat-card-val dir-ltr">{stats.totalStockExpenses.toLocaleString('en-US')}</span>
                        <span className="stat-card-sub">{t('lbl_egp')}</span>
                    </div>
                    <div className="stat-card stat-red">
                        <span className="stat-card-lbl">{t('dash_debts')}</span>
                        <span className="stat-card-val dir-ltr">{stats.totalRemaining.toLocaleString('en-US')}</span>
                        <span className="stat-card-sub">{t('dash_debts_sub')}</span>
                    </div>
                    <div className={`stat-card ${stats.dailyProfit >= 0 ? 'stat-emerald' : 'stat-red'}`}>
                        <span className="stat-card-lbl">{t('dash_today_profit')}</span>
                        <span className={`stat-card-val dir-ltr ${stats.dailyProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{stats.dailyProfit.toLocaleString('en-US')}</span>
                        <span className="stat-card-sub dir-ltr">{stats.dailyRevenue.toLocaleString('en-US')} - {stats.todayDailyExpenses.toLocaleString('en-US')}</span>
                    </div>
                </div>
            )}

            {/* KPI Grid — Volume */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="stat-card stat-indigo">
                    <span className="stat-card-lbl">{t('dash_total_orders')}</span>
                    <span className="stat-card-val">{stats.totalSales}</span>
                    <span className="stat-card-sub">{stats.paidCount} {t('dash_paid')} / {stats.unpaidCount} {t('dash_pending')}</span>
                </div>
                <div className="stat-card stat-blue">
                    <span className="stat-card-lbl">{t('dash_today_revenue')}</span>
                    <span className="stat-card-val dir-ltr">{canViewDailyProfit ? stats.dailyRevenue.toLocaleString('en-US') : stats.dailyCount}</span>
                    <span className="stat-card-sub">{stats.dailyCount} {t('dash_orders')}</span>
                </div>
                <div className="stat-card stat-violet">
                    <span className="stat-card-lbl">{t('dash_weekly_sales')}</span>
                    <span className="stat-card-val dir-ltr">{canViewDailyProfit ? stats.weeklyRevenue.toLocaleString('en-US') : stats.weeklyCount}</span>
                    <span className="stat-card-sub">{stats.weeklyCount} {t('dash_orders')}</span>
                </div>
                <div className="stat-card stat-amber">
                    <span className="stat-card-lbl">{t('dash_monthly_sales')}</span>
                    <span className="stat-card-val dir-ltr">{canViewDailyProfit ? stats.monthlyRevenue.toLocaleString('en-US') : stats.monthlyCount}</span>
                    <span className="stat-card-sub">{stats.monthlyCount} {t('dash_orders')}</span>
                </div>
                <div className="stat-card stat-neutral">
                    <span className="stat-card-lbl">{t('dash_products')}</span>
                    <span className="stat-card-val">{stats.totalProducts}</span>
                    <span className="stat-card-sub">{t('dash_product_available')}</span>
                </div>
                <div className="stat-card stat-emerald">
                    <span className="stat-card-lbl">{t('dash_collection_rate')}</span>
                    <span className="stat-card-val">{stats.totalSales > 0 ? ((stats.paidCount / stats.totalSales) * 100).toFixed(0) : 0}%</span>
                    <span className="stat-card-sub">{stats.topProduct}</span>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Product breakdown */}
                <div className="sect-card">
                    <div className="sect-card-header">
                        <span className="sect-card-title flex items-center gap-2">
                            <i className="fa-solid fa-chart-bar text-indigo-500 text-sm"></i>
                            {t('dash_by_product')}
                        </span>
                        <span className="text-xs text-slate-400">{productStats.length} {t('dash_products')}</span>
                    </div>
                    <div className="p-4">
                        {productStats.length === 0 ? (
                            <div className="empty-state py-10">
                                <div className="empty-icon"><i className="fa-solid fa-chart-bar"></i></div>
                                <p className="empty-title">{t('dash_no_data')}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {productStats.map(([name, data], idx) => {
                                    const maxRevenue = productStats[0]?.[1]?.revenue || 1;
                                    const pct = (data.revenue / maxRevenue) * 100;
                                    const colors = ['bg-indigo-500','bg-emerald-500','bg-rose-500','bg-amber-500','bg-cyan-500'];
                                    const c = colors[idx % colors.length];
                                    return (
                                        <div key={name}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm font-semibold truncate max-w-[140px]">{name}</span>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-slate-400">{data.count} {t('dash_sale_count')}</span>
                                                    <span className="font-bold dir-ltr">{data.revenue.toLocaleString('en-US')} <span className="text-slate-400 font-normal">{t('dash_currency')}</span></span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div className={`${c} h-full rounded-full transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Sales */}
                <div className="sect-card overflow-hidden">
                    <div className="sect-card-header">
                        <span className="sect-card-title flex items-center gap-2">
                            <i className="fa-solid fa-clock-rotate-left text-blue-500 text-sm"></i>
                            {t('dash_recent_sales')}
                        </span>
                        <span className="text-xs text-slate-400">{t('dash_latest_5')}</span>
                    </div>
                    {recentSales.length === 0 ? (
                        <div className="empty-state py-10">
                            <div className="empty-icon"><i className="fa-solid fa-receipt"></i></div>
                            <p className="empty-title">{t('dash_no_sales')}</p>
                        </div>
                    ) : (
                        <table className="ds-table">
                            <thead className="ds-thead">
                                <tr>
                                    <th className="ds-th">{t('dash_col_client')}</th>
                                    <th className="ds-th">{t('dash_col_product')}</th>
                                    <th className="ds-th tc">{t('dash_col_price')}</th>
                                    <th className="ds-th tc">{t('dash_col_status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentSales.map(sale => (
                                    <tr key={sale.id} className="ds-tr">
                                        <td className="ds-td">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${sale.isPaid ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                                                    {(sale.customerName || 'C').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-sm truncate max-w-[90px]">{sale.customerName || t('dash_col_client')}</span>
                                            </div>
                                        </td>
                                        <td className="ds-td text-slate-500 text-xs">{sale.productName}</td>
                                        <td className="ds-td tc font-semibold dir-ltr text-sm">{Number(sale.finalPrice).toLocaleString('en-US')}</td>
                                        <td className="ds-td tc">
                                            <span className={`ds-badge ${sale.isActivated ? 'ds-purple' : sale.isPaid ? 'ds-ok' : 'ds-err'}`}>
                                                {sale.isActivated ? t('status_activated') : sale.isPaid ? t('status_paid') : t('status_unpaid')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
