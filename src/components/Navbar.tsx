import React from 'react';
import { Box, Layers, Printer, Search, ShieldCheck, Cpu } from 'lucide-react';

export type ActiveTab = 'CUSTOMER' | 'OPERATOR' | 'TRACKER';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  activeOrdersCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  activeOrdersCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab('CUSTOMER')}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 group-hover:scale-105 transition">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>PrintLab</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800">
                Hub
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Additive Manufacturing & Fulfillment
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <button
            type="button"
            id="nav-customer-tab"
            onClick={() => onSelectTab('CUSTOMER')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer ${
              activeTab === 'CUSTOMER'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Customer Drop & Quote</span>
          </button>

          <button
            type="button"
            id="nav-operator-tab"
            onClick={() => onSelectTab('OPERATOR')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer relative ${
              activeTab === 'OPERATOR'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Workshop & Fulfillment</span>
            {activeOrdersCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-600 text-white font-bold">
                {activeOrdersCount}
              </span>
            )}
          </button>

          <button
            type="button"
            id="nav-tracker-tab"
            onClick={() => onSelectTab('TRACKER')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer ${
              activeTab === 'TRACKER'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Track Order</span>
          </button>
        </nav>

        {/* Live Service Status Indicator */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Farm API Online</span>
        </div>
      </div>
    </header>
  );
};
