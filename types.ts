export enum ProductCategory {
  VRF_INDOOR = 'VRF Indoor',
  VRF_OUTDOOR = 'VRF Outdoor',
  DX_SPLIT = 'DX Split',
  DX_PACKAGED = 'DX Packaged',
  CONTROLLER = 'Controller'
}

export interface PipelineDetails {
  quantity: number;
  type: 'Sea' | 'Air' | 'Truck';
  status: 'In Production' | 'Shipped' | 'Customs' | 'Arrived';
  eta?: string;
}

export interface FactoryAvailability {
  month: string;
  available: number; // Unrestricted / Free to sell
  reserved: number;  // Booked / Sales Orders
}

export interface TechnicalSpecs {
  dimensions: string; // H x W x D mm
  weight: string; // kg
  soundLevel: string; // dB(A)
  powerSupply: string; // V/Ph/Hz
  refrigerant: string; // R410A / R32
}

export interface Product {
  id: string;
  model: string; 
  description: string;
  category: ProductCategory;
  
  // Pricing
  priceEUR: number; // Base price in Euro
  
  // Inventory Levels (Libya)
  stockLocal: number; 
  
  // Pipeline (On Order)
  pipeline: PipelineDetails;
  
  // Factory (Mitsubishi SAP)
  factoryBooking: FactoryAvailability[]; 
  sapBookingMonth?: string; // General SAP label if months aren't specific
  
  specs: TechnicalSpecs;
  capacityKW: number;
}

export interface ProjectItem {
  productId: string;
  requestedQty: number;
  allocatedFromStock: number;
  allocatedFromPipeline: number;
  allocatedFromFactory: number;
  deliveryDate: string;
}

export interface Project {
  id: string;
  clientName: string;
  projectName: string;
  status: 'Draft' | 'Quoted' | 'Ordered';
  items: ProjectItem[];
  totalValue: number;
  createdAt: string;
}