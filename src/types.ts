export type PrintTechnology = 'FDM' | 'SLA_RESIN' | 'SLS_NYLON';

export type MaterialType =
  | 'PLA_PLUS'
  | 'PETG_CF'
  | 'ABS_PRO'
  | 'TPU_FLEX'
  | 'TOUGH_RESIN'
  | 'NYLON_PA12';

export interface MaterialOption {
  id: MaterialType;
  name: string;
  technology: PrintTechnology;
  densityGramsPerCm3: number;
  costPerGram: number;
  description: string;
  colors: { name: string; hex: string }[];
  heatResistance: string;
  tensileStrength: string;
}

export type LayerQuality = 'ULTRA_FINE' | 'FINE' | 'STANDARD' | 'DRAFT';

export interface LayerQualityOption {
  id: LayerQuality;
  label: string;
  heightMm: number;
  speedMultiplier: number;
  costMultiplier: number;
  description: string;
}

export type OrderStatus =
  | 'PENDING_REVIEW'
  | 'SLICING_QUEUED'
  | 'PRINTING'
  | 'POST_PROCESSING'
  | 'QUALITY_INSPECTION'
  | 'READY_FOR_DISPATCH'
  | 'DISPATCHED'
  | 'DELIVERED';

export type DeliveryMethod =
  | 'EXPRESS_COURIER'
  | 'STANDARD_TRACKED'
  | 'WORKSHOP_PICKUP'
  | 'SAME_DAY_LOCAL';

export interface ModelStats {
  fileName: string;
  fileSizeBytes: number;
  dimensionsMm: {
    x: number;
    y: number;
    z: number;
  };
  volumeCm3: number;
  surfaceAreaCm2: number;
  triangleCount: number;
  estimatedPrintTimeHours: number;
  estimatedGrams: number;
}

export interface PrintConfig {
  technology: PrintTechnology;
  material: MaterialType;
  colorName: string;
  colorHex: string;
  infillPercent: number;
  infillPattern: 'Gyroid' | 'Grid' | 'Honeycomb';
  layerQuality: LayerQuality;
  quantity: number;
  supportsRequired: boolean;
  notes?: string;
}

export interface QuoteBreakdown {
  materialCost: number;
  machineTimeCost: number;
  setupFee: number;
  postProcessingFee: number;
  quantitySubtotal: number;
  shippingCost: number;
  totalPrice: number;
}

export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  company?: string;
  streetAddress: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;
  deliveryMethod: DeliveryMethod;
}

export interface DeliveryDetails {
  method: DeliveryMethod;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  dispatchedAt?: string;
  estimatedDeliveryDate?: string;
  shippingLabelId?: string;
  recipientSignatureRequired?: boolean;
}

export interface StatusLogEntry {
  id: string;
  timestamp: string;
  stage: OrderStatus;
  title: string;
  description: string;
  updatedBy: 'System' | 'Operator' | 'Carrier';
  automatedNotificationSent?: {
    channel: 'EMAIL' | 'SMS';
    recipient: string;
    subjectOrSummary: string;
    content: string;
  };
}

export interface OrderItem {
  id: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  model: ModelStats;
  modelRawStlBase64?: string; // stored for operator STL download
  printConfig: PrintConfig;
  quote: QuoteBreakdown;
  customer: CustomerDetails;
  delivery: DeliveryDetails;
  assignedPrinterId?: string;
  statusHistory: StatusLogEntry[];
  operatorNotes?: string;
  internalPriority: 'Normal' | 'Urgent' | 'Rush';
}

export interface PrinterDevice {
  id: string;
  name: string;
  modelName: string;
  technology: PrintTechnology;
  status: 'IDLE' | 'PRINTING' | 'MAINTENANCE' | 'OFFLINE';
  buildVolumeMm: { x: number; y: number; z: number };
  activeOrderId?: string;
  currentProgressPercent?: number;
  nozzleTempC?: number;
  targetNozzleTempC?: number;
  bedTempC?: number;
  targetBedTempC?: number;
  remainingTimeMinutes?: number;
}

export interface WorkshopStats {
  activeJobsCount: number;
  queueDepth: number;
  totalCompletedOrders: number;
  totalRevenue: number;
  utilizationRatePercent: number;
  filamentsGramsUsedThisMonth: number;
}
