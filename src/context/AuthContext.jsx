import { createContext, useState, useContext, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();
const USER_CACHE_KEY = 'diaa-store_user';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const authChecked = useRef(false);

    // التحقق من التوكن عند فتح الموقع
    useEffect(() => {
        if (authChecked.current) return;
        authChecked.current = true;

        const checkUser = async () => {
            const token = localStorage.getItem('diaa-store_token');
            if (!token) { setLoading(false); return; }

            // استخدم البيانات المحفوظة كـ fallback لو الشبكة مش شغالة
            const cachedUser = localStorage.getItem(USER_CACHE_KEY);
            let fallbackUser = null;
            try { fallbackUser = cachedUser ? JSON.parse(cachedUser) : null; } catch { }

            try {
                const userData = await authAPI.checkAuth(token);
                if (userData) {
                    setUser(userData);
                    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
                } else {
                    // Token صريح غير صالح — يعني اتغير أو اتمسح من الداتابيز
                    localStorage.removeItem('diaa-store_token');
                    localStorage.removeItem(USER_CACHE_KEY);
                    setUser(null);
                }
            } catch (error) {
                // Network error — مش معناه إن التوكن غلط، ممكن مشكلة نت
                console.error('Auth check network error:', error);
                if (fallbackUser) {
                    setUser(fallbackUser); // استخدم الكاش بدل ما نطرد اليوزر
                }
            }
            setLoading(false);
        };
        checkUser();
    }, []);

    const login = async (username, password) => {
        const result = await authAPI.login(username, password);
        if (result.status === 'success') {
            localStorage.setItem('diaa-store_token', result.token);
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify(result.user));
            setUser(result.user);
            return { success: true };
        }
        return { success: false, message: result.message };
    };

    const changePassword = async (oldPassword, newPassword) => {
        try {
            const result = await authAPI.changePassword(user.id, oldPassword, newPassword);
            return result;
        } catch (err) {
            return { success: false, message: err.message || 'حدث خطأ' };
        }
    };

    const logout = async () => {
        const token = localStorage.getItem('diaa-store_token');
        if (token) {
            try { await authAPI.logout(token); } catch { }
        }
        localStorage.removeItem('diaa-store_token');
        localStorage.removeItem(USER_CACHE_KEY);
        setUser(null);
    };

    // hasPermission(perm) — any access (view or edit)
    // hasPermission(perm, 'edit') — edit access only
    // hasPermission(perm, 'view') — view access (also true if has edit)
    const hasPermission = (perm, level) => {
        if (!user) return false;
        if (user.role === 'admin' || (user.permissions && user.permissions.includes('all'))) return true;
        if (!user.permissions) return false;

        // New format: 'sales:view', 'sales:edit'
        const hasEdit = user.permissions.includes(`${perm}:edit`);
        const hasView = user.permissions.includes(`${perm}:view`);
        const hasLegacy = user.permissions.includes(perm); // old format — treat as full (edit)

        if (!level) return hasEdit || hasView || hasLegacy; // any access
        if (level === 'edit') return hasEdit || hasLegacy;
        if (level === 'view') return hasEdit || hasView || hasLegacy; // edit includes view
        return false;
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, hasPermission, changePassword, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);