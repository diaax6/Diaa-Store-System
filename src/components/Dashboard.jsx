import { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
    useEffect(() => { window.scrollTo(0, 0); }, []);

    const { sales, products, expenses } = useData();
    const { hasPermission, user } = useAuth();
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

        // grossProfit = totalRevenue  - all paid expenses
        // netProfit   = totalCollected - all paid expenses
        const grossProfit = totalRevenue  - totalExpenses;
        const netProfit   = totalCollected - totalExpenses;

        const dailyRevenue = dailySales.reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0);
        // Today profit: revenue from today minus ALL today paid expenses
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

            {/* Salawat Banner */}
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border border-emerald-200/40 text-emerald-600 select-none"
                    style={{ background: 'rgba(16,185,129,0.07)' }}>
                    <i className="fa-solid fa-kaaba text-xs opacity-70"></i>
                    <p className="text-xs font-semibold tracking-wide">{'\u0627\u0644\u0644\u0647\u0645 \u0635\u0644\u0650 \u0648\u0633\u0644\u0645 \u0639\u0644\u0649 \u0646\u0628\u064a\u0646\u0627 \u0645\u062d\u0645\u062f \uFD3E'}</p>
                    <i className="fa-solid fa-mosque text-xs opacity-70"></i>
                </div>
            </div>

            {/* Page Header */}
            <div className="ph-bar">
                <div className="flex items-center gap-3">
                    <div className="ph-icon"><i className="fa-solid fa-chart-pie text-sm"></i></div>
                    <div>
                        <h1 className="ph-title">{'\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645'}</h1>
                        <p className="ph-sub">{'\u0646\u0638\u0631\u0629 \u0634\u0627\u0645\u0644\u0629 \u0639\u0644\u0649 \u0623\u062f\u0627\u0621 Diaa Store'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                    <span className="font-medium">{stats.totalSales} {'\u0623\u0648\u0631\u062f\u0631'}</span>
                </div>
            </div>

            {/* KPI Grid — Financial (admin only) */}
            {canViewDailyProfit && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="stat-card stat-indigo">
                        <span className="stat-card-lbl">{'\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a'}</span>
                        <span className="stat-card-val dir-ltr">{stats.totalRevenue.toLocaleString()}</span>
                        <span className="stat-card-sub">{'\u062c.\u0645 \u2014 \u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a'}</span>
                    </div>
                    <div className="stat-card stat-blue">
                        <span className="stat-card-lbl">{'\u0627\u0644\u0645\u062d\u0635\u0651\u0644'}</span>
                        <span className="stat-card-val dir-ltr">{stats.totalCollected.toLocaleString()}</span>
                        <span className="stat-card-sub">{'\u062c.\u0645 \u2014 \u0645\u062f\u0641\u0648\u0639 \u0641\u0639\u0644\u0627\u064b'}</span>
                    </div>
                    <div className={`stat-card ${stats.grossProfit >= 0 ? 'stat-emerald' : 'stat-red'}`}>
                        <span className="stat-card-lbl">{'\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0631\u0628\u062d'}</span>
                        <span className={`stat-card-val dir-ltr ${stats.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{stats.grossProfit.toLocaleString()}</span>
                        <span className="stat-card-sub">{'\u062c.\u0645 \u2014 \u0625\u064a\u0631\u0627\u062f\u0627\u062a \u2212 \u0645\u0635\u0631\u0648\u0641\u0627\u062a'}</span>
                    </div>
                    <div className={`stat-card ${stats.netProfit >= 0 ? 'stat-emerald' : 'stat-red'}`}>
                        <span className="stat-card-lbl">{'\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d'}</span>
                        <span className={`stat-card-val dir-ltr ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{stats.netProfit.toLocaleString()}</span>
                        <span className="stat-card-sub">{'\u062c.\u0645 \u2014 \u0645\u062d\u0635\u0651\u0644 \u2212 \u0645\u0635\u0631\u0648\u0641\u0627\u062a'}</span>
                    </div>
                </div>
            )}

            {/* KPI Grid — Expenses */}
            {canViewDailyProfit && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="stat-card stat-amber">
                        <span className="stat-card-lbl">{'\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u064a\u0648\u0645\u064a\u0629'}</span>
                        <span className="stat-card-val dir-ltr">{stats.totalDailyExpenses.toLocaleString()}</span>
                        <span className="stat-card-sub">{'\u062c.\u0645'}</span>
                    </div>
                    <div className="stat-card stat-violet">
                        <span className="stat-card-lbl">{'\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0645\u062e\u0632\u0648\u0646'}</span>
                        <span className="stat-card-val dir-ltr">{stats.totalStockExpenses.toLocaleString()}</span>
                        <span className="stat-card-sub">{'\u062c.\u0645'}</span>
                    </div>
                    <div className="stat-card stat-red">
                        <span className="stat-card-lbl">{'\u0645\u062f\u064a\u0648\u0646\u064a\u0627\u062a'}</span>
                        <span className="stat-card-val dir-ltr">{stats.totalRemaining.toLocaleString()}</span>
                        <span className="stat-card-sub">{'\u062c.\u0645 \u2014 \u063a\u064a\u0631 \u0645\u062d\u0635\u0651\u0644'}</span>
                    </div>
                    <div className={`stat-card ${stats.dailyProfit >= 0 ? 'stat-emerald' : 'stat-red'}`}>
                        <span className="stat-card-lbl">{'\u0631\u0628\u062d \u0627\u0644\u064a\u0648\u0645'}</span>
                        <span className={`stat-card-val dir-ltr ${stats.dailyProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{stats.dailyProfit.toLocaleString()}</span>
                        <span className="stat-card-sub dir-ltr">{stats.dailyRevenue.toLocaleString()} - {stats.todayDailyExpenses.toLocaleString()}</span>
                    </div>
                </div>
            )}

            {/* KPI Grid — Volume */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="stat-card stat-indigo">
                    <span className="stat-card-lbl">{'\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0623\u0648\u0631\u062f\u0631\u0627\u062a'}</span>
                    <span className="stat-card-val">{stats.totalSales}</span>
                    <span className="stat-card-sub">{stats.paidCount} {'\u0645\u062f\u0641\u0648\u0639'} / {stats.unpaidCount} {'\u0645\u0639\u0644\u0642'}</span>
                </div>
                <div className="stat-card stat-blue">
                    <span className="stat-card-lbl">{'\u0625\u064a\u0631\u0627\u062f \u0627\u0644\u064a\u0648\u0645'}</span>
                    <span className="stat-card-val dir-ltr">{canViewDailyProfit ? stats.dailyRevenue.toLocaleString() : stats.dailyCount}</span>
                    <span className="stat-card-sub">{stats.dailyCount} {'\u0623\u0648\u0631\u062f\u0631'}</span>
                </div>
                <div className="stat-card stat-violet">
                    <span className="stat-card-lbl">{'\u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0623\u0633\u0628\u0648\u0639'}</span>
                    <span className="stat-card-val dir-ltr">{canViewDailyProfit ? stats.weeklyRevenue.toLocaleString() : stats.weeklyCount}</span>
                    <span className="stat-card-sub">{stats.weeklyCount} {'\u0623\u0648\u0631\u062f\u0631'}</span>
                </div>
                <div className="stat-card stat-amber">
                    <span className="stat-card-lbl">{'\u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0634\u0647\u0631'}</span>
                    <span className="stat-card-val dir-ltr">{canViewDailyProfit ? stats.monthlyRevenue.toLocaleString() : stats.monthlyCount}</span>
                    <span className="stat-card-sub">{stats.monthlyCount} {'\u0623\u0648\u0631\u062f\u0631'}</span>
                </div>
                <div className="stat-card stat-neutral">
                    <span className="stat-card-lbl">{'\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a'}</span>
                    <span className="stat-card-val">{stats.totalProducts}</span>
                    <span className="stat-card-sub">{'\u0645\u0646\u062a\u062c \u0645\u062a\u0627\u062d'}</span>
                </div>
                <div className="stat-card stat-emerald">
                    <span className="stat-card-lbl">{'\u0646\u0633\u0628\u0629 \u0627\u0644\u062a\u062d\u0635\u064a\u0644'}</span>
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
                            {'\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a \u062d\u0633\u0628 \u0627\u0644\u0645\u0646\u062a\u062c'}
                        </span>
                        <span className="text-xs text-slate-400">{productStats.length} {'\u0645\u0646\u062a\u062c'}</span>
                    </div>
                    <div className="p-4">
                        {productStats.length === 0 ? (
                            <div className="empty-state py-10">
                                <div className="empty-icon"><i className="fa-solid fa-chart-bar"></i></div>
                                <p className="empty-title">{'\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0628\u0639\u062f'}</p>
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
                                                    <span className="text-slate-400">{data.count} {'\u0645\u0628\u064a\u0639\u0629'}</span>
                                                    <span className="font-bold dir-ltr">{data.revenue.toLocaleString()} <span className="text-slate-400 font-normal">{'\u062c.\u0645'}</span></span>
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
                            {'\u0622\u062e\u0631 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a'}
                        </span>
                        <span className="text-xs text-slate-400">{'\u0623\u062d\u062f\u062b 5'}</span>
                    </div>
                    {recentSales.length === 0 ? (
                        <div className="empty-state py-10">
                            <div className="empty-icon"><i className="fa-solid fa-receipt"></i></div>
                            <p className="empty-title">{'\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0628\u064a\u0639\u0627\u062a \u0628\u0639\u062f'}</p>
                        </div>
                    ) : (
                        <table className="ds-table">
                            <thead className="ds-thead">
                                <tr>
                                    <th className="ds-th">{'\u0627\u0644\u0639\u0645\u064a\u0644'}</th>
                                    <th className="ds-th">{'\u0627\u0644\u0645\u0646\u062a\u062c'}</th>
                                    <th className="ds-th tc">{'\u0627\u0644\u0633\u0639\u0631'}</th>
                                    <th className="ds-th tc">{'\u0627\u0644\u062d\u0627\u0644\u0629'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentSales.map(sale => (
                                    <tr key={sale.id} className="ds-tr">
                                        <td className="ds-td">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${sale.isPaid ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                                                    {(sale.customerName || '\u0639').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-sm truncate max-w-[90px]">{sale.customerName || '\u0639\u0645\u064a\u0644'}</span>
                                            </div>
                                        </td>
                                        <td className="ds-td text-slate-500 text-xs">{sale.productName}</td>
                                        <td className="ds-td tc font-semibold dir-ltr text-sm">{Number(sale.finalPrice).toLocaleString()}</td>
                                        <td className="ds-td tc">
                                            <span className={`ds-badge ${sale.isActivated ? 'ds-purple' : sale.isPaid ? 'ds-ok' : 'ds-err'}`}>
                                                {sale.isActivated ? '\u0645\u0641\u0639\u0651\u0644' : sale.isPaid ? '\u0645\u062f\u0641\u0648\u0639' : '\u0645\u0639\u0644\u0642'}
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
