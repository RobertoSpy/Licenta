/**
 * frontend/src/components/layout/ContractorDashboardLayout.tsx
 * Layout-ul portalului de constructor — stil alb cu portocaliu (brand consistent).
 */

import { Outlet, NavLink, Link } from 'react-router-dom';
import { HardHat, Inbox, UserCircle, Star, LogOut, BarChart3, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/useAuth';

export default function ContractorDashboardLayout() {
  const { logout, user } = useAuth();

  const menuItems = [
    { name: 'Cereri & Oferte', path: '/contractor/quotes', icon: <Inbox className="w-5 h-5" /> },
    { name: 'Concurență & Piață', path: '/contractor/market', icon: <TrendingUp className="w-5 h-5" /> },
    { name: 'Profil Firmă', path: '/contractor/profile', icon: <UserCircle className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex sticky top-0 h-screen shadow-sm">
        {/* Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-buildorange p-2 rounded-lg">
            <HardHat className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Zidario</span>
            <p className="text-[10px] font-bold text-buildorange uppercase tracking-widest">Contractor Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                  isActive
                    ? 'bg-buildorange/10 text-buildorange'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {item.icon}
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* User Info + Logout */}
        <div className="p-4 border-t border-slate-100">
          <div className="px-4 py-3 mb-2 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-400 font-medium">Conectat ca</p>
            <p className="text-sm font-bold text-slate-900 truncate">{user?.name || 'Constructor'}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all text-left font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Deconectare</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="hidden md:flex bg-white border-b border-slate-200 px-8 py-4 items-center justify-end sticky top-0 z-40">
          <span className="text-sm font-medium text-slate-600">
            Bun venit, <span className="text-slate-900 font-bold">{user?.name}</span>
          </span>
        </header>

        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <div className="bg-buildorange p-1.5 rounded-lg">
              <HardHat className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">Zidario Contractor</span>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
