import React, { useState, useEffect } from 'react';
import {
  Layers,
  Printer,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Download,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Send,
  AlertCircle,
  FileText,
  Sliders,
  Play,
  Pause,
  Thermometer,
  Eye,
  X,
  Sparkles,
} from 'lucide-react';
import {
  OrderItem,
  OrderStatus,
  PrinterDevice,
  WorkshopStats,
  DeliveryMethod,
} from '../types';
import { STLViewer3D } from './STLViewer3D';
import { parseSTL, createSampleModelGeometry } from '../utils/stlParser';
import * as THREE from 'three';

interface OperatorHubProps {
  onNavigateToTracking: (orderNumber: string) => void;
}

export const OperatorHub: React.FC<OperatorHubProps> = ({ onNavigateToTracking }) => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [stats, setStats] = useState<WorkshopStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('ALL');

  // Selected Order for detail inspection / management drawer
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [previewGeometry, setPreviewGeometry] = useState<THREE.BufferGeometry | null>(null);

  // Modals
  const [dispatchModalOpen, setDispatchModalOpen] = useState<boolean>(false);
  const [shippingLabelModalOpen, setShippingLabelModalOpen] = useState<boolean>(false);
  const [messageModalOpen, setMessageModalOpen] = useState<boolean>(false);

  // Dispatch Form State
  const [dispatchCarrier, setDispatchCarrier] = useState<string>('DHL Express Priority');
  const [customTracking, setCustomTracking] = useState<string>('');
  const [estimatedArrival, setEstimatedArrival] = useState<string>('');
  const [dispatchNotes, setDispatchNotes] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  // Operator manual notification message
  const [clientMessage, setClientMessage] = useState<string>('');
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);

  // Fetch orders, printers, and stats
  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersRes, printersRes, statsRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/printers'),
        fetch('/api/stats'),
      ]);

      const ordersData = await ordersRes.json();
      const printersData = await printersRes.json();
      const statsData = await statsRes.json();

      setOrders(ordersData.orders || []);
      setPrinters(printersData.printers || []);
      setStats(statsData || null);

      // Keep selected order in sync if currently viewing one
      if (selectedOrder) {
        const updated = (ordersData.orders || []).find((o: OrderItem) => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err) {
      console.error('Error fetching workshop data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // 15s poll
    return () => clearInterval(interval);
  }, []);

  // When selected order changes, generate or load its 3D preview
  useEffect(() => {
    if (!selectedOrder) {
      setPreviewGeometry(null);
      return;
    }

    // If we have base64 raw STL, parse it
    if (selectedOrder.modelRawStlBase64) {
      try {
        const binaryStr = atob(selectedOrder.modelRawStlBase64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const parsed = parseSTL(bytes.buffer, selectedOrder.model.fileName);
        setPreviewGeometry(parsed.geometry);
        return;
      } catch (e) {
        console.error('Failed to parse base64 STL:', e);
      }
    }

    // Fallback: create corresponding sample geometry for preview
    const sample = createSampleModelGeometry(
      selectedOrder.model.fileName.toLowerCase().includes('gear')
        ? 'GEAR'
        : selectedOrder.model.fileName.toLowerCase().includes('vase')
        ? 'PLANTER'
        : 'BRACKET'
    );
    setPreviewGeometry(sample.geometry);
  }, [selectedOrder]);

  // Update order status
  const handleUpdateStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    operatorNotes?: string,
    assignedPrinterId?: string
  ) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          operatorNotes,
          assignedPrinterId,
          sendClientNotification: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setSelectedOrder(data.order);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Error updating order stage');
    }
  };

  // Dispatch order with courier
  const handleConfirmDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setIsDispatching(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier: dispatchCarrier,
          trackingNumber: customTracking || undefined,
          estimatedDeliveryDate: estimatedArrival || undefined,
          notes: dispatchNotes || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setSelectedOrder(data.order);
        setDispatchModalOpen(false);
        setCustomTracking('');
        setDispatchNotes('');
        fetchData();
      }
    } catch (err) {
      console.error('Dispatch error:', err);
      alert('Failed to arrange courier delivery');
    } finally {
      setIsDispatching(false);
    }
  };

  // Download raw STL file for slicing
  const handleDownloadStl = (order: OrderItem) => {
    if (order.modelRawStlBase64) {
      const link = document.createElement('a');
      link.href = `data:application/octet-stream;base64,${order.modelRawStlBase64}`;
      link.download = order.model.fileName;
      link.click();
    } else {
      // Create and download generated binary STL
      const sample = createSampleModelGeometry('GEAR');
      if (sample.rawArrayBuffer) {
        const blob = new Blob([sample.rawArrayBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = order.model.fileName;
        link.click();
      }
    }
  };

  // Send custom operator notification to client
  const handleSendClientMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !clientMessage.trim()) return;

    setIsSendingMessage(true);
    try {
      // Append as status note log with notification
      await handleUpdateStatus(
        selectedOrder.id,
        selectedOrder.status,
        `Operator Message: ${clientMessage}`
      );
      setClientMessage('');
      setMessageModalOpen(false);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesTab =
      selectedStatusTab === 'ALL' || order.status === selectedStatusTab;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      order.orderNumber.toLowerCase().includes(q) ||
      order.customer.name.toLowerCase().includes(q) ||
      order.customer.email.toLowerCase().includes(q) ||
      order.model.fileName.toLowerCase().includes(q) ||
      (order.delivery.trackingNumber &&
        order.delivery.trackingNumber.toLowerCase().includes(q));

    return matchesTab && matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" /> Review & Slicing
          </span>
        );
      case 'SLICING_QUEUED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1 w-fit">
            <Layers className="w-3 h-3" /> Queued for Bed
          </span>
        );
      case 'PRINTING':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1 w-fit animate-pulse">
            <Printer className="w-3 h-3" /> Printing Active
          </span>
        );
      case 'POST_PROCESSING':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800 flex items-center gap-1 w-fit">
            <Sliders className="w-3 h-3" /> Post-Processing
          </span>
        );
      case 'QUALITY_INSPECTION':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3" /> QC Inspection
          </span>
        );
      case 'READY_FOR_DISPATCH':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1 w-fit">
            <Package className="w-3 h-3" /> Ready for Dispatch
          </span>
        );
      case 'DISPATCHED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-100 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 flex items-center gap-1 w-fit">
            <Truck className="w-3 h-3" /> In Transit
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3" /> Fulfilled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header & Live Workshop Metrics */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs tracking-wider uppercase">
              <Printer className="w-4 h-4" /> Workshop Management & Fulfillment Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
              Print Farm Production Queue
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage live 3D printers, process STL incoming jobs, arrange courier deliveries, and broadcast client status updates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="refresh-workshop-btn"
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Active Production Jobs</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                {stats.activeJobsCount}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Review & Slicing Queue</div>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {stats.queueDepth}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Currently on Bed</div>
              <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                {stats.activeJobsCount - stats.queueDepth}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Farm Hardware Load</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.utilizationRatePercent}%
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 md:col-span-1">
              <div className="text-xs text-slate-500 font-medium">Order Revenue (Gross)</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                ${stats.totalRevenue.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live 3D Printers Fleet Status */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Active Workshop Print Farm (Hardware Fleet)</span>
          </div>
          <span className="text-xs text-slate-500">4 Machines Monitored</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {printers.map((printer) => (
            <div
              key={printer.id}
              className={`p-4 rounded-xl border text-xs space-y-3 transition ${
                printer.status === 'PRINTING'
                  ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">{printer.name}</div>
                  <div className="text-[11px] text-slate-500">{printer.modelName}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    printer.status === 'PRINTING'
                      ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {printer.status}
                </span>
              </div>

              {printer.status === 'PRINTING' ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span>Job: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{printer.activeOrderId}</strong></span>
                    <span>{printer.currentProgressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all"
                      style={{ width: `${printer.currentProgressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-rose-500" />
                      Nozzle: {printer.nozzleTempC}°C
                    </span>
                    <span>Bed: {printer.bedTempC}°C</span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 py-2">
                  Bed cleared & ready for next G-code assignment.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Orders Management Table & Filter Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Table Top Controls */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="search-orders-input"
                placeholder="Search order #, customer, STL filename, or tracking..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="text-xs text-slate-500">
              Showing <strong className="text-slate-900 dark:text-white font-mono">{filteredOrders.length}</strong> orders
            </div>
          </div>

          {/* Stage Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'ALL', label: 'All Orders' },
              { id: 'PENDING_REVIEW', label: 'Pending Review' },
              { id: 'SLICING_QUEUED', label: 'Slicing / Queued' },
              { id: 'PRINTING', label: 'Printing' },
              { id: 'POST_PROCESSING', label: 'Post-Process' },
              { id: 'QUALITY_INSPECTION', label: 'QC' },
              { id: 'READY_FOR_DISPATCH', label: 'Ready for Courier' },
              { id: 'DISPATCHED', label: 'Dispatched' },
              { id: 'DELIVERED', label: 'Delivered' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedStatusTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition ${
                  selectedStatusTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Order ID & Date</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">STL File & Specs</th>
                <th className="py-3.5 px-4">Status Pipeline</th>
                <th className="py-3.5 px-4">Delivery & Courier</th>
                <th className="py-3.5 px-4 text-right">Total</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No orders matching your search or stage filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition ${
                      selectedOrder?.id === order.id
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                        : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {order.orderNumber}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {order.customer.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                        {order.customer.email}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span>{order.model.fileName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {order.printConfig.material} • {order.printConfig.colorName} • Qty {order.printConfig.quantity}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(order.status)}</td>

                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 dark:text-slate-200">
                        {order.delivery.carrier || order.customer.deliveryMethod.replace('_', ' ')}
                      </div>
                      {order.delivery.trackingNumber ? (
                        <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                          {order.delivery.trackingNumber}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">Pending Courier</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white text-right">
                      ${order.quote.totalPrice.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Inspect Order"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 overflow-y-auto flex flex-col">
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-lg text-indigo-600 dark:text-indigo-400">
                  {selectedOrder.orderNumber}
                </span>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Placed {new Date(selectedOrder.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="drawer-download-stl-btn"
                onClick={() => handleDownloadStl(selectedOrder)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 transition"
                title="Download STL for slicer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .STL</span>
              </button>

              <button
                type="button"
                id="drawer-close-btn"
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="p-6 space-y-6 flex-1 text-xs">
            {/* 3D Geometry Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  3D Model Inspection: {selectedOrder.model.fileName}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {selectedOrder.model.dimensionsMm.x}×{selectedOrder.model.dimensionsMm.y}×{selectedOrder.model.dimensionsMm.z} mm
                </span>
              </div>

              <STLViewer3D
                geometry={previewGeometry}
                stats={selectedOrder.model}
                colorHex={selectedOrder.printConfig.colorHex}
                materialName={selectedOrder.printConfig.material}
                heightClass="h-[280px]"
              />
            </div>

            {/* Quick Pipeline Transition Bar */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Production Pipeline Action</span>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-normal">
                  Automatically sends client updates
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  id="op-move-slicing"
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'SLICING_QUEUED')}
                  className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium hover:border-indigo-500 transition text-center"
                >
                  Move to Slicing
                </button>

                <button
                  type="button"
                  id="op-move-printing"
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'PRINTING', undefined, 'PRN-01')}
                  className="p-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition text-center"
                >
                  Start Printing
                </button>

                <button
                  type="button"
                  id="op-move-post"
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'POST_PROCESSING')}
                  className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium hover:border-indigo-500 transition text-center"
                >
                  Post-Processing
                </button>

                <button
                  type="button"
                  id="op-move-qc"
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'QUALITY_INSPECTION')}
                  className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium hover:border-indigo-500 transition text-center"
                >
                  Pass QC
                </button>
              </div>

              {/* Delivery Action Buttons */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <button
                  type="button"
                  id="arrange-courier-btn"
                  onClick={() => setDispatchModalOpen(true)}
                  className="flex-1 py-2.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <Truck className="w-4 h-4" />
                  <span>
                    {selectedOrder.status === 'DISPATCHED' ? 'Edit Courier Tracking' : 'Arrange Courier & Dispatch'}
                  </span>
                </button>

                <button
                  type="button"
                  id="mark-delivered-btn"
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'DELIVERED')}
                  className="py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 shadow-sm transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Delivered</span>
                </button>
              </div>
            </div>

            {/* Print Configuration Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1">
                  Slicing Parameters
                </div>
                <div>Material: <strong>{selectedOrder.printConfig.material}</strong></div>
                <div>Color: <strong>{selectedOrder.printConfig.colorName}</strong></div>
                <div>Layer Height: <strong>{selectedOrder.printConfig.layerQuality}</strong></div>
                <div>Infill: <strong>{selectedOrder.printConfig.infillPercent}% ({selectedOrder.printConfig.infillPattern})</strong></div>
                <div>Quantity: <strong>{selectedOrder.printConfig.quantity} units</strong></div>
                {selectedOrder.printConfig.notes && (
                  <div className="text-amber-600 dark:text-amber-400 mt-1">
                    Client Note: {selectedOrder.printConfig.notes}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1">
                  Recipient & Fulfillment
                </div>
                <div>Client: <strong>{selectedOrder.customer.name}</strong></div>
                <div>Email: <strong className="font-mono">{selectedOrder.customer.email}</strong></div>
                <div>Phone: <strong>{selectedOrder.customer.phone}</strong></div>
                <div>Address: {selectedOrder.customer.streetAddress}, {selectedOrder.customer.city}</div>
                <div>
                  Courier: <strong>{selectedOrder.delivery.carrier || 'Not assigned yet'}</strong>
                </div>
                {selectedOrder.delivery.trackingNumber && (
                  <div className="text-cyan-600 dark:text-cyan-400 font-mono font-bold">
                    Tracking: {selectedOrder.delivery.trackingNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Automated Status Updates & Communication Stream */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-indigo-500" />
                  <span>Automated Client Communication & History</span>
                </div>
                <button
                  type="button"
                  id="open-message-client-modal"
                  onClick={() => setMessageModalOpen(true)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  + Send Custom Message
                </button>
              </div>

              <div className="space-y-3 border-l-2 border-indigo-200 dark:border-indigo-900/60 ml-2 pl-4">
                {selectedOrder.statusHistory.map((entry) => (
                  <div key={entry.id} className="relative space-y-1">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-slate-900" />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {entry.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">{entry.description}</p>

                    {/* Automated Notification Card Preview */}
                    {entry.automatedNotificationSent && (
                      <div className="mt-2 p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-[11px]">
                        <div className="flex items-center gap-1 text-indigo-700 dark:text-indigo-400 font-semibold mb-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Dispatched Automated {entry.automatedNotificationSent.channel}</span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          Subject: {entry.automatedNotificationSent.subjectOrSummary}
                        </div>
                        <div className="text-slate-500 text-[10px] line-clamp-2 mt-0.5">
                          "{entry.automatedNotificationSent.content}"
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Courier Arrangement Modal */}
      {dispatchModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Arrange Delivery & Courier Dispatch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDispatch} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Selected Courier Service
                </label>
                <select
                  value={dispatchCarrier}
                  onChange={(e) => setDispatchCarrier(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="DHL Express Priority">DHL Express Priority</option>
                  <option value="FedEx Priority Overnight">FedEx Priority Overnight</option>
                  <option value="UPS Ground Tracked">UPS Ground Tracked</option>
                  <option value="DPD European Courier">DPD European Courier</option>
                  <option value="City Rapid Courier (Same Day)">City Rapid Courier (Same Day)</option>
                  <option value="Workshop Front Desk (Hold for Pickup)">Workshop Front Desk (Hold for Pickup)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tracking Number (Leave blank to auto-generate)
                </label>
                <input
                  type="text"
                  placeholder="e.g. DHL-84920194 or leave blank"
                  value={customTracking}
                  onChange={(e) => setCustomTracking(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Estimated Delivery Date
                </label>
                <input
                  type="date"
                  value={estimatedArrival}
                  onChange={(e) => setEstimatedArrival(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Driver / Dispatch Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Fragile custom additive parts, handle with care."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Confirming dispatch will automatically update the order status to <strong>DISPATCHED</strong> and send an automated tracking notification email to <strong>{selectedOrder.customer.email}</strong>.
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDispatchModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="confirm-dispatch-btn"
                  disabled={isDispatching}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow-md transition disabled:opacity-50"
                >
                  <span>{isDispatching ? 'Scheduling...' : 'Confirm & Notify Client'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Operator Custom Message Modal */}
      {messageModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-500" /> Send Update to {selectedOrder.customer.name}
              </h3>
              <button
                type="button"
                onClick={() => setMessageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendClientMessage} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Message / Technician Note
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g., Your model passed first-layer inspection cleanly. Slicing with 0.16mm fine layer resolution for optimal surface fidelity."
                  value={clientMessage}
                  onChange={(e) => setClientMessage(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMessageModalOpen(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingMessage}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50"
                >
                  Send Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
