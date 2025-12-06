import React, { useState, useRef } from 'react';
import { Globe, CheckCircle, UploadCloud, Server, Warehouse, Plane } from 'lucide-react';
import { Product } from '../types';

interface MitsubishiPortalProps {
  onSync: (data: any[], source: 'SAP' | 'LOCAL' | 'PIPELINE') => void;
  currentProducts: Product[];
}

export const MitsubishiPortal: React.FC<MitsubishiPortalProps> = ({ onSync }) => {
  const [activeMode, setActiveMode] = useState<'SAP' | 'LOCAL' | 'PIPELINE'>('SAP');
  const [csvData, setCsvData] = useState('');
  const [stagedData, setStagedData] = useState<any[]>([]);
  const [syncStep, setSyncStep] = useState<'input' | 'review' | 'complete'>('input');
  const [statusMessage, setStatusMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // -------------------------------------------------------------------------
  // ROBUST PARSER ENGINE
  // -------------------------------------------------------------------------
  const detectDelimiter = (text: string) => {
    const header = text.slice(0, 1000);
    const commas = (header.match(/,/g) || []).length;
    const semicolons = (header.match(/;/g) || []).length;
    const tabs = (header.match(/\t/g) || []).length;
    
    if (tabs > commas && tabs > semicolons) return '\t';
    if (semicolons > commas) return ';';
    return ',';
  };

  const cleanStr = (val: string) => val?.toString().replace(/"/g, '').trim() || '';
  const cleanNum = (val: string) => {
    if (!val) return 0;
    // Handle European format (1.000,00) vs US (1,000.00)
    let clean = val.replace(/"/g, '').trim();
    if (clean.includes(',') && clean.includes('.')) {
        if (clean.indexOf(',') > clean.indexOf('.')) clean = clean.replace(/\./g, '').replace(',', '.'); // 1.000,00 -> 1000.00
        else clean = clean.replace(/,/g, ''); // 1,000.00 -> 1000.00
    } else if (clean.includes(',')) {
        if (clean.length - clean.lastIndexOf(',') <= 3) clean = clean.replace(',', '.');
        else clean = clean.replace(/,/g, '');
    }
    return parseFloat(clean) || 0;
  };

  // Helper to identify Mitsubishi Models
  const isMitsubishiModel = (val: string) => {
      const s = val.toUpperCase().trim();
      // Explicitly reject references/PO numbers
      if (s.startsWith('BVI') || s.startsWith('PO-') || s.startsWith('REF') || s.includes('PARTIAL')) return false;
      if (s.length < 4) return false;

      // Common prefixes
      if (s.match(/^(MSZ|MUZ|PUHY|PURY|PEFY|PLFY|PKFY|PCFY|PMFY|SEZ|SUZ|PEAD|PLA|PKA|PCA|MFZ|CMB|PAC)-/)) return true;
      // Generic pattern: 3-4 letters, dash, numbers/letters
      if (s.match(/^[A-Z]{2,5}-[A-Z0-9]{2,}/)) return true;
      return false;
  };

  const parseData = (input: string) => {
    setStatusMessage('Analyzing data structure...');
    try {
        const delimiter = detectDelimiter(input);
        const rawRows = input.trim().split(/\r?\n/).filter(r => r.trim().length > 0);
        
        if (rawRows.length === 0) {
            setStatusMessage('Error: File appears empty.');
            return;
        }

        // 1. Split all rows first
        const grid = rawRows.map(row => {
            const pattern = new RegExp(`(\\${delimiter}|\\r?\\n|\\r|^)(?:"([^"]*(?:""[^"]*)*)"|([^"\\${delimiter}\\r\\n]*))`, "gi");
            const cols = [];
            let matches;
            while ((matches = pattern.exec(row))) {
                let m = matches[2] ? matches[2].replace(/""/g, '"') : matches[3];
                cols.push(m);
            }
            if (cols.length > 0 && cols[0] === undefined) cols.shift();
            return cols.map(c => cleanStr(c));
        });

        // -----------------------------------------------------------------------
        // STRATEGY: CONTENT-BASED COLUMN DETECTION (Score System)
        // -----------------------------------------------------------------------
        let parsedRows: any[] = [];
        const sampleLimit = Math.min(grid.length, 100);

        if (activeMode === 'PIPELINE' || activeMode === 'LOCAL') {
             // 1. Find Model Column (Highest Score)
             const colScores = new Array(grid[0].length).fill(0);
             for (let i = 0; i < sampleLimit; i++) {
                grid[i].forEach((cell, colIdx) => {
                    if (isMitsubishiModel(cell)) colScores[colIdx]++;
                });
             }
             let modelCol = -1;
             let maxScore = 0;
             colScores.forEach((score, idx) => { if (score > maxScore) { maxScore = score; modelCol = idx; } });

             if (modelCol === -1 || maxScore === 0) {
                 setStatusMessage('Error: No Mitsubishi Model codes found in this file.');
                 return;
             }

             // 2. Find Qty Column (Numeric, not Model)
             const qtyScores = new Array(grid[0].length).fill(0);
             for (let i = 0; i < sampleLimit; i++) {
                grid[i].forEach((cell, colIdx) => {
                    if (colIdx !== modelCol && /^[0-9]+$/.test(cleanStr(cell))) { // integer check prefers Qty
                        qtyScores[colIdx]++;
                    }
                });
             }
             let qtyCol = -1;
             let maxQtyScore = 0;
             qtyScores.forEach((score, idx) => { if (score > maxQtyScore) { maxQtyScore = score; qtyCol = idx; } });

             // 3. Extract
             parsedRows = grid.map(row => {
                 const rawModel = cleanStr(row[modelCol]);
                 // FILTER: Only keep rows that look like Mitsubishi Models
                 if (!isMitsubishiModel(rawModel)) return null;
                 
                 const qty = cleanNum(row[qtyCol]);
                 if (qty <= 0) return null;

                 if (activeMode === 'LOCAL') return { model: rawModel, local: qty };
                 return { model: rawModel, pipeline: qty, pipelineEta: '', pipelineType: 'Sea' };
             }).filter(Boolean);

             setStatusMessage(`Detected Model at Col ${modelCol+1}, Qty at Col ${qtyCol+1}`);
        } 
        else {
             // --- SAP MODE (Keep existing robust logic) ---
             // Find Header Row
             const keys = {
                model: ['model', 'material', 'sku', 'article', 'description'],
                price: ['price', 'amount', 'value', 'eur'],
                sapAvail: ['available', 'unrestricted', 'free', 'avail'],
                sapBook: ['booking', 'reserved', 'commit', 'block', 'sales']
            };
            let headerIdx = -1;
            let map: any = {};
            
            for(let i=0; i<Math.min(grid.length, 50); i++) {
                const row = grid[i].map(c => c.toLowerCase());
                if (row.some(c => keys.model.some(k => c.includes(k)))) {
                    headerIdx = i;
                    map.model = row.findIndex(c => keys.model.some(k => c.includes(k)));
                    map.price = row.findIndex(c => keys.price.some(k => c.includes(k)));
                    
                    // Month Detection
                    const availIndices: number[] = [];
                    const dateRegex = /(\d{1,2}[./-]\d{2,4})|((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i;
                    row.forEach((c, idx) => {
                        const isAvailKey = keys.sapAvail.some(k => c.includes(k));
                        const isDate = dateRegex.test(c);
                        if ((isAvailKey || isDate) && !keys.sapBook.some(k => c.includes(k))) availIndices.push(idx);
                    });

                    map.bookings = [];
                    for (let m=0; m<4; m++) {
                        if (m < availIndices.length) {
                            const av = availIndices[m];
                            map.bookings.push({ monthIdx: m, avail: av, book: av + 1 }); // Assume Booking is next to Avail
                        }
                    }
                    break;
                }
            }

            if (headerIdx === -1) { setStatusMessage('Error: Could not find SAP headers.'); return; }

            parsedRows = grid.slice(headerIdx + 1).map(row => {
                const m = cleanStr(row[map.model]);
                if (!m || m.length < 3) return null;
                const bookings = map.bookings?.map((b: any, i: number) => ({
                    month: `Month +${i}`,
                    available: cleanNum(row[b.avail]),
                    reserved: cleanNum(row[b.book])
                })) || [];
                return {
                    model: m,
                    price: map.price > -1 ? cleanNum(row[map.price]) : 0,
                    bookings
                };
            }).filter(Boolean);
        }

        setStagedData(parsedRows);
        if (parsedRows.length > 0) {
            setSyncStep('review');
        } else {
            setStatusMessage('No valid rows found after filtering.');
        }

    } catch (err) {
        console.error(err);
        setStatusMessage('Critical Error parsing file.');
    }
  };

  const processFile = (file: File) => {
     if (!file) return;
     if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
         setStatusMessage('❌ Error: Please Save Excel as CSV.');
         return;
     }
     setStatusMessage(`Reading ${file.name}...`);
     const reader = new FileReader();
     reader.onload = (ev) => {
         setCsvData(ev.target?.result as string);
         parseData(ev.target?.result as string);
     };
     reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if(e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const activeColor = activeMode === 'SAP' ? 'red' : activeMode === 'LOCAL' ? 'green' : 'blue';

  return (
    <div 
        className={`h-full flex flex-col gap-6 p-6 overflow-hidden bg-white rounded shadow-sm border relative transition-colors ${isDragging ? `border-${activeColor}-500 bg-${activeColor}-50` : 'border-slate-200'}`}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
    >
       {/* Mode Tabs */}
       <div className="flex gap-2 border-b border-slate-200 pb-1">
           <button onClick={() => { setActiveMode('SAP'); setSyncStep('input'); }} className={`px-4 py-2 font-bold rounded-t-lg transition-colors ${activeMode === 'SAP' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
               <Globe size={16} className="inline mr-2"/>SAP Documents
           </button>
           <button onClick={() => { setActiveMode('LOCAL'); setSyncStep('input'); }} className={`px-4 py-2 font-bold rounded-t-lg transition-colors ${activeMode === 'LOCAL' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
               <Warehouse size={16} className="inline mr-2"/>Libya Stock
           </button>
           <button onClick={() => { setActiveMode('PIPELINE'); setSyncStep('input'); }} className={`px-4 py-2 font-bold rounded-t-lg transition-colors ${activeMode === 'PIPELINE' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
               <Plane size={16} className="inline mr-2"/>Pipeline PO
           </button>
       </div>

       {/* Banner */}
       <div className={`bg-slate-900 text-white p-6 rounded-lg flex justify-between items-center flex-shrink-0 border-l-4 border-${activeColor}-500`}>
          <div>
             <h2 className="text-2xl font-bold flex items-center gap-2">
                 Import {activeMode === 'SAP' ? 'Factory Data' : activeMode === 'LOCAL' ? 'Local Stock' : 'Pipeline PO'}
             </h2>
             <p className="text-sm text-slate-400">
                 {activeMode === 'SAP' ? 'Upload SAP export (Model, Price, 4-Month Availability).' : activeMode === 'LOCAL' ? 'Upload Inventory Sheet (Model, Qty).' : 'Upload PO Sheet (Model, Qty).'}
             </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => fileInputRef.current?.click()} className={`bg-${activeColor}-600 hover:bg-${activeColor}-700 px-4 py-2 rounded font-bold flex gap-2 shadow-lg`}>
                <UploadCloud size={18}/> Select CSV
            </button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} accept=".csv,.txt" />
          </div>
       </div>

       {/* Status Bar */}
       {statusMessage && (
           <div className={`p-4 rounded-lg flex items-center gap-3 text-sm font-bold shadow-sm bg-slate-100 border border-slate-300 ${statusMessage.includes('Error') ? 'text-red-600' : 'text-slate-700'}`}>
               <Server size={20}/> {statusMessage}
           </div>
       )}

       {/* Input Area */}
       {syncStep === 'input' && (
          <div className="flex-1 flex flex-col min-h-0 gap-4">
             <textarea 
               className="flex-1 w-full border p-4 font-mono text-xs rounded bg-slate-50 outline-none resize-none focus:ring-2 ring-blue-500"
               placeholder={`Or paste ${activeMode} data here...`}
               value={csvData}
               onChange={e => setCsvData(e.target.value)}
             />
             <button onClick={() => parseData(csvData)} disabled={!csvData} className="bg-slate-800 text-white px-8 py-3 rounded-lg font-bold disabled:opacity-50 hover:bg-slate-700 self-end">
                Process Data
             </button>
          </div>
       )}

       {/* Review Area */}
       {syncStep === 'review' && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 border rounded bg-slate-50">
             <div className="p-2 bg-slate-200 font-bold text-xs uppercase text-slate-600">Review Data before Sync</div>
             <div className="flex-1 overflow-auto custom-scrollbar bg-white">
                <table className="w-full text-xs text-left">
                   <thead className="bg-slate-100 sticky top-0 shadow-sm">
                      <tr>
                         <th className="p-2">Model</th>
                         {activeMode === 'LOCAL' && <th className="p-2 text-green-700">Stock</th>}
                         {activeMode === 'PIPELINE' && <th className="p-2 text-blue-700">PO Qty</th>}
                         {activeMode === 'SAP' && (
                            <>
                                <th className="p-2">Price</th>
                                <th className="p-2 text-center bg-purple-50">Mnth 1 (Av/Rs)</th>
                                <th className="p-2 text-center bg-purple-50">Mnth 2 (Av/Rs)</th>
                                <th className="p-2 text-center bg-purple-50">Mnth 3 (Av/Rs)</th>
                                <th className="p-2 text-center bg-purple-50">Mnth 4 (Av/Rs)</th>
                            </>
                         )}
                      </tr>
                   </thead>
                   <tbody className="divide-y">
                      {stagedData.map((row, i) => (
                         <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-bold">{row.model}</td>
                            {activeMode === 'LOCAL' && <td className="p-2 font-mono font-bold text-green-700">{row.local}</td>}
                            {activeMode === 'PIPELINE' && <td className="p-2 font-mono font-bold text-blue-700">{row.pipeline}</td>}
                            {activeMode === 'SAP' && (
                                <>
                                    <td className="p-2">{row.price}</td>
                                    {row.bookings?.map((b: any, j: number) => (
                                        <td key={j} className="p-2 text-center border-l bg-purple-50/10">
                                            <span className="text-green-600 font-bold">{b.available}</span> / <span className="text-red-400">{b.reserved}</span>
                                        </td>
                                    ))}
                                </>
                            )}
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             <div className="p-4 border-t flex justify-end gap-3 bg-white">
                <button onClick={() => setSyncStep('input')} className="px-4 py-2 border rounded">Cancel</button>
                <button onClick={() => { onSync(stagedData, activeMode); setSyncStep('complete'); }} className={`bg-${activeColor}-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-${activeColor}-700`}>
                    Confirm Sync
                </button>
             </div>
          </div>
       )}

       {/* Success Area */}
       {syncStep === 'complete' && (
          <div className="flex-1 flex flex-col items-center justify-center">
             <CheckCircle size={64} className={`text-${activeColor}-600 mb-4`}/>
             <h2 className="text-2xl font-bold text-slate-800">Sync Complete!</h2>
             <p className="text-slate-500 mb-6">{stagedData.length} items updated in {activeMode} database.</p>
             <button onClick={() => { setSyncStep('input'); setCsvData(''); setStagedData([]); setStatusMessage(''); }} className="px-6 py-3 bg-slate-800 text-white rounded hover:bg-slate-900">
                 Upload Another File
             </button>
          </div>
       )}
    </div>
  );
};