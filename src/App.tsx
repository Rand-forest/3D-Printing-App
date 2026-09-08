import React, { useState, useEffect } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { CustomerPortal } from './components/CustomerPortal';
import { OperatorHub } from './components/OperatorHub';
import { OrderTracker } from './components/OrderTracker';
import { OrderItem } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('CUSTOMER');
  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(3);
  const [selectedTrackingOrderNumber, setSelectedTrackingOrderNumber] = useState<string>('ORD-8419');

  // Fetch count of active production jobs
  const refreshActiveOrdersCount = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setActiveOrdersCount(data.activeJobsCount || 0);
      }
    } catch (e) {
      console.warn('Could not fetch active jobs count', e);
    }
  };

  useEffect(() => {
    refreshActiveOrdersCount();
    const timer = setInterval(refreshActiveOrdersCount, 20000);
    return () => clearInterval(timer);
  }, []);

  const handleOrderPlaced = (order: OrderItem) => {
    setSelectedTrackingOrderNumber(order.orderNumber);
    refreshActiveOrdersCount();
  };

  const handleNavigateToTracking = (orderNumber: string) => {
    setSelectedTrackingOrderNumber(orderNumber);
    setActiveTab('TRACKER');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeOrdersCount={activeOrdersCount}
      />

      <main className="flex-1">
        {activeTab === 'CUSTOMER' && (
          <CustomerPortal
            onOrderPlaced={handleOrderPlaced}
            onNavigateToTracking={handleNavigateToTracking}
          />
        )}

        {activeTab === 'OPERATOR' && (
          <OperatorHub onNavigateToTracking={handleNavigateToTracking} />
        )}

        {activeTab === 'TRACKER' && (
          <OrderTracker initialOrderNumber={selectedTrackingOrderNumber} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            PrintLab 3D Hub • End-to-End Additive Manufacturing Slicing & Fulfillment
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Precision FDM & SLA</span>
            <span>•</span>
            <span>Automated Slicing & Quoting</span>
            <span>•</span>
            <span>Integrated Courier Dispatch</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
