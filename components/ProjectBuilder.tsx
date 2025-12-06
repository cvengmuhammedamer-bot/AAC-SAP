import React, { useState } from 'react';
import { Product, ProjectItem } from '../types';
import { Trash2, Printer, FileText, CheckCircle2, Factory, Plane, Warehouse, Calculator, X } from 'lucide-react';

interface ProjectBuilderProps {
  products: Product[];
  items: ProjectItem[];
  clientName: string;
  setClientName: (name: string) => void;
  projectName: string;
  setProjectName: (name: string) => void;
  onUpdateQty: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
  exchangeRate: number;
}

export const ProjectBuilder: React.FC<ProjectBuilderProps> = ({ 
  products, items, clientName, setClientName, projectName, setProjectName, onUpdateQty, onRemoveItem, exchangeRate
}) => {
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Calc Totals
  const totalEUR = items.reduce((sum, item) => {
    const p = products.find(prod => prod.id === item.productId);
    return sum + (p ? p.priceEUR * item.requestedQty : 0);
  }, 0);
  
  const totalLYD = totalEUR * exchangeRate;

  // Print Preview Component
  const PrintPreview = () => (
    <div className="absolute inset-0 z-50 bg-slate-800/90 flex justify-center overflow-auto p-8">
       <div className="bg-white w-[210mm] min-h-[297mm] p-12 relative flex flex-col shadow-2xl">
          <button onClick={() => setShowPrintPreview(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-600 print:hidden"><X size={32}/></button>
          
          {/* Letterhead */}
          <div className="border-b-4 border-red-600 pb-4 mb-8 flex justify-between">
             <div>
                <h1 className="text-3xl font-bold text-slate-900">MITSUBISHI ELECTRIC</h1>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Libya Official Distributor</p>
             </div>
             <div className="text-right">
                <h2 className="text-2xl font-bold text-slate-300">QUOTATION</h2>
                <p className="text-sm">Date: {new Date().toLocaleDateString()}</p>
                <p className="text-sm">Rate: 1 EUR = {exchangeRate.toFixed(3)} LYD</p>
             </div>
          </div>

          {/* Client Info */}
          <div className="mb-8 grid grid-cols-2 gap-8">
             <div className="p-4 bg-slate-50 border rounded">
                <p className="text-xs text-slate-400 font-bold uppercase">Client</p>
                <p className="font-bold text-lg">{clientName || 'Cash Client'}</p>
             </div>
             <div className="p-4 bg-slate-50 border rounded">
                <p className="text-xs text-slate-400 font-bold uppercase">Project</p>
                <p className="font-bold text-lg">{projectName || 'General Supply'}</p>
             </div>
          </div>

          {/* Bill of Quantities */}
          <table className="w-full text-sm border-collapse mb-8">
             <thead className="bg-slate-100 text-slate-700 border-y border-slate-300">
                <tr>
                   <th className="py-2 px-2 text-left">#</th>
                   <th className="py-2 px-2 text-left">Description</th>
                   <th className="py-2 px-2 text-center">Qty</th>
                   <th className="py-2 px-2 text-right">Unit Price (LYD)</th>
                   <th className="py-2 px-2 text-right">Total (LYD)</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {items.map((item, i) => {
                   const p = products.find(prod => prod.id === item.productId);
                   if(!p) return null;
                   const unitLYD = p.priceEUR * exchangeRate;
                   return (
                      <tr key={i}>
                         <td className="py-3 px-2 text-slate-400">{i+1}</td>
                         <td className="py-3 px-2">
                            <div className="font-bold">{p.model}</div>
                            <div className="text-xs text-slate-500">{p.description}</div>
                            <div className="text-[10px] italic text-slate-400 mt-1">Avail: {item.deliveryDate}</div>
                         </td>
                         <td className="py-3 px-2 text-center font-bold">{item.requestedQty}</td>
                         <td className="py-3 px-2 text-right">{unitLYD.toLocaleString(undefined, {maximumFractionDigits:2})}</td>
                         <td className="py-3 px-2 text-right font-bold">{(unitLYD * item.requestedQty).toLocaleString(undefined, {maximumFractionDigits:2})}</td>
                      </tr>
                   );
                })}
             </tbody>
          </table>

          {/* Footer Totals */}
          <div className="mt-auto border-t border-slate-300 pt-6 flex justify-end">
             <div className="w-1/3">
                <div className="flex justify-between py-1 border-b border-slate-100">
                   <span>Total (EUR):</span>
                   <span className="font-mono">€{totalEUR.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 text-xl font-bold text-slate-900 mt-2">
                   <span>TOTAL (LYD):</span>
                   <span>{totalLYD.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
                </div>
             </div>
          </div>
       </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-4">
      {showPrintPreview && <PrintPreview />}
      
      {/* Header Controls */}
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
         <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Client Name</label>
            <input 
              className="w-full border rounded p-2 text-sm bg-slate-50" 
              placeholder="e.g. Al-Nour Co."
              value={clientName} 
              onChange={e => setClientName(e.target.value)}
            />
         </div>
         <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Project Ref</label>
            <input 
              className="w-full border rounded p-2 text-sm bg-slate-50" 
              placeholder="e.g. Tripoli Hotel"
              value={projectName} 
              onChange={e => setProjectName(e.target.value)}
            />
         </div>
         <div className="flex-1 bg-slate-50 border rounded p-2 flex flex-col justify-center items-end pr-4">
             <span className="text-xs text-slate-500">Total Value (LYD)</span>
             <span className="text-lg font-bold text-red-600">{totalLYD.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
         </div>
      </div>

      {/* List */}
      <div className="flex-1 bg-white rounded border border-slate-200 overflow-hidden flex flex-col">
         <div className="flex-1 overflow-auto p-4">
            <table className="w-full text-sm">
               <thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase">
                  <tr>
                     <th className="px-4 py-2 text-left">Item</th>
                     <th className="px-4 py-2 text-center">Qty</th>
                     <th className="px-4 py-2 text-left">Availability Breakdown</th>
                     <th className="px-4 py-2 text-right">Price (LYD)</th>
                     <th className="px-4 py-2"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                     const p = products.find(prod => prod.id === item.productId);
                     if(!p) return null;
                     const stockShare = (item.allocatedFromStock / item.requestedQty) * 100;
                     const pipeShare = (item.allocatedFromPipeline / item.requestedQty) * 100;
                     const sapShare = (item.allocatedFromFactory / item.requestedQty) * 100;
                     
                     return (
                        <tr key={idx} className="hover:bg-slate-50">
                           <td className="px-4 py-3">
                              <div className="font-bold text-slate-800">{p.model}</div>
                              <div className="text-xs text-slate-500">{p.category}</div>
                           </td>
                           <td className="px-4 py-3 text-center">
                              <input 
                                type="number" 
                                className="w-16 border rounded text-center font-bold"
                                value={item.requestedQty}
                                onChange={e => onUpdateQty(idx, parseInt(e.target.value))}
                              />
                           </td>
                           <td className="px-4 py-3">
                              {/* Visualization Bar */}
                              <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 w-full mb-1">
                                 {stockShare > 0 && <div style={{width: `${stockShare}%`}} className="bg-green-500" title={`Stock: ${item.allocatedFromStock}`}/>}
                                 {pipeShare > 0 && <div style={{width: `${pipeShare}%`}} className="bg-blue-500" title={`Pipeline: ${item.allocatedFromPipeline}`}/>}
                                 {sapShare > 0 && <div style={{width: `${sapShare}%`}} className="bg-purple-500" title={`SAP: ${item.allocatedFromFactory}`}/>}
                              </div>
                              <div className="text-[10px] flex gap-3 font-medium text-slate-500">
                                 {item.allocatedFromStock > 0 && <span className="flex items-center gap-1 text-green-700"><Warehouse size={10}/> {item.allocatedFromStock} Local</span>}
                                 {item.allocatedFromPipeline > 0 && <span className="flex items-center gap-1 text-blue-700"><Plane size={10}/> {item.allocatedFromPipeline} Pipe</span>}
                                 {item.allocatedFromFactory > 0 && <span className="flex items-center gap-1 text-purple-700"><Factory size={10}/> {item.allocatedFromFactory} SAP</span>}
                              </div>
                              <div className="text-xs font-bold text-slate-800 mt-1">{item.deliveryDate}</div>
                           </td>
                           <td className="px-4 py-3 text-right font-bold text-slate-700">
                              {((p.priceEUR * exchangeRate) * item.requestedQty).toLocaleString(undefined, {maximumFractionDigits: 0})}
                           </td>
                           <td className="px-4 py-3 text-right">
                              <button onClick={() => onRemoveItem(idx)} className="text-slate-300 hover:text-red-500">
                                 <Trash2 size={16}/>
                              </button>
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
         <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
            <button 
              onClick={() => setShowPrintPreview(true)}
              className="bg-slate-800 text-white px-6 py-2 rounded shadow hover:bg-slate-900 flex items-center gap-2"
              disabled={items.length === 0}
            >
               <Printer size={16}/> Print Quotation
            </button>
         </div>
      </div>
    </div>
  );
};