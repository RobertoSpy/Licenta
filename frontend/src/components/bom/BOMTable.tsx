import { useState } from 'react';
import type { BOMItem } from '../../hooks/useBOMData';
import { MaterialSideDrawer } from './MaterialSideDrawer';
import { useParams } from 'react-router-dom';

interface BOMTableProps {
  items: BOMItem[];
  onMaterialReplaced: () => void;
}

export const BOMTable = ({ items, onMaterialReplaced }: BOMTableProps) => {
  const { id: projectId } = useParams<{ id: string }>();
  const [selectedItem, setSelectedItem] = useState<BOMItem | null>(null);

  // Grupăm itemii după etapă
  const itemsByPhase = items.reduce((acc, item) => {
    if (!acc[item.phase]) acc[item.phase] = [];
    acc[item.phase].push(item);
    return acc;
  }, {} as Record<string, BOMItem[]>);

  return (
    <>
      <div className="space-y-8">
        {Object.entries(itemsByPhase).map(([phase, phaseItems]) => (
          <div key={phase} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-lg">{phase}</h3>
              <span className="font-bold text-buildorange">
                {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(
                  phaseItems.reduce((s, i) => s + i.totalPrice, 0)
                )}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 w-[40%]">Material</th>
                    <th className="px-6 py-4">Cantitate</th>
                    <th className="px-6 py-4">Preț Unitar</th>
                    <th className="px-6 py-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {phaseItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-bold text-slate-900">{item.material.name}</p>
                            <p className="text-xs text-slate-400 mt-1">{item.note}</p>
                          </div>
                          <button 
                            onClick={() => setSelectedItem(item)}
                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs font-bold text-buildorange bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 hover:bg-orange-100 shrink-0 mt-2 md:mt-0 md:ml-4"
                          >
                            <span>🔄</span> Schimbă
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">
                        {item.quantity} {item.material.unit}
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(item.unitPrice)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <MaterialSideDrawer
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        currentItem={selectedItem}
        projectId={projectId!}
        onMaterialReplaced={onMaterialReplaced}
      />
    </>
  );
};
