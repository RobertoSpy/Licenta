import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ShieldAlert, Users, Database, Settings, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../../context/useAuth';

export default function AdminDashboardLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();

  const menuItems = [
    { label: 'Utilizatori', icon: <Users size={20} />, path: '/admin/users' },
    { label: 'Bază Materiale', icon: <Database size={20} />, path: '/admin/materials' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar - Dark / Red theme for Admin */}
      <div className="w-64 bg-slate-950 border-r border-red-900/30 text-white hidden md:flex flex-col">
        <div className="p-6">
          <Link to="/admin" className="flex items-center gap-2 text-2xl font-black text-red-500 tracking-tight">
            <ShieldAlert className="w-8 h-8" />
            Admin
          </Link>
          <p className="text-xs text-slate-500 mt-2">Zidario Control Panel</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map((item) => {
            const isActive = location.pathname.includes(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-red-950/40 text-red-400 font-bold border border-red-900/50' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-red-900/30">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 rounded-xl mb-4">
            <div className="w-8 h-8 rounded-full bg-red-900/50 flex items-center justify-center text-red-400 font-bold">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-red-950/40 rounded-xl transition-colors font-medium"
          >
            <LogOut size={20} />
            Deconectare
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-slate-950 border-b border-red-900/30 p-4 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2 text-xl font-black text-red-500 tracking-tight">
            <ShieldAlert className="w-6 h-6" />
            Admin
          </Link>
          <button onClick={logout} className="p-2 text-slate-400 hover:text-red-400">
            <LogOut size={20} />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-900 text-slate-200">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
