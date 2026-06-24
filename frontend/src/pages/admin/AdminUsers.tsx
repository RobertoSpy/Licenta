import React, { useState, useEffect } from 'react';
import { adminApi, type UserDTO } from '../../api/adminApi';
import { Users, Shield, HardHat, User, Search } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers(page, 20);
      if (res.data) {
        setUsers(res.data);
        setTotalPages(res.pagination?.totalPages || 1);
      } else {
        setUsers(res); // fallback legacy
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleContractor = async (userId: number) => {
    try {
      const newStatus = await adminApi.toggleContractorVerification(userId);
      setUsers(prev => prev.map(u => {
        if (u.id === userId && u.contractor) {
          return { ...u, contractor: { ...u.contractor, isVerified: newStatus } };
        }
        return u;
      }));
    } catch (err) {
      console.error(err);
      alert('Eroare la modificarea statusului constructorului.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-950/50 rounded-xl text-red-500">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-white">Gestionare Utilizatori</h1>
        </div>
        <div className="text-slate-400 font-medium">
          Total: <span className="text-white font-bold">{users.length}</span> conturi
        </div>
      </div>

      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Caută utilizator (email, nume)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-sm">
                <th className="pb-3 font-semibold">ID</th>
                <th className="pb-3 font-semibold">Nume & Email</th>
                <th className="pb-3 font-semibold">Rol</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Data Înregistrării</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    <div className="animate-pulse flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      Se încarcă...
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Nu a fost găsit niciun utilizator.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                    <td className="py-4 text-slate-500">#{user.id}</td>
                    <td className="py-4">
                      <div className="font-bold text-slate-200">{user.name || 'Fără nume'}</div>
                      <div className="text-slate-500 text-xs">{user.email}</div>
                    </td>
                    <td className="py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider
                        ${user.role === 'ADMIN' ? 'bg-red-950/50 text-red-400 border border-red-900/50' : 
                          user.role === 'CONTRACTOR' ? 'bg-amber-950/50 text-amber-400 border border-amber-900/50' : 
                          'bg-blue-950/50 text-blue-400 border border-blue-900/50'}`}
                      >
                        {user.role === 'ADMIN' && <Shield className="w-3 h-3" />}
                        {user.role === 'CONTRACTOR' && <HardHat className="w-3 h-3" />}
                        {user.role === 'CLIENT' && <User className="w-3 h-3" />}
                        {user.role}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col gap-2">
                        {user.role === 'CONTRACTOR' ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-[10px] uppercase">Email:</span>
                              {user.isVerified ? (
                                <span className="text-emerald-400 text-xs font-bold uppercase">Verificat</span>
                              ) : (
                                <span className="text-slate-500 text-xs font-bold uppercase">Neverificat</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-[10px] uppercase">Firma (CUI):</span>
                              <button 
                                onClick={() => handleToggleContractor(user.id)}
                                className={`text-xs font-bold uppercase px-2 py-1 rounded transition-colors ${
                                  user.contractor?.isVerified 
                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
                                    : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                }`}
                              >
                                {user.contractor?.isVerified ? 'Aprobat' : 'Neaprobat (Click)'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-[10px] uppercase">Email:</span>
                            {user.isVerified ? (
                              <span className="text-emerald-400 text-xs font-bold uppercase">Verificat</span>
                            ) : (
                              <span className="text-slate-500 text-xs font-bold uppercase">Neverificat</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString('ro-RO', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <span className="text-sm text-slate-400">
              Pagina {page} din {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white disabled:opacity-50"
              >
                Înapoi
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white disabled:opacity-50"
              >
                Înainte
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
