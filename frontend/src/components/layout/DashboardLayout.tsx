import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { Button } from '../ui/Button';
import {
  Building2,
  LogOut,
  FolderKanban,
  TrendingUp,
  PackageSearch,
  HardHat
} from 'lucide-react';

export const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { to: ".", end: true, icon: <FolderKanban className="w-5 h-5" />, label: "Proiectele Mele" },
    { to: "market", icon: <TrendingUp className="w-5 h-5" />, label: "Analiza Pieței" },
    { to: "materials", icon: <PackageSearch className="w-5 h-5" />, label: "Materiale Bricolaj" },
    { to: "experts", icon: <HardHat className="w-5 h-5" />, label: "Experți Construcții" },
    { to: "profile", icon: <Building2 className="w-5 h-5" />, label: "Profilul Meu" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-buildorange p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Zidario</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive
                  ? 'bg-buildorange/10 text-buildorange'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <Button
            variant="ghost"
            className="w-full flex items-center justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={logout}
          >
            <LogOut className="w-5 h-5" />
            Deconectare
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 -ml-1 text-slate-500 hover:text-slate-900">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="bg-buildorange p-1.5 rounded-lg ml-1">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">Zidario</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-5 h-5" />
          </Button>
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
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-slate-900">Zidario</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive
                        ? 'bg-buildorange/10 text-buildorange'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="p-4 border-t border-slate-100">
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={logout}
                >
                  <LogOut className="w-5 h-5" />
                  Deconectare
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Top Navbar details */}
        <header className="hidden md:flex bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 items-center justify-end sticky top-0 z-40">
          <span className="text-sm font-medium text-slate-600">
            Salut, <span className="text-slate-900 font-bold">{user?.name || 'Muncitorule'}</span>
          </span>
        </header>

        {/* Outlet for Subpages */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
