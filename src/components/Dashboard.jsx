import { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const { sales, products, expenses } = useData();
    const { hasPermission, user } = useAuth();

    // Check if user can view daily profit
    const canViewDailyProfit = user?.role === 'admin' || hasPermission('view_daily_profit');

    // --- الإحصائيات ---
    const stats = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0);
        const totalCollected = sales.filter(s => s.isPaid).reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0);
        const totalRemaining = sales.filter(s => !s.isPaid).reduce((sum, s) => sum + (Number(s.remainingAmount) || Number(s.finalPrice) || 0), 0);
        const totalDiscount = sales.reduce((sum, s) => sum + (Number(s.discount) || 0), 0);

        const dailySales = sales.filter(s => new Date(s.date) >= startOfToday);
        const weeklySales = sales.filter(s => new Date(s.date) >= startOfWeek);
        const monthlySales = sales.filter(s => new Date(s.date) >= startOfMonth);

        // أكثر منتج مبيعاً
        const productCounts = {};
        sales.forEach(s => {
            productCounts[s.productName] = (productCounts[s.productName] || 0) + 1;
        });
        const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];

        // أكثر قناة تواصل
        const channelCounts = {};
        sales.forEach(s => {
            if (s.contactChannel) channelCounts[s.contactChannel] = (channelCounts[s.contactChannel] || 0) + 1;
        });
        const topChannel = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0];

        // المصروفات حسب التصنيف
        const dailyExpensesList = expenses.filter(e => (e.expenseCategory || 'daily') === 'daily');
        const stockExpensesList = expenses.filter(e => e.expenseCategory === 'stock');
        const totalDailyExpenses = dailyExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const totalStockExpenses = stockExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const totalExpenses = totalDailyExpenses + totalStockExpenses;
        
        // إجمالي الربح = الإيرادات - المصروفات اليومية فقط
        const grossProfit = totalRevenue - totalDailyExpenses;
        // صافي الربح = المحصّل فعلياً - المصروفات اليومية
        const netProfit = totalCollected - totalDailyExpenses;
        
        // حسابات اليوم
        const dailyRevenue = dailySales.reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0);
        const todayDailyExpensesList = dailyExpensesList.filter(e => new Date(e.date) >= startOfToday);
        const todayDailyExpenses = todayDailyExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const dailyProfit = dailyRevenue - todayDailyExpenses;

        return {
            totalSales: sales.length,
            totalRevenue,
            totalCollected,
            totalRemaining,
            totalDiscount,
            totalExpenses,
            totalDailyExpenses,
            totalStockExpenses,
            grossProfit,
            netProfit,
            dailyCount: dailySales.length,
            dailyRevenue,
            dailyProfit,
            todayDailyExpenses,
            weeklyCount: weeklySales.length,
            weeklyRevenue: weeklySales.reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0),
            monthlyCount: monthlySales.length,
            monthlyRevenue: monthlySales.reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0),
            totalProducts: products.length,
            topProduct: topProduct ? topProduct[0] : '-',
            topProductCount: topProduct ? topProduct[1] : 0,
            topChannel: topChannel ? topChannel[0] : '-',
            topChannelCount: topChannel ? topChannel[1] : 0,
            paidCount: sales.filter(s => s.isPaid).length,
            unpaidCount: sales.filter(s => !s.isPaid).length,
        };
    }, [sales, products, expenses]);

    // آخر 5 مبيعات
    const recentSales = useMemo(() => {
        return [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    }, [sales]);

    // مبيعات حسب المنتج
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
        <div className="space-y-8 animate-fade-in pb-10">

            {/* --- شريط التذكير --- */}
            <div className="flex justify-center -mb-4 relative z-10">
                <div className="bg-white border border-emerald-200 text-emerald-800 px-8 py-3 rounded-2xl shadow-lg shadow-emerald-50 transform hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 group">
                    <div className="bg-gradient-to-br from-emerald-100 to-teal-100 p-2.5 rounded-xl text-emerald-600 group-hover:rotate-12 transition-transform"><i className="fa-solid fa-kaaba text-sm"></i></div>
                    <p className="font-bold text-base tracking-wide animate-pulse">اللهم صلِّ وسلم على نبينا محمد</p>
                    <div className="bg-gradient-to-br from-emerald-100 to-teal-100 p-2.5 rounded-xl text-emerald-600 group-hover:-rotate-12 transition-transform"><i className="fa-solid fa-mosque text-sm"></i></div>
                </div>
            </div>

            {/* --- Header --- */}
            <div className="bg-white p-6 pt-10 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"></div>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-50 -translate-y-1/2 translate-x-1/2 opacity-50 blur-2xl"></div>
                <div className="flex items-center gap-3 relative z-10">
                    <div className="bg-gradient-to-br from-indigo-100 to-violet-100 p-3 rounded-xl text-indigo-600"><i className="fa-solid fa-chart-line text-xl"></i></div>
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800">لوحة التحكم</h2>
                        <p className="text-xs text-slate-400 font-bold">نظرة عامة على أداء المبيعات</p>
                    </div>
                </div>
            </div>

            {/* --- الكروت الرئيسية --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                <StatCard title="إجمالي الأوردرات" engTitle="Total Orders" value={stats.totalSales} gradient="bg-gradient-to-br from-indigo-600 to-blue-700" icon="fa-cart-shopping" />
                
                {canViewDailyProfit && (
                    <>
                        <StatCard title="إجمالي الإيرادات" engTitle="Total Revenue" value={`${stats.totalRevenue.toLocaleString()} EGP`} gradient="bg-gradient-to-br from-emerald-500 to-teal-700" icon="fa-sack-dollar" />
                        <StatCard title="المحصّل" engTitle="Collected" value={`${stats.totalCollected.toLocaleString()} EGP`} gradient="bg-gradient-to-br from-cyan-500 to-blue-600" icon="fa-hand-holding-dollar" />
                        <StatCard title="المديونيات" engTitle="Outstanding" value={`${stats.totalRemaining.toLocaleString()} EGP`} gradient="bg-gradient-to-br from-red-500 to-rose-700" icon="fa-money-bill-transfer" />

                        <StatCard title="مصروفات يومية" engTitle="Daily Expenses" value={`${stats.totalDailyExpenses.toLocaleString()} EGP`} subTitle="إعلانات - اشتراكات - رواتب" gradient="bg-gradient-to-br from-amber-500 to-orange-600" icon="fa-clock" />
                        <StatCard title="مصروفات مخزون" engTitle="Stock Expenses" value={`${stats.totalStockExpenses.toLocaleString()} EGP`} subTitle="شراء استوك وحسابات" gradient="bg-gradient-to-br from-purple-600 to-violet-800" icon="fa-boxes-stacked" />
                        <StatCard title="إجمالي الربح" engTitle="Gross Profit" value={`${stats.grossProfit.toLocaleString()} EGP`} subTitle="الإيرادات - المصروفات اليومية" gradient={`bg-gradient-to-br ${stats.grossProfit >= 0 ? 'from-emerald-600 to-green-800' : 'from-red-600 to-red-900'}`} icon="fa-chart-line" />
                        <StatCard title="صافي الربح" engTitle="Net Profit" value={`${stats.netProfit.toLocaleString()} EGP`} subTitle="المحصّل - المصروفات اليومية" gradient={`bg-gradient-to-br ${stats.netProfit >= 0 ? 'from-green-500 to-emerald-700' : 'from-red-700 to-rose-900'}`} icon="fa-coins" />

                        <StatCard title="ربح اليوم" engTitle="Today's Profit" value={`${stats.dailyProfit.toLocaleString()} EGP`} subTitle={`إيرادات ${stats.dailyRevenue.toLocaleString()} - مصروفات ${stats.todayDailyExpenses.toLocaleString()}`} gradient={`bg-gradient-to-br ${stats.dailyProfit >= 0 ? 'from-teal-500 to-emerald-700' : 'from-red-600 to-rose-800'}`} icon="fa-sun" />
                    </>
                )}

                <StatCard title="إيراد اليوم" engTitle="Today" value={`${canViewDailyProfit ? stats.dailyRevenue.toLocaleString() + ' EGP' : stats.dailyCount}`} subTitle={canViewDailyProfit ? `${stats.dailyCount} أوردر` : 'أوردر'} gradient="bg-gradient-to-br from-violet-500 to-purple-700" icon="fa-calendar-day" />
                <StatCard title="مبيعات الأسبوع" engTitle="This Week" value={canViewDailyProfit ? `${stats.weeklyRevenue.toLocaleString()} EGP` : stats.weeklyCount} subTitle={canViewDailyProfit ? `${stats.weeklyCount} أوردر` : 'أوردر'} gradient="bg-gradient-to-br from-fuchsia-500 to-pink-700" icon="fa-calendar-week" />
                <StatCard title="مبيعات الشهر" engTitle="This Month" value={canViewDailyProfit ? `${stats.monthlyRevenue.toLocaleString()} EGP` : stats.monthlyCount} subTitle={canViewDailyProfit ? `${stats.monthlyCount} أوردر` : 'أوردر'} gradient="bg-gradient-to-br from-orange-500 to-amber-600" icon="fa-calendar-days" />

                <StatCard title="المنتجات المتاحة" engTitle="Products" value={stats.totalProducts} gradient="bg-gradient-to-br from-slate-600 to-slate-800" icon="fa-boxes-stacked" />
                <StatCard title="الأكثر مبيعاً" engTitle="Top Product" value={stats.topProduct} subTitle={`${stats.topProductCount} مبيعة`} gradient="bg-gradient-to-br from-lime-500 to-green-600" icon="fa-trophy" />
                <StatCard title="قناة التواصل الأولى" engTitle="Top Channel" value={stats.topChannel} subTitle={`${stats.topChannelCount} عميل`} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" icon="fa-comments" />
                <StatCard title="نسبة التحصيل" engTitle="Collection Rate" value={`${stats.totalSales > 0 ? ((stats.paidCount / stats.totalSales) * 100).toFixed(0) : 0}%`} subTitle={`${stats.paidCount} مدفوع / ${stats.unpaidCount} معلق`} gradient="bg-gradient-to-br from-teal-500 to-cyan-700" icon="fa-chart-pie" />
            </div>

            {/* --- مبيعات حسب المنتج + آخر المبيعات --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* مبيعات حسب المنتج */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-lg font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-chart-bar text-indigo-500"></i> المبيعات حسب المنتج
                    </h3>
                    {productStats.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-8">لا توجد بيانات بعد</p>
                    ) : (
                        <div className="space-y-3">
                            {productStats.map(([name, data]) => {
                                const maxRevenue = productStats[0]?.[1]?.revenue || 1;
                                const percentage = (data.revenue / maxRevenue) * 100;
                                return (
                                    <div key={name} className="group">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-sm text-slate-700">{name}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-slate-400 font-bold">{data.count} مبيعة</span>
                                                <span className="text-sm font-extrabold text-slate-800">{data.revenue.toLocaleString()} ج.م</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-700 group-hover:from-indigo-600 group-hover:to-purple-600" style={{ width: `${percentage}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* آخر المبيعات */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-lg font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-clock-rotate-left text-indigo-500"></i> آخر المبيعات
                    </h3>
                    {recentSales.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-8">لا توجد مبيعات بعد</p>
                    ) : (
                        <div className="space-y-3">
                            {recentSales.map(sale => (
                                <div key={sale.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${sale.isPaid ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                        <div>
                                            <div className="font-bold text-sm text-slate-800">{sale.customerEmail}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-slate-400">{sale.productName}</span>
                                                <span className="text-[10px] text-slate-300">•</span>
                                                <span className="text-xs text-slate-400">{new Date(sale.date).toLocaleDateString('ar-EG')}</span>
                                                {sale.saleType === 'workspace' && (
                                                    <span className="text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded font-bold border border-cyan-200">WS</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-left">
                                        <div className="font-black text-sm text-slate-800 dir-ltr">{Number(sale.finalPrice).toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span></div>
                                        {sale.discount > 0 && <div className="text-[10px] text-orange-600 font-bold">خصم {sale.discount} ج.م</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}

const StatCard = ({ title, engTitle, value, subTitle, gradient, icon }) => (
    <div className={`p-5 rounded-2xl text-white relative overflow-hidden ${gradient} transition-all duration-300 transform hover:-translate-y-1.5 hover:scale-[1.02] group min-h-[140px] flex flex-col justify-between border border-white/10`} style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
        <div className="absolute -left-6 -bottom-6 text-[80px] opacity-[0.08] group-hover:opacity-[0.12] group-hover:scale-110 transition-all duration-500 rotate-12">
            <i className={`fa-solid ${icon}`}></i>
        </div>
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 blur-xl"></div>
        <div className="relative z-10 flex justify-between items-start">
            <div>
                <h3 className="text-sm font-extrabold tracking-wide leading-tight">{title}</h3>
                <p className="text-[9px] uppercase opacity-50 font-sans tracking-widest mt-0.5">{engTitle}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm p-2 rounded-xl shadow-inner border border-white/10">
                <i className={`fa-solid ${icon} text-base`}></i>
            </div>
        </div>
        <div className="relative z-10 mt-3">
            <p className="text-2xl font-black dir-ltr tracking-tight leading-none" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{value}</p>
            {subTitle && <p className="text-[9px] opacity-80 mt-1.5 font-semibold bg-black/15 backdrop-blur-sm w-fit px-2.5 py-0.5 rounded-full border border-white/5">{subTitle}</p>}
        </div>
    </div>
);