import { useState, useEffect, useMemo } from 'react';
import { usersAPI, salesAPI, accountsAPI } from '../services/api';
import { useData } from '../context/DataContext';

// قائمة الصلاحيات — محدثة حسب أقسام الموقع الفعلية
const PERMISSIONS_LIST = [
    { id: 'dashboard', label: 'الرئيسية', icon: 'fa-chart-pie', desc: 'عرض الإحصائيات والنظرة العامة' },
    { id: 'sales', label: 'المبيعات', icon: 'fa-cart-shopping', desc: 'تسجيل وإدارة عمليات البيع' },
    { id: 'products', label: 'المنتجات', icon: 'fa-boxes-stacked', desc: 'إضافة وتعديل وحذف المنتجات' },
    { id: 'accounts', label: 'المخزون', icon: 'fa-server', desc: 'إدارة الحسابات والأكواد' },
    { id: 'clients', label: 'العملاء', icon: 'fa-users', desc: 'عرض وإدارة قاعدة العملاء' },
    { id: 'shifts', label: 'الشفتات', icon: 'fa-clock', desc: 'تسجيل الحضور وعرض الشفتات' },
    { id: 'reports', label: 'التقارير', icon: 'fa-chart-line', desc: 'عرض تقارير الأداء والمالية' },
    { id: 'expenses', label: 'المصروفات', icon: 'fa-wallet', desc: 'تسجيل وإدارة المصروفات' },
    { id: 'wallets', label: 'المحافظ', icon: 'fa-vault', desc: 'إدارة المحافظ والحركات المالية' },
    { id: 'renewals', label: 'التنبيهات', icon: 'fa-bell', desc: 'تنبيهات التجديد والمديونيات' },
    { id: 'problems', label: 'المشاكل', icon: 'fa-triangle-exclamation', desc: 'تسجيل ومتابعة مشاكل العملاء' },
    { id: 'manage_attendance', label: 'إدارة الحضور والرواتب', icon: 'fa-user-clock', desc: 'عرض حضور الموظفين وحساب الرواتب' },
];

export default function Users () {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const { sales, accounts } = useData();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedRole, setSelectedRole] = useState('moderator');
    const [expandedUser, setExpandedUser] = useState(null); // لعرض تفاصيل المستخدم

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await usersAPI.getAll();
            setUsers(data);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    };

    useEffect(() => { fetchUsers(); }, []);

    // ========= إحصائيات كل مستخدم =========
    const userStats = useMemo(() => {
        const statsMap = {};
        users.forEach(u => {
            const userSales = sales.filter(s => s.moderator === u.username);
            const totalRevenue = userSales.reduce((sum, s) => sum + (Number(s.finalPrice) || 0), 0);
            const todayStr = new Date().toDateString();
            const todaySales = userSales.filter(s => new Date(s.date).toDateString() === todayStr);
            const unpaidCount = userSales.filter(s => !s.isPaid).length;
            const inventorySales = userSales.filter(s => s.fromInventory).length;

            // آخر نشاط
            const lastSale = userSales.length > 0 ? userSales.sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null;

            statsMap[u.id] = {
                totalOrders: userSales.length,
                todayOrders: todaySales.length,
                totalRevenue,
                unpaidCount,
                inventorySales,
                lastActivity: lastSale ? new Date(lastSale.date) : null,
            };
        });
        return statsMap;
    }, [users, sales]);

    // ========= Reset modal state =========
    useEffect(() => {
        if (showModal) {
            if (currentUser) {
                setSelectedRole(currentUser.role || 'moderator');
            } else {
                setSelectedRole('moderator');
            }
        }
    }, [showModal, currentUser]);

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const permissions = selectedRole === 'admin'
            ? ['all']
            : PERMISSIONS_LIST.filter(p => formData.get(`perm_${p.id}`) === 'on').map(p => p.id);

        const data = {
            id: currentUser?.id,
            username: formData.get('username'),
            password: formData.get('password'),
            role: selectedRole,
            base_salary: formData.get('base_salary'),
            vodafone_cash: formData.get('vodafone_cash'),
            permissions: permissions
        };

        try {
            await usersAPI.save(data);
            setShowModal(false);
            fetchUsers();
        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء الحفظ');
        }
    };

    const handleDelete = async (id) => {
        if (confirm('حذف المستخدم؟')) {
            try {
                await usersAPI.delete(id);
                fetchUsers();
            } catch (error) {
                console.error(error);
            }
        }
    };

    const formatDate = (date) => {
        if (!date) return 'لا يوجد';
        return new Date(date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    };
    const formatTime = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) return <div className="text-center p-10 text-slate-500"><i className="fa-solid fa-spinner fa-spin ml-2"></i>جاري تحميل المستخدمين...</div>;

    return (
        <div className="space-y-8 animate-fade-in pb-20 font-sans text-slate-800">

            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-800">المستخدمين والصلاحيات</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">إدارة فريق العمل وتحديد أدوارهم وصلاحياتهم</p>
                </div>
                <button
                    onClick={() => { setCurrentUser(null); setShowModal(true); }}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                    <i className="fa-solid fa-user-plus text-lg"></i> إضافة مستخدم
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
                    <p className="text-3xl font-black text-indigo-600">{users.length}</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">إجمالي المستخدمين</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
                    <p className="text-3xl font-black text-purple-600">{users.filter(u => u.role === 'admin').length}</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">أدمن</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
                    <p className="text-3xl font-black text-blue-600">{users.filter(u => u.role === 'moderator').length}</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">مودريتور</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
                    <p className="text-3xl font-black text-emerald-600">{sales.length}</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">إجمالي الأوردرات</p>
                </div>
            </div>

            {/* Users Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {users.map(u => {
                    const stats = userStats[u.id] || {};
                    const isExpanded = expandedUser === u.id;
                    const perms = Array.isArray(u.permissions) ? u.permissions : JSON.parse(u.permissions || '[]');

                    return (
                        <div key={u.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-full h-1.5 ${u.role === 'admin' ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}></div>

                            {/* User Header */}
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border-2 transition-colors ${u.role === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                            <i className={`fa-solid ${u.role === 'admin' ? 'fa-user-shield' : 'fa-user'}`}></i>
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-lg text-slate-800">{u.username}</h3>
                                            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                {u.role === 'admin' ? '👑 Admin' : '🔧 Moderator'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setCurrentUser({ ...u, permissions: perms });
                                                setShowModal(true);
                                            }}
                                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200 transition"
                                            title="تعديل البيانات"
                                        >
                                            <i className="fa-solid fa-pen"></i>
                                        </button>
                                        {u.role !== 'admin' && (
                                            <button
                                                onClick={() => handleDelete(u.id)}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 transition"
                                                title="حذف المستخدم"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Quick Stats Row */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-indigo-50 rounded-xl p-3 text-center border border-indigo-100">
                                        <p className="text-xl font-black text-indigo-700">{stats.totalOrders || 0}</p>
                                        <p className="text-[10px] font-bold text-indigo-500">أوردر</p>
                                    </div>
                                    <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                                        <p className="text-xl font-black text-emerald-700">{stats.todayOrders || 0}</p>
                                        <p className="text-[10px] font-bold text-emerald-500">اليوم</p>
                                    </div>
                                    <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
                                        <p className="text-xl font-black text-purple-700">{stats.inventorySales || 0}</p>
                                        <p className="text-[10px] font-bold text-purple-500">سحب مخزون</p>
                                    </div>
                                </div>

                                {/* Expand/Collapse Button */}
                                <button
                                    onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                                    className="w-full text-center py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all flex items-center justify-center gap-2 border border-indigo-100"
                                >
                                    <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
                                    {isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل والصلاحيات'}
                                </button>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-4 animate-fade-in">
                                    {/* Activity Details */}
                                    <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                            <i className="fa-solid fa-chart-bar text-indigo-500"></i> إحصائيات النشاط
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                                                    <i className="fa-solid fa-receipt text-indigo-600 text-xs"></i>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 font-bold">إجمالي الأوردرات</p>
                                                    <p className="text-sm font-black text-slate-700">{stats.totalOrders || 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                                    <i className="fa-solid fa-coins text-emerald-600 text-xs"></i>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 font-bold">إجمالي الإيرادات</p>
                                                    <p className="text-sm font-black text-slate-700">{(stats.totalRevenue || 0).toLocaleString()} ج.م</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                                                    <i className="fa-solid fa-clock text-red-600 text-xs"></i>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 font-bold">غير مدفوع</p>
                                                    <p className="text-sm font-black text-slate-700">{stats.unpaidCount || 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                                    <i className="fa-solid fa-server text-purple-600 text-xs"></i>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 font-bold">سحب من المخزون</p>
                                                    <p className="text-sm font-black text-slate-700">{stats.inventorySales || 0}</p>
                                                </div>
                                            </div>
                                        </div>
                                        {stats.lastActivity && (
                                            <div className="flex items-center gap-2 text-xs text-slate-400 font-bold pt-2 border-t border-slate-200 mt-2">
                                                <i className="fa-solid fa-clock text-blue-400"></i>
                                                آخر نشاط: {formatDate(stats.lastActivity)} — {formatTime(stats.lastActivity)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Salary & Contact Info */}
                                    {(u.base_salary > 0 || u.vodafone_cash) && (
                                        <div className="bg-amber-50 rounded-xl p-4 space-y-2 border border-amber-100">
                                            <p className="text-xs font-black text-amber-600 uppercase tracking-wider flex items-center gap-2">
                                                <i className="fa-solid fa-money-bill-wave"></i> المالية
                                            </p>
                                            <div className="flex gap-4">
                                                {u.base_salary > 0 && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-500 font-bold">الراتب:</span>
                                                        <span className="text-sm font-black text-amber-700">{Number(u.base_salary).toLocaleString()} ج.م</span>
                                                    </div>
                                                )}
                                                {u.vodafone_cash && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-500 font-bold">فودافون كاش:</span>
                                                        <span className="text-sm font-black text-slate-700 font-mono dir-ltr">{u.vodafone_cash}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Permissions */}
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-400 font-black uppercase tracking-wider flex items-center gap-2">
                                            <i className="fa-solid fa-key text-indigo-400"></i> الصلاحيات الممنوحة
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {perms.includes('all') ? (
                                                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200 w-full text-center">
                                                    <i className="fa-solid fa-check-circle ml-1"></i> صلاحية كاملة — وصول لكل الأقسام
                                                </span>
                                            ) : perms.length > 0 ? (
                                                perms.map(p => {
                                                    const permInfo = PERMISSIONS_LIST.find(pl => pl.id === p);
                                                    return (
                                                        <span key={p} className="bg-slate-50 text-slate-600 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                                                            <i className={`fa-solid ${permInfo?.icon || 'fa-check'} text-[9px] text-indigo-500`}></i>
                                                            {permInfo?.label || p}
                                                        </span>
                                                    );
                                                })
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">لا توجد صلاحيات — لن يستطيع الوصول لأي قسم</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* --- Modal: إضافة/تعديل مستخدم --- */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
                        <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-700 text-white flex justify-between items-center shadow-md z-10">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <i className={`fa-solid ${currentUser ? 'fa-user-pen' : 'fa-user-plus'}`}></i>
                                {currentUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition text-white/80 hover:text-white">
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/50">
                            <form id="userForm" onSubmit={handleSave} className="space-y-6">
                                <div>
                                    <label className="label-style">اسم المستخدم</label>
                                    <div className="relative">
                                        <input name="username" defaultValue={currentUser?.username} className="input-style pl-10" required placeholder="Example: admin" />
                                        <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                    </div>
                                </div>

                                <div>
                                    <label className="label-style">كلمة المرور <span className="text-slate-400 font-normal text-xs">{currentUser && '(اتركها فارغة لعدم التغيير)'}</span></label>
                                    <div className="relative">
                                        <input name="password" type="password" className="input-style pl-10" placeholder={currentUser ? '••••••••' : 'Password'} required={!currentUser} />
                                        <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                    </div>
                                </div>

                                {/* Role Selection */}
                                <div>
                                    <label className="label-style mb-3 block">نوع المستخدم</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedRole('moderator')}
                                            className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${selectedRole === 'moderator' ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                                        >
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-colors ${selectedRole === 'moderator' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                <i className="fa-solid fa-user"></i>
                                            </div>
                                            <div className="text-center">
                                                <p className={`font-bold text-sm ${selectedRole === 'moderator' ? 'text-blue-700' : 'text-slate-600'}`}>مودريتور</p>
                                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">صلاحيات محددة</p>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedRole('admin')}
                                            className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${selectedRole === 'admin' ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-100' : 'border-slate-200 bg-white hover:border-purple-300'}`}
                                        >
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-colors ${selectedRole === 'admin' ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                <i className="fa-solid fa-user-shield"></i>
                                            </div>
                                            <div className="text-center">
                                                <p className={`font-bold text-sm ${selectedRole === 'admin' ? 'text-purple-700' : 'text-slate-600'}`}>أدمن</p>
                                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">صلاحية كاملة</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label-style">الراتب الأساسي</label>
                                        <input type="number" name="base_salary" defaultValue={currentUser?.base_salary} className="input-style" placeholder="0.00" />
                                    </div>
                                    <div>
                                        <label className="label-style">رقم فودافون كاش</label>
                                        <input type="text" name="vodafone_cash" defaultValue={currentUser?.vodafone_cash} className="input-style" placeholder="010xxxxxxx" />
                                    </div>
                                </div>

                                {/* Permissions — Only for Moderator */}
                                {selectedRole === 'moderator' && (
                                    <div className="pt-2">
                                        <label className="label-style mb-3 block">
                                            تحديد الصلاحيات
                                            <span className="text-slate-400 font-normal text-xs mr-2">(اختر الأقسام المسموحة)</span>
                                        </label>

                                        {/* Select All / Deselect All */}
                                        <div className="flex gap-2 mb-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    PERMISSIONS_LIST.forEach(p => {
                                                        const el = document.querySelector(`[name="perm_${p.id}"]`);
                                                        if (el) el.checked = true;
                                                    });
                                                }}
                                                className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 font-bold hover:bg-emerald-100 transition"
                                            >
                                                <i className="fa-solid fa-check-double ml-1"></i> تحديد الكل
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    PERMISSIONS_LIST.forEach(p => {
                                                        const el = document.querySelector(`[name="perm_${p.id}"]`);
                                                        if (el) el.checked = false;
                                                    });
                                                }}
                                                className="text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-lg border border-red-200 font-bold hover:bg-red-100 transition"
                                            >
                                                <i className="fa-solid fa-xmark ml-1"></i> إلغاء الكل
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                            {PERMISSIONS_LIST.map(perm => {
                                                const isChecked = currentUser
                                                    ? currentUser.permissions?.includes(perm.id)
                                                    : perm.default || false;

                                                return (
                                                    <label key={perm.id} className="flex items-center gap-3 p-3 bg-white border-2 border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all group">
                                                        <div className="relative flex items-center">
                                                            <input
                                                                type="checkbox"
                                                                name={`perm_${perm.id}`}
                                                                defaultChecked={isChecked}
                                                                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 transition-all checked:border-indigo-600 checked:bg-indigo-600 hover:border-indigo-400"
                                                            />
                                                            <i className="fa-solid fa-check absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 text-xs pointer-events-none"></i>
                                                        </div>
                                                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-50 transition">
                                                            <i className={`fa-solid ${perm.icon} text-xs text-slate-400 group-hover:text-indigo-500 transition`}></i>
                                                        </div>
                                                        <div className="flex-1">
                                                            <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-700 transition-colors select-none block">{perm.label}</span>
                                                            <span className="text-[10px] text-slate-400 font-medium">{perm.desc}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Admin Notice */}
                                {selectedRole === 'admin' && (
                                    <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                                            <i className="fa-solid fa-shield-halved"></i>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-purple-700">صلاحية كاملة</p>
                                            <p className="text-xs text-purple-500 font-medium">الأدمن لديه وصول كامل لجميع الأقسام والإعدادات تلقائياً</p>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 z-10">
                            <button onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-50 border-2 border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">إلغاء</button>
                            <button type="submit" form="userForm" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                                <i className="fa-solid fa-check"></i> حفظ البيانات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS Styles Injection */}
            <style>{`
                .label-style { @apply block text-sm font-extrabold text-slate-800 mb-2 ml-1 tracking-wide; }
                .input-style { @apply w-full bg-white border-2 border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 block p-3.5 transition-all outline-none placeholder-slate-400 shadow-sm; }
                .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            `}
            </style>
        </div>
    );
}