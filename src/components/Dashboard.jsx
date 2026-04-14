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
        const dailyExpensesList = paidExpenses.filter(e => (e.expenseCategory || 'daily') === 'daily');
        const stockExpensesList = paidExpenses.filter(e => e.expenseCategory === 'stock');
        const totalDailyExpenses = dailyExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const totalStockExpenses = stockExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const totalExpenses = totalDailyExpenses + totalStockExpenses;

        const grossProfit = totalRevenue - totalDailyExpenses;
        const netProfit   = totalCollected - totalDailyExpenses;

        const dailyRevenue = dailySales.reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0);
        const todayDailyExpensesList = dailyExpensesList.filter(e => new Date(e.date) >= startOfToday);
        const todayDailyExpenses = todayDailyExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const dailyProfit = dailyRevenue - todayDailyExpenses;

        return {
            totalSales: sales.length, totalRevenue, totalCollected, totalRemaining, totalDiscount,
            totalExpenses, totalDailyExpenses, totalStockExpenses, grossProfit, netProfit,
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
        <div className="space-y-6 animate-fade-in pb-10">

            {/* Salawat Banner */}
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-xl border border-emerald-200/60 text-emerald-700 group cursor-default select-none"
                    style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(20,184,166,0.08) 100%)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 group-hover:rotate-12 transition-transform duration-500"
                        style={{ background: 'rgba(16,185,129,0.12)' }}>
                        <i className="fa-solid fa-kaaba text-sm"></i>
                    </div>
                    <p className="font-bold text-sm tracking-wide animate-pulse">اللهم صلِّ وسلم على نبينا محمد ﷺ</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 group-hover:-rotate-12 transition-transform duration-500"
                        style={{ background: 'rgba(16,185,129,0.12)' }}>
                        <i className="fa-solid fa-mosque text-sm"></i>
                    </div>
                </div>
            </div>

            {/* Page Header */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white"
                style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)' }}>
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(139,92,246,0.6) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(99,102,241,0.5) 0%, transparent 40%)' }}></div>
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white, transparent)', transform: 'translate(30%, -50%)' }}></div>
                <div className="relative z-10 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                            <i className="fa-solid fa-chart-line text-white text-xl"></i>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">لوحة التحكم</h2>
                            <p className="text-indigo-200 text-xs font-semibold mt-0.5">نظرة شاملة على أداء Diaa Store</p>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-2 rounded-xl">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span className="text-white text-xs font-bold">{stats.totalSales} أوردر إجمالي</span>
                    </div>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <StatCard title="إجمالي الأوردرات" eng="TOTAL ORDERS"   value={stats.totalSales}  icon="fa-cart-shopping"       grad="from-indigo-600 via-indigo-500 to-blue-600" />

                {canViewDailyProfit && (<>
                    <StatCard title="إجمالي الإيرادات" eng="TOTAL REVENUE"  value={`${stats.totalRevenue.toLocaleString()} EGP`}  icon="fa-sack-dollar"         grad="from-emerald-600 via-emerald-500 to-teal-600" />
                    <StatCard title="المحصّل"          eng="COLLECTED"      value={`${stats.totalCollected.toLocaleString()} EGP`} icon="fa-hand-holding-dollar"  grad="from-cyan-600 via-cyan-500 to-blue-500" />
                    <StatCard title="المديونيات"       eng="OUTSTANDING"    value={`${stats.totalRemaining.toLocaleString()} EGP`} icon="fa-money-bill-transfer"  grad="from-rose-600 via-red-500 to-orange-500" />
                    <StatCard title="مصروفات يومية"   eng="DAILY EXPENSES" value={`${stats.totalDailyExpenses.toLocaleString()} EGP`} icon="fa-clock"            grad="from-amber-500 via-amber-400 to-orange-500" sub="إعلانات — اشتراكات — رواتب" />
                    <StatCard title="مصروفات مخزون"   eng="STOCK EXPENSES" value={`${stats.totalStockExpenses.toLocaleString()} EGP`} icon="fa-boxes-stacked"     grad="from-purple-600 via-violet-600 to-fuchsia-600" sub="شراء استوك وحسابات" />
                    <StatCard title="إجمالي الربح"    eng="GROSS PROFIT"   value={`${stats.grossProfit.toLocaleString()} EGP`} icon="fa-chart-line"              grad={stats.grossProfit >= 0 ? 'from-emerald-600 via-green-500 to-teal-500' : 'from-red-600 via-rose-500 to-red-700'} sub="الإيرادات — المصروفات اليومية" />
                    <StatCard title="صافي الربح"      eng="NET PROFIT"     value={`${stats.netProfit.toLocaleString()} EGP`}  icon="fa-coins"                    grad={stats.netProfit >= 0 ? 'from-green-600 via-emerald-500 to-teal-600' : 'from-red-700 via-rose-600 to-red-800'} sub="المحصّل — المصروفات اليومية" />
                    <StatCard title="ربح اليوم"       eng="TODAY PROFIT"   value={`${stats.dailyProfit.toLocaleString()} EGP`} icon="fa-sun"                     grad={stats.dailyProfit >= 0 ? 'from-teal-500 via-emerald-500 to-green-600' : 'from-red-600 via-rose-500 to-red-700'} sub={`${stats.dailyRevenue.toLocaleString()} - ${stats.todayDailyExpenses.toLocaleString()}`} />
                </>)}

                <StatCard title="إيراد اليوم"       eng="TODAY"        value={canViewDailyProfit ? `${stats.dailyRevenue.toLocaleString()} EGP` : stats.dailyCount}    icon="fa-calendar-day"   grad="from-violet-600 via-purple-500 to-fuchsia-600" sub={canViewDailyProfit ? `${stats.dailyCount} أوردر` : 'أوردر'} />
                <StatCard title="مبيعات الأسبوع"    eng="THIS WEEK"    value={canViewDailyProfit ? `${stats.weeklyRevenue.toLocaleString()} EGP` : stats.weeklyCount}   icon="fa-calendar-week"  grad="from-fuchsia-600 via-pink-500 to-rose-500"     sub={canViewDailyProfit ? `${stats.weeklyCount} أوردر` : 'أوردر'} />
                <StatCard title="مبيعات الشهر"      eng="THIS MONTH"   value={canViewDailyProfit ? `${stats.monthlyRevenue.toLocaleString()} EGP` : stats.monthlyCount} icon="fa-calendar-days"  grad="from-orange-500 via-amber-500 to-yellow-500"   sub={canViewDailyProfit ? `${stats.monthlyCount} أوردر` : 'أوردر'} />
                <StatCard title="المنتجات المتاحة"  eng="PRODUCTS"     value={stats.totalProducts}  icon="fa-boxes-stacked"  grad="from-slate-600 via-slate-500 to-slate-700" />
                <StatCard title="الأكثر مبيعاً"     eng="TOP PRODUCT"  value={stats.topProduct}     icon="fa-trophy"         grad="from-lime-500 via-green-500 to-emerald-500" sub={`${stats.topProductCount} مبيعة`} />
                <StatCard title="قناة التواصل الأولى" eng="TOP CHANNEL" value={stats.topChannel}    icon="fa-comments"       grad="from-blue-600 via-blue-500 to-indigo-500"  sub={`${stats.topChannelCount} عميل`} />
                <StatCard title="نسبة التحصيل"      eng="COLLECTION %"  value={`${stats.totalSales > 0 ? ((stats.paidCount / stats.totalSales) * 100).toFixed(0) : 0}%`} icon="fa-chart-pie" grad="from-teal-600 via-cyan-500 to-blue-500" sub={`${stats.paidCount} مدفوع / ${stats.unpaidCount} معلق`} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Product breakdown */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                            <i className="fa-solid fa-chart-bar text-white text-sm"></i>
                        </div>
                        <div>
                            <h3 className="font-extrabold text-slate-800 text-sm">المبيعات حسب المنتج</h3>
                            <p className="text-slate-400 text-[10px]">مقارنة الإيرادات لكل منتج</p>
                        </div>
                    </div>
                    <div className="p-5">
                        {productStats.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <i className="fa-regular fa-chart-bar text-4xl mb-3 opacity-30"></i>
                                <p className="font-bold text-sm">لا توجد بيانات بعد</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {productStats.map(([name, data], idx) => {
                                    const maxRevenue = productStats[0]?.[1]?.revenue || 1;
                                    const pct = (data.revenue / maxRevenue) * 100;
                                    const colors = ['from-indigo-500 to-violet-500','from-emerald-500 to-teal-500','from-rose-500 to-pink-500','from-amber-500 to-orange-500','from-cyan-500 to-blue-500'];
                                    const c = colors[idx % colors.length];
                                    return (
                                        <div key={name} className="group">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${c} flex-shrink-0`}></div>
                                                    <span className="font-bold text-sm text-slate-700 truncate max-w-[140px]">{name}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-full">{data.count} مبيعة</span>
                                                    <span className="text-sm font-black text-slate-800">{data.revenue.toLocaleString()} <span className="text-slate-400 font-bold text-[10px]">ج.م</span></span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div className={`bg-gradient-to-r ${c} h-full rounded-full transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Sales */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#06b6d4,#0ea5e9)' }}>
                            <i className="fa-solid fa-clock-rotate-left text-white text-sm"></i>
                        </div>
                        <div>
                            <h3 className="font-extrabold text-slate-800 text-sm">آخر المبيعات</h3>
                            <p className="text-slate-400 text-[10px]">أحدث 5 أوردرات مسجلة</p>
                        </div>
                    </div>
                    <div className="p-4">
                        {recentSales.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <i className="fa-regular fa-clock text-4xl mb-3 opacity-30"></i>
                                <p className="font-bold text-sm">لا توجد مبيعات بعد</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recentSales.map(sale => (
                                    <div key={sale.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group cursor-default">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0 ${sale.isActivated ? 'bg-gradient-to-br from-violet-500 to-purple-600' : sale.isPaid ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
                                                {(sale.customerName || sale.customerEmail || 'ع').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-slate-800 truncate max-w-[160px]">{sale.customerName || sale.customerEmail || 'عميل'}</div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] text-slate-400">{sale.productName}</span>
                                                    <span className="text-slate-300 text-[8px]">•</span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sale.isActivated ? 'bg-violet-100 text-violet-700' : sale.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                        {sale.isActivated ? '⚡ مفعّل' : sale.isPaid ? '✓ مدفوع' : '○ معلق'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-left flex-shrink-0">
                                            <div className="font-black text-sm text-slate-800 dir-ltr">{Number(sale.finalPrice).toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span></div>
                                            <div className="text-[10px] text-slate-400 text-left">{new Date(sale.date).toLocaleDateString('ar-EG')}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const StatCard = ({ title, eng, value, icon, grad, sub }) => (
    <div
        className={`relative rounded-2xl overflow-hidden text-white flex flex-col justify-between min-h-[130px] p-5 group cursor-default transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02]`}
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
        {/* Gradient overlay using tailwind */}
        <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-100`}></div>
        {/* Glow orb */}
        <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-20 group-hover:opacity-30 transition-opacity" style={{ background: 'radial-gradient(circle, white, transparent)' }}></div>
        <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white, transparent)', transform: 'translate(40%, -40%)' }}></div>

        <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-sans mb-0.5">{eng}</p>
                    <h3 className="text-sm font-extrabold leading-tight">{title}</h3>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/15 flex-shrink-0 group-hover:scale-110 transition-transform">
                    <i className={`fa-solid ${icon} text-sm`}></i>
                </div>
            </div>
            <p className="text-2xl font-black dir-ltr leading-none tracking-tight" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>{value}</p>
            {sub && <p className="text-[9px] mt-1.5 font-semibold opacity-75 bg-black/15 w-fit px-2.5 py-0.5 rounded-full">{sub}</p>}
        </div>
    </div>
);