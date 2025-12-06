
import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { InventoryView } from './components/InventoryView';
import { ProjectBuilder } from './components/ProjectBuilder';
import { Dashboard } from './components/Dashboard';
import { MitsubishiPortal } from './components/MitsubishiPortal';
import { Product, ProjectItem, ProductCategory } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [projectItems, setProjectItems] = useState<ProjectItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  
  // Global Exchange Rate (Euro to LYD)
  const [exchangeRate, setExchangeRate] = useState<number>(5.35);

  // ---------------------------------------------------------------------------
  // HELPER: MITSUBISHI MODEL INTELLIGENCE
  // ---------------------------------------------------------------------------
  const analyzeModel = (modelName: string) => {
    const m = modelName.toUpperCase().trim();
    let category = ProductCategory.DX_SPLIT;
    let capacityKW = 0;

    if (m.match(/^(PUHY|PURY|PUCY|PQHY|PQRY)/)) {
      category = ProductCategory.VRF_OUTDOOR;
    } else if (m.match(/^(PLFY|PEFY|PKFY|PCFY|PMFY|PFFY)/)) {
      category = ProductCategory.VRF_INDOOR;
    } else if (m.match(/^(CMB|PAC)/)) {
      category = ProductCategory.CONTROLLER;
    } else if (m.match(/^(MSZ|MUZ|MFZ|SEZ|SUZ)/)) {
      category = ProductCategory.DX_SPLIT;
    } else if (m.match(/^(PEAD|PLA|PKA|PCA)/)) {
      category = ProductCategory.DX_SPLIT;
    }

    const numberMatch = m.match(/P(\d{2,3})/);
    const splitMatch = m.match(/[A-Z]-?(\d{2,3})[A-Z]?/); 

    if (category === ProductCategory.VRF_OUTDOOR || category === ProductCategory.VRF_INDOOR) {
      if (numberMatch) {
        const index = parseInt(numberMatch[1]);
        if (index === 200) capacityKW = 22.4;
        else if (index === 250) capacityKW = 28.0;
        else if (index === 300) capacityKW = 33.5;
        else if (index === 350) capacityKW = 40.0;
        else if (index === 400) capacityKW = 45.0;
        else if (index === 450) capacityKW = 50.0;
        else if (index === 500) capacityKW = 56.0;
        else capacityKW = index * 0.112; 
      }
    } else {
      if (splitMatch) {
         const index = parseInt(splitMatch[1]);
         capacityKW = index / 10;
      }
    }

    return { category, capacityKW: parseFloat(capacityKW.toFixed(1)) };
  };

  // ---------------------------------------------------------------------------
  // DATA SYNC LOGIC (SMART MERGE)
  // ---------------------------------------------------------------------------
  const handleDataSync = (importedData: any[], source: 'SAP' | 'LOCAL' | 'PIPELINE') => {
    const updatedProducts = [...products];
    
    // RECURSIVE NORMALIZER: Handles "MSZ-AP35VG-E1" vs "MSZ-AP35"
    const normalize = (s: string) => {
      if (!s) return '';
      let clean = s.toUpperCase().replace(/[^A-Z0-9]/g, ''); // Strip non-alphanumeric
      
      // Recursively strip suffixes until no change (e.g. VGE1 -> VG -> "")
      let prev;
      do {
        prev = clean;
        // Common Mitsubishi suffixes
        clean = clean.replace(/(VG|V|E1|E2|ET|EN|ER|KIT|SET|KD|KA|R1|R2)$/, '');
      } while (clean !== prev && clean.length > 3); // Keep at least 3 chars
      
      return clean;
    };

    importedData.forEach(item => {
      const importNorm = normalize(item.model);
      
      // 1. Exact Match
      let existingIdx = updatedProducts.findIndex(p => p.model.toLowerCase() === item.model.toLowerCase());
      
      // 2. Normalized Match
      if (existingIdx === -1) {
          existingIdx = updatedProducts.findIndex(p => normalize(p.model) === importNorm);
      }

      // 3. Partial Match (Start With) - Critical for Stock Sheet matching SAP Sheet
      if (existingIdx === -1) {
        existingIdx = updatedProducts.findIndex(p => {
          const pNorm = normalize(p.model);
          // Only match if one is a clear prefix of the other and they share the same capacity digits
          return (pNorm.startsWith(importNorm) || importNorm.startsWith(pNorm)) && 
                 pNorm.replace(/\D/g,'') === importNorm.replace(/\D/g,'');
        });
      }
      
      if (existingIdx > -1) {
        // --- UPDATE EXISTING ---
        const p = updatedProducts[existingIdx];
        
        updatedProducts[existingIdx] = {
          ...p,
          // If merging from SAP, update price. If merging from Local, keep existing price.
          priceEUR: source === 'SAP' ? (item.price || p.priceEUR) : p.priceEUR,
          capacityKW: p.capacityKW || analyzeModel(item.model).capacityKW, // Ensure capacity is set
          
          // Force update local stock if source is LOCAL
          stockLocal: source === 'LOCAL' ? (item.local !== undefined ? Number(item.local) : p.stockLocal) : p.stockLocal,
          
          pipeline: source === 'PIPELINE' ? {
              quantity: item.pipeline,
              type: item.pipelineType || p.pipeline.type,
              status: item.pipeline > 0 ? 'Shipped' : 'In Production',
              eta: item.pipelineEta || p.pipeline.eta
          } : p.pipeline,
          
          factoryBooking: source === 'SAP' ? item.bookings : p.factoryBooking,
        };
      } else {
        // --- CREATE NEW ---
        const { category, capacityKW } = analyzeModel(item.model);
        
        const newPipeline = {
            quantity: source === 'PIPELINE' ? item.pipeline : 0,
            type: (source === 'PIPELINE' ? item.pipelineType : 'Sea') as 'Sea'|'Air',
            status: 'In Production' as 'In Production',
            eta: source === 'PIPELINE' ? item.pipelineEta : undefined
        };

        updatedProducts.push({
          id: `IMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          model: item.model, // Use the model name from the sheet
          description: item.description || (source === 'LOCAL' ? 'Libya Stock Item' : 'Imported Item'),
          category,
          priceEUR: source === 'SAP' ? (item.price || 0) : 0,
          capacityKW,
          stockLocal: source === 'LOCAL' ? (item.local || 0) : 0,
          pipeline: newPipeline,
          factoryBooking: source === 'SAP' ? item.bookings : [],
          specs: { dimensions: '-', weight: '-', soundLevel: '-', powerSupply: '-', refrigerant: '-' }
        });
      }
    });

    setProducts(updatedProducts);
    
    // Recalculate Project Allocations
    setProjectItems(prev => prev.map(item => {
      let prod = updatedProducts.find(p => p.id === item.productId);
      return prod ? calculateItemAllocation(prod, item.requestedQty) : item;
    }));

    setActiveTab('inventory');
  };

  // ---------------------------------------------------------------------------
  // ALLOCATION ENGINE (Local -> Pipeline -> SAP Available)
  // ---------------------------------------------------------------------------
  const calculateItemAllocation = (product: Product, requestedQty: number): ProjectItem => {
    let remaining = requestedQty;
    let allocationNotes: string[] = [];
    
    let fromStock = 0;
    let fromPipeline = 0;
    let fromFactory = 0;
    
    // 1. Local Stock (Libya) - HIGHEST PRIORITY
    if (product.stockLocal >= remaining) {
      fromStock = remaining;
      allocationNotes.push("Immediate (Libya Stock)");
      remaining = 0;
    } else if (product.stockLocal > 0) {
      fromStock = product.stockLocal;
      allocationNotes.push(`${fromStock} Stock`);
      remaining -= product.stockLocal;
    }

    // 2. Pipeline (On Water/Air)
    if (remaining > 0 && product.pipeline.quantity > 0) {
      const takePipe = Math.min(remaining, product.pipeline.quantity);
      fromPipeline = takePipe;
      const typeLabel = product.pipeline.type === 'Air' ? '✈️' : '🚢';
      allocationNotes.push(`${takePipe} Pipeline (${typeLabel} ${product.pipeline.status})`);
      remaining -= takePipe;
    }

    // 3. SAP Available (Net of Reserved) - Month by Month
    if (remaining > 0 && product.factoryBooking.length > 0) {
      for (const bucket of product.factoryBooking) {
        if (remaining <= 0) break;
        if (bucket.available <= 0) continue; 

        const take = Math.min(remaining, bucket.available);
        fromFactory += take;
        allocationNotes.push(`${take} from ${bucket.month}`);
        remaining -= take;
      }
    }

    let deliveryDate = "";
    if (remaining > 0) {
       deliveryDate = `Shortage: ${remaining} Missing`;
    } else if (allocationNotes.length === 1 && fromStock > 0 && fromPipeline === 0 && fromFactory === 0) {
       deliveryDate = "Immediate Delivery";
    } else {
       deliveryDate = allocationNotes.join(' + ');
    }

    return {
      productId: product.id,
      requestedQty,
      allocatedFromStock: fromStock,
      allocatedFromPipeline: fromPipeline,
      allocatedFromFactory: fromFactory,
      deliveryDate
    };
  };

  const handleAddToProject = (product: Product, qty: number) => {
    setProjectItems(prev => {
      const idx = prev.findIndex(i => i.productId === product.id);
      if (idx >= 0) {
        const newArr = [...prev];
        const newQty = newArr[idx].requestedQty + qty;
        newArr[idx] = calculateItemAllocation(product, newQty);
        return newArr;
      }
      return [...prev, calculateItemAllocation(product, qty)];
    });
    setActiveTab('project');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard products={products} onNavigate={setActiveTab} />;
      case 'inventory': 
        return <InventoryView 
                 products={products} 
                 onAddToProject={handleAddToProject} 
                 exchangeRate={exchangeRate} 
                 setExchangeRate={setExchangeRate} 
               />;
      case 'project': 
        return <ProjectBuilder 
                 products={products} 
                 items={projectItems} 
                 clientName={clientName} 
                 setClientName={setClientName} 
                 projectName={projectName} 
                 setProjectName={setProjectName} 
                 onUpdateQty={(idx, qty) => {
                    const item = projectItems[idx];
                    const prod = products.find(p => p.id === item.productId);
                    if(prod) {
                       const newItem = calculateItemAllocation(prod, qty);
                       const newItems = [...projectItems];
                       newItems[idx] = newItem;
                       setProjectItems(newItems);
                    }
                 }}
                 onRemoveItem={(idx) => setProjectItems(prev => prev.filter((_, i) => i !== idx))}
                 exchangeRate={exchangeRate}
               />;
      case 'portal': return <MitsubishiPortal onSync={handleDataSync} currentProducts={products} />;
      default: return <Dashboard products={products} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 shadow-sm z-20">
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Mitsubishi Agent ERP - Libya</h1>
        </header>
        <div className="flex-1 p-4 md:p-6 overflow-hidden relative">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
