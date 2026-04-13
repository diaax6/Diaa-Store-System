import { useState } from 'react';
import { DataProvider, useData } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './components/ConfirmDialog';
import Login from './components/Login';
import Sidebar from './components/Sidebar';

import Dashboard from './components/Dashboard';
import Sales from './components/Sales';
import Accounts from './components/Accounts';
import Shifts from './components/Shifts';
import Reports from './components/Reports';
import Expenses from './components/Expenses';
import Renewals from './components/Renewals';
import Problems from './components/Problems';
import Clients from './components/Clients';
import Wallets from './components/Wallets';
import Users from './components/Users';
import Products from './components/Products';
import BotSettings from './components/BotSettings';
import Employees from './components/Employees';

const MainLayout = () => {
  const { user } = useAuth();
  const { activeTab } = useData();
  const { hasPermission: authPermission } = useAuth();
  const checkPerm = (perm) => authPermission ? authPermission(perm) : true;

  const [isSidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <Login />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 dir-rtl flex" style={{ direction: 'rtl' }}>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 lg:mr-64 p-3 md:p-4 lg:p-8 transition-all duration-300 w-full">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">

          {/* Header للموبايل */}
          <div className="flex justify-between items-center mb-6 lg:hidden bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><i className="fa-solid fa-layer-group"></i></div>
              <h2 className="text-lg font-black text-slate-800">Diaa Store</h2>
            </div>
            <button onClick={() => setSidebarOpen(true)} className="p-2.5 bg-slate-100 text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-200 transition">
              <i className="fa-solid fa-bars text-xl"></i>
            </button>
          </div>

          {/* عرض المكونات */}
          {activeTab === 'dashboard' && checkPerm('dashboard') && <Dashboard />}
          {activeTab === 'sales' && checkPerm('sales') && <Sales />}
          {activeTab === 'products' && checkPerm('products') && <Products />}
          {activeTab === 'accounts' && checkPerm('accounts') && <Accounts />}
          {activeTab === 'clients' && checkPerm('clients') && <Clients />}
          {activeTab === 'renewals' && checkPerm('renewals') && <Renewals />}
          {activeTab === 'expenses' && checkPerm('expenses') && <Expenses />}
          {activeTab === 'reports' && checkPerm('reports') && <Reports />}
          {activeTab === 'shifts' && checkPerm('shifts') && <Shifts />}
          {activeTab === 'wallets' && checkPerm('wallets') && <Wallets />}
          {activeTab === 'problems' && checkPerm('problems') && <Problems />}
          {activeTab === 'users' && (checkPerm('all') || user.role === 'admin') && <Users />}
          {activeTab === 'botSettings' && (checkPerm('botSettings') || checkPerm('all') || user.role === 'admin') && <BotSettings />}
          {activeTab === 'employees' && (checkPerm('employees') || checkPerm('all') || user.role === 'admin') && <Employees />}

        </div>
      </main>
    </div>
  );
};

function App () {
  return (
    <AuthProvider>
      <DataProvider>
        <ConfirmProvider>
          <MainLayout />
        </ConfirmProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;