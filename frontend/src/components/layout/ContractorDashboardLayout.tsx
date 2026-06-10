/**
 * frontend/src/components/layout/ContractorDashboardLayout.tsx
 * Layout-ul portalului de constructor — stil alb cu portocaliu (brand consistent).
 */

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { HardHat, Inbox, LogOut, AlertTriangle, Briefcase, Activity, User, PackageSearch, Users } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { contractorApi } from '../../api/contractorApi';

export default function ContractorDashboardLayout() {
  const { logout, user } = useAuth();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user?.role === 'CONTRACTOR') {
      contractorApi.getMyProfile()
        .then(profile => setIsVerified(profile.isVerified))
        .catch(err => console.error('Eroare la preluarea profilului:', err));
    }
  }, [user]);

  const menuItems = [
    { name: 'Proiectele Mele', path: '/contractor/quotes', icon: <Inbox className="w-5 h-5" /> },
    { name: 'Proiecte Publice', path: '/contractor/feed', icon: <Briefcase className="w-5 h-5" /> },
    { name: 'Piață & Analize', path: '/contractor/market', icon: <Activity className="w-5 h-5" /> },
    { name: 'Materiale Bricolaj', path: '/contractor/materials', icon: <PackageSearch className="w-5 h-5" /> },
    { name: 'Experți Construcții', path: '/contractor/experts', icon: <Users className="w-5 h-5" /> },
    { name: 'Profil', path: '/contractor/profile', icon: <User className="w-5 h-5" /> },
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

        {isVerified === false && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-start sm:items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-sm text-amber-800 font-medium leading-tight">
              Contul tău este în curs de validare de către un administrator. Până la aprobare, funcția de trimitere oferte și datele de contact ale clienților sunt restricționate.
            </p>
          </div>
        )}

        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 -ml-1 text-slate-500 hover:text-slate-900">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="bg-buildorange p-1.5 rounded-lg ml-1">
              <HardHat className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">Zidario Contractor</span>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[60] md:hidden flex">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            
            {/* Sidebar content */}
            <div className="relative w-64 max-w-sm bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-left">
              <div className="p-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="bg-buildorange p-1.5 rounded-lg">
                    <HardHat className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-slate-900">Zidario</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                {menuItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
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
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet context={{ isVerified }} />
        </main>
      </div>
    </div>
  );
}
