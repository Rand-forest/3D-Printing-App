import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  Printer,
  Package,
  Truck,
  Layers,
  Sliders,
  Copy,
  Check,
  ExternalLink,
  Printer as PrintIcon,
  AlertCircle,
  FileCode,
  ShieldCheck,
  MapPin,
  Calendar,
} from 'lucide-react';
import { OrderItem, OrderStatus } from '../types';
import { STLViewer3D } from './STLViewer3D';
import { createSampleModelGeometry, parseSTL } from '../utils/stlParser';
import * as THREE from 'three';

interface OrderTrackerProps {
  initialOrderNumber?: string;
}

const STAGES: { key: OrderStatus; label: string; desc: string }[] = [
  { key: 'PENDING_REVIEW', label: 'Order Confirmed', desc: 'Mesh verified & entered engineering review' },
  { key: 'SLICING_QUEUED', label: 'Toolpath Slicing', desc: 'G-code compiled for machine geometry' },
  { key: 'PRINTING', label: 'Printing Active', desc: 'Layers actively extruding in workshop' },
  { key: 'POST_PROCESSING', label: 'Post-Processing', desc: 'Support removal & surface cleaning' },
  { key: 'QUALITY_INSPECTION', label: 'Quality Inspection', desc: 'Caliper tolerance & optical checks' },
  { key: 'READY_FOR_DISPATCH', label: 'Packaged for Courier', desc: 'Protective foam boxing complete' },
  { key: 'DISPATCHED', label: 'In Transit', desc: 'Handed to courier with live tracking' },
  { key: 'DELIVERED', label: 'Delivered', desc: 'Safely arrived at destination' },
];

export const OrderTracker: React.FC<OrderTrackerProps> = ({ initialOrderNumber }) => {
  const [searchQuery, setSearchQuery] = useState<string>(initialOrderNumber || 'ORD-8419');
  const [order, setOrder] = useState<OrderItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState<boolean>(false);
  const [previewGeometry, setPreviewGeometry] = useState<THREE.BufferGeometry | null>(null);

  const fetchOrder = async (numberToSearch: string) => {
    if (!numberToSearch.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${numberToSearch.trim()}`);
      const data = await res.json();

      if (data.order) {
        setOrder(data.order);
      } else {
        setError(`No order found with reference "${numberToSearch}".`);
        setOrder(null);
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order. Please verify your order number.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderNumber) {
      setSearchQuery(initialOrderNumber);
      fetchOrder(initialOrderNumber);
    } else {
      fetchOrder('ORD-8419');
    }
  }, [initialOrderNumber]);

  // Load 3D geometry for preview
  useEffect(() => {
    if (!order) {
      setPreviewGeometry(null);
      return;
    }

    if (order.modelRawStlBase64) {
      try {
        const binaryStr = atob(order.modelRawStlBase64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const parsed = parseSTL(bytes.buffer, order.model.fileName);
        setPreviewGeometry(parsed.geometry);
        return;
      } catch (e) {
        console.error('Base64 parse error:', e);
      }
    }

    // Fallback sample
    const sample = createSampleModelGeometry(
      order.model.fileName.toLowerCase().includes('gear')
        ? 'GEAR'
        : order.model.fileName.toLowerCase().includes('vase')
        ? 'PLANTER'
        : 'BRACKET'
    );
    setPreviewGeometry(sample.geometry);
  }, [order]);

  const handleCopyTracking = (trackingNum: string) => {
    navigator.clipboard.writeText(trackingNum);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const getStageIndex = (status: OrderStatus) => {
    return STAGES.findIndex((s) => s.key === status);
  };

  const currentStageIndex = order ? getStageIndex(order.status) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header & Search Bar */}
      <div className="text-center max-w-xl mx-auto space-y-3">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Live 3D Print Order Tracking
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Enter your order reference code (e.g. <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">ORD-8419</span>) to follow real-time workshop slicing, production, and courier transit.
        </p>

        {/* Search input form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchOrder(searchQuery);
          }}
          className="flex items-center gap-2 max-w-md mx-auto pt-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="tracking-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter ORD-XXXX..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>
          <button
            type="submit"
            id="tracking-search-submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Searching...' : 'Track'}
          </button>
        </form>

        {/* Quick selection tags */}
        <div className="flex items-center justify-center gap-2 pt-1 text-xs">
          <span className="text-slate-400">Quick view:</span>
          {['ORD-8419', 'ORD-8392', 'ORD-8310'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => {
                setSearchQuery(num);
                fetchOrder(num);
              }}
              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:underline font-mono text-[11px]"
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs text-center flex items-center justify-center gap-2 max-w-md mx-auto">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {order && (
        <div className="space-y-6">
          {/* Main Status Header Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Order Reference:</span>
                  <span className="font-mono font-bold text-lg text-indigo-600 dark:text-indigo-400">
                    {order.orderNumber}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Ordered on {new Date(order.createdAt).toLocaleDateString()} for{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{order.customer.name}</strong>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  id="print-order-receipt-btn"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <PrintIcon className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
              </div>
            </div>

            {/* Visual Progress Stepper across all 8 stages */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Current Stage:{' '}
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {currentStageIndex + 1} of {STAGES.length} Completed
                </span>
              </div>

              {/* Stepper bar */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {STAGES.map((stg, idx) => {
                  const isCompleted = idx <= currentStageIndex;
                  const isCurrent = idx === currentStageIndex;

                  return (
                    <div key={stg.key} className="space-y-1.5">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isCurrent
                            ? 'bg-indigo-600 animate-pulse'
                            : isCompleted
                            ? 'bg-emerald-500'
                            : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      />
                      <div className="text-[10px] leading-tight">
                        <div
                          className={`font-semibold ${
                            isCurrent
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : isCompleted
                              ? 'text-slate-900 dark:text-slate-200'
                              : 'text-slate-400'
                          }`}
                        >
                          {stg.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Courier Delivery Details Card (Highlight if dispatched or ready) */}
            {order.delivery.trackingNumber && (
              <div className="p-4 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-800 dark:text-cyan-300">
                    <Truck className="w-4 h-4" />
                    <span>Courier Delivery in Progress</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Carrier: <strong className="text-slate-900 dark:text-white">{order.delivery.carrier}</strong> • Est. Arrival: <strong className="text-slate-900 dark:text-white">{order.delivery.estimatedDeliveryDate || '2-3 business days'}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-cyan-200 dark:border-cyan-800 shadow-xs">
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    {order.delivery.trackingNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyTracking(order.delivery.trackingNumber!)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
                    title="Copy tracking number"
                  >
                    {copiedTracking ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Dual Grid: Left 3D Review & Slicing Specs, Right Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: 3D Preview & Print Parameters (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-500" />
                    <span>Ordered 3D Part: {order.model.fileName}</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                    {order.model.volumeCm3} cm³
                  </span>
                </div>

                <STLViewer3D
                  geometry={previewGeometry}
                  stats={order.model}
                  colorHex={order.printConfig.colorHex}
                  materialName={order.printConfig.material}
                  heightClass="h-[300px]"
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-slate-500 block text-[11px]">Material</span>
                    <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                      {order.printConfig.material}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-slate-500 block text-[11px]">Color</span>
                    <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                      {order.printConfig.colorName}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-slate-500 block text-[11px]">Resolution</span>
                    <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                      {order.printConfig.layerQuality}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-slate-500 block text-[11px]">Infill</span>
                    <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                      {order.printConfig.infillPercent}% ({order.printConfig.infillPattern})
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-slate-500 block text-[11px]">Quantity</span>
                    <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                      {order.printConfig.quantity} units
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-slate-500 block text-[11px]">Total Paid</span>
                    <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                      ${order.quote.totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Real-time Status History & Automated Notifications (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span>Real-Time Status & Notification Log</span>
                </div>

                <div className="relative border-l-2 border-indigo-200 dark:border-indigo-900 ml-2 pl-4 space-y-5 text-xs">
                  {order.statusHistory.map((item, idx) => (
                    <div key={item.id} className="relative">
                      {/* Dot */}
                      <div
                        className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-slate-900 ${
                          idx === 0 ? 'bg-indigo-600 animate-ping' : 'bg-emerald-500'
                        }`}
                      />
                      <div
                        className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-slate-900 ${
                          idx === 0 ? 'bg-indigo-600' : 'bg-emerald-500'
                        }`}
                      />

                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                        {item.description}
                      </p>

                      {/* Dispatched Notification Card */}
                      {item.automatedNotificationSent && (
                        <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Client {item.automatedNotificationSent.channel} Dispatched</span>
                          </div>
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {item.automatedNotificationSent.subjectOrSummary}
                          </div>
                          <div className="text-slate-500 text-[10px]">
                            {item.automatedNotificationSent.content}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Destination Address Card */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-xs space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Delivery Destination</span>
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  <div className="font-medium">{order.customer.name}</div>
                  <div>{order.customer.streetAddress}</div>
                  <div>
                    {order.customer.city}, {order.customer.stateOrProvince} {order.customer.postalCode}
                  </div>
                  <div className="text-slate-500">{order.customer.country}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
