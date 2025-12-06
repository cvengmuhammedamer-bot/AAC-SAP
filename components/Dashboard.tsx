import React from 'react';
import { Product } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, AlertOctagon, PackageCheck, DollarSign, UploadCloud, Database } from 'lucide-react';

interface DashboardProps {
  products: Product[];
  onNavigate?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ products, onNavigate }) => {
  
  // --------------------------------------------------------------------------
  // EMPTY STATE (INITIAL SETUP)
  // --------------------------------------------------------------------------
  if (products.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
           <Database size={48} className="text-slate-400" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">System Database is Empty</h2>
        <p className="text-slate-500 max-w-md mb-8">
          Welcome to the Mitsubishi HVAC Manager. To begin, please import your latest stock and booking data from SAP "Documents".
        </p>
        <button 
          onClick={() => onNavigate && onNavigate('portal')}
          className="flex items-center gap-3 px-8 py-4 bg-red-600 text-white rounded-lg font-bold text-lg hover:bg-red-700 transition-colors shadow-lg hover:shadow-xl"
        >
          <UploadCloud size={24} />
          Go to Import Portal
        </button>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // NORMAL DASHBOARD
  // --------------------------------------------------------------------------
  
  // Calculations
  const totalStockValue = products.reduce((acc, p) => acc + (p.price * p.stockLocal), 0);
  const lowStockCount = products.filter(p => p.stockLocal < 5).length;
  const pipelineCount = products.reduce((acc, p) => acc + p.stockPipeline, 0);

  // Chart Data Preparation (Limit to top 10 items for readability)
  const stockVsPipelineData = products
    .slice(0, 15) // Just take first 15 to avoid clutter
    .map(p => ({
      name: p.model.split('-')[1] || p.model, // Shorten name
      Local: p.stockLocal,
      Pipeline: p.stockPipeline
    }));

  const categoryData = products.reduce((acc: any[], curr) => {
    const existing = acc.find(item => item.name === curr.category);
    if (existing) {
      existing.value += curr.stockLocal;
    } else {
      acc.push({ name: curr.category, value: curr.stockLocal });
    }
    return acc;
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex items-start justify-between">
      <div>
        <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        <p className="text-xs text-slate-400 mt-1">{sub}</p>
      </div>
      <div className={`p-3 rounded-full ${color} text-white`}>
        <Icon size={24} />
      </div>
    </div>
  );

  // Helper for Ship icon
  const Ship = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.9 5.8 2.8 8"/><path d="M17.5 10l-7.31-6a.6.6 0 0 0-.38 0l-7.31 6"/><path d="M10 2v2"/><path d="M14 2v2"/><path d="M4.1 9.9c.1 1.6 1.1 3 2.5 3.7"/></svg>
  );

  return (
    <div className="space-y-6 overflow-y-auto h-full pr-2 custom-scrollbar">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Inventory Value" 
          value={`${totalStockValue.toLocaleString()} LYD`} 
          sub="Local Warehouse" 
          icon={DollarSign} 
          color="bg-green-500" 
        />
        <StatCard 
          title="Low Stock Items" 
          value={lowStockCount} 
          sub="Restock needed immediately" 
          icon={AlertOctagon} 
          color="bg-red-500" 
        />
        <StatCard 
          title="In Pipeline" 
          value={pipelineCount} 
          sub="Units arriving < 30 days" 
          icon={Ship} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Items in Database" 
          value={products.length} 
          sub="Total SKU count" 
          icon={TrendingUp} 
          color="bg-purple-500" 
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
        
        {/* Stock Overview */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col">
          <h4 className="text-lg font-bold text-slate-800 mb-4">Stock vs Pipeline (Top Items)</h4>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockVsPipelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{fill: '#f1f5f9'}}
                />
                <Legend />
                <Bar dataKey="Local" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Pipeline" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col">
          <h4 className="text-lg font-bold text-slate-800 mb-4">Inventory Distribution</h4>
          <div className="flex-1 min-h-0">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
