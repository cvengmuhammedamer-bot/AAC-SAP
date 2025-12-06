import React, { useState } from 'react';
import { Product, ProductCategory } from '../types';
import { Search, Filter, Plus, Eye, Download, Ship, Plane, AlertTriangle, Calculator, DollarSign } from 'lucide-react';

interface InventoryViewProps {
  products: Product[];
  onAddToProject: (product: Product, qty: number) => void;
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ products, onAddToProject, exchangeRate, setExchangeRate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Dynamic Date Headers (Current Month + Next 3 Months)
  const today = new Date();
  const months = Array.from({ length: 4 }).map((_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const name = d.toLocaleString('default', { month: 'short' });
    if (i === 0) return `${name} (Current)`;
    return `${name} (+${i})`;
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleExportCSV = () => {
    const headers = ['Model', 'Description', 'Libya Stock', 'Pipeline Qty', 'Pipeline Type', 'Status', 'Price EUR', 'Price LYD', ...months.flatMap(m => [`${m} Avail`, `${m} Rsrvd`])];
    
    const csvContent = [
      headers.join(','),
      ...filteredProducts.map(p => {
        const sapCols = months.map((_, i) => {
           const b = p.factoryBooking[i];
           return b ? `${b.available},${b.reserved}` : '0,0';
        }).join(',');

        return [
          p.model,
          `"${p.description.replace(/"/g, '""')}"`,
          p.stockLocal,
          p.pipeline.quantity,
          p.pipeline.type,
          p.pipeline.status,
          p.priceEUR,
          (p.priceEUR * exchangeRate).toFixed(2),
          sapCols
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "Mitsubishi_Inventory_Libya.csv";
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-2 flex-1 w-full">
           <div className="relative flex-1 max-w-md">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
             <input 
               type="text" 
               placeholder="Search Model..." 
               className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:ring-red-500 focus:border-red-500 text-sm"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>
           <select 
              className="px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
           >
             <option value="All">All Categories</option>
             {Object.values(ProductCategory).map(c => <option key={c} value={c}>{c}</option>)}
           </select>
        </div>

        <div className="flex items-center gap-4">
           {/* Exchange Rate Input */}
           <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-300">
              <DollarSign size={16} className="text-slate-500"/>
              <span className="text-xs font-bold text-slate-600">1 EUR =</span>
              <input 
                type="number" 
                className="w-16 text-sm font-bold text-right focus:outline-none"
                value={exchangeRate}
                onChange={e => setExchangeRate(parseFloat(e.target.value))}
                step="0.01"
              />
              <span className="text-xs font-bold text-slate-600">LYD</span>
           </div>

           <button onClick={handleExportCSV} className="p-2 text-slate-600 hover:text-slate-900 border rounded bg-white">
             <Download size={18}/>
           </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 shadow-sm text-xs uppercase">
            <tr>
              <th className="px-4 py-3 border-b">Model</th>
              {/* Local Stock */}
              <th className="px-4 py-3 border-b text-center bg-green-50 text-green-800 w-24 border-l border-r border-green-100">
                Libya Stock
              </th>
              
              {/* Pipeline Group */}
              <th colSpan={3} className="px-4 py-3 border-b text-center bg-blue-50 text-blue-800 border-r border-blue-100">
                Pipeline (PO)
              </th>

              {/* Price Group */}
              <th colSpan={2} className="px-4 py-3 border-b text-center bg-amber-50 text-amber-800 border-r border-amber-100">
                Unit Price
              </th>

              {/* SAP Columns (Dynamic) */}
              {months.map((m, i) => (
                <th key={i} className="px-2 py-3 border-b text-center bg-purple-50 text-purple-800 border-r border-purple-100 min-w-[100px]">
                  {m}
                  <div className="flex justify-between text-[9px] mt-1 px-2 text-slate-400">
                    <span>Avail</span><span>Rsrvd</span>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 border-b text-right">Action</th>
            </tr>
            {/* Sub-header for Pipeline & Price */}
            <tr className="bg-slate-50 text-[10px] text-slate-500 font-semibold uppercase">
              <th className="px-4 py-1 border-b"></th> {/* Model Spacer */}
              <th className="px-4 py-1 border-b bg-green-50/50 border-r border-green-100"></th> {/* Stock Spacer */}
              
              {/* Pipeline Subs */}
              <th className="px-2 py-1 border-b text-center bg-blue-50/50">Qty</th>
              <th className="px-2 py-1 border-b text-center bg-blue-50/50">Type</th>
              <th className="px-2 py-1 border-b text-center bg-blue-50/50 border-r border-blue-100">Status</th>

              {/* Price Subs */}
              <th className="px-2 py-1 border-b text-right bg-amber-50/50">EUR</th>
              <th className="px-2 py-1 border-b text-right bg-amber-50/50 border-r border-amber-100">LYD</th>
              
              {/* SAP Spacers */}
              {months.map((_, i) => <th key={i} className="border-b bg-purple-50/50 border-r border-purple-100"></th>)}
              <th className="border-b"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {filteredProducts.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 group">
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-800">{p.model}</div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{p.description}</div>
                </td>

                {/* Local Stock */}
                <td className="px-4 py-3 text-center border-x border-slate-100 bg-green-50/20 group-hover:bg-green-50/40">
                  <span className={`font-bold ${p.stockLocal > 0 ? 'text-green-700' : 'text-slate-300'}`}>
                    {p.stockLocal}
                  </span>
                </td>

                {/* Pipeline Data */}
                <td className="px-2 py-3 text-center bg-blue-50/10 group-hover:bg-blue-50/30">
                   <span className={`font-bold ${p.pipeline.quantity > 0 ? 'text-blue-700' : 'text-slate-300'}`}>{p.pipeline.quantity}</span>
                </td>
                <td className="px-2 py-3 text-center bg-blue-50/10 group-hover:bg-blue-50/30">
                   {p.pipeline.quantity > 0 && (
                     <div className="flex justify-center" title={p.pipeline.type}>
                       {p.pipeline.type === 'Air' ? <Plane size={14} className="text-sky-600"/> : <Ship size={14} className="text-blue-800"/>}
                     </div>
                   )}
                </td>
                <td className="px-2 py-3 text-center border-r border-slate-100 bg-blue-50/10 group-hover:bg-blue-50/30">
                   {p.pipeline.quantity > 0 && (
                     <span className="text-[10px] px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-800 whitespace-nowrap">
                       {p.pipeline.status}
                     </span>
                   )}
                </td>

                {/* Prices */}
                <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 bg-amber-50/10">
                   €{p.priceEUR.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-800 border-r border-slate-100 bg-amber-50/10">
                   {(p.priceEUR * exchangeRate).toLocaleString(undefined, {maximumFractionDigits: 0})}
                </td>

                {/* SAP Data Split (Available vs Reserved) */}
                {months.map((_, i) => {
                  const data = p.factoryBooking[i] || { available: 0, reserved: 0 };
                  return (
                    <td key={i} className="px-2 py-3 border-r border-slate-100 bg-purple-50/10 group-hover:bg-purple-50/30">
                      <div className="flex justify-between items-center px-1">
                        <span className={`font-bold ${data.available > 0 ? 'text-green-600' : 'text-slate-300'}`}>
                          {data.available}
                        </span>
                        <div className="h-4 w-px bg-slate-200 mx-1"></div>
                        <span className={`text-[10px] ${data.reserved > 0 ? 'text-red-500 font-medium' : 'text-slate-200'}`}>
                          {data.reserved}
                        </span>
                      </div>
                    </td>
                  );
                })}

                <td className="px-4 py-3 text-right">
                   <div className="flex justify-end gap-1">
                     <input 
                       type="number" 
                       className="w-12 border rounded text-center text-xs" 
                       min="1"
                       value={quantities[p.id] || ''}
                       onChange={e => setQuantities({...quantities, [p.id]: parseInt(e.target.value)})}
                     />
                     <button 
                       onClick={() => {
                         onAddToProject(p, quantities[p.id] || 1);
                         setQuantities({...quantities, [p.id]: 0});
                       }}
                       className="bg-slate-800 text-white p-1.5 rounded hover:bg-red-600 transition-colors"
                     >
                       <Plus size={14}/>
                     </button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-2 bg-slate-50 border-t text-xs text-center text-slate-400">
         Showing {filteredProducts.length} items
      </div>
    </div>
  );
};