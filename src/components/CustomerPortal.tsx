import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileCode,
  Sparkles,
  ShieldCheck,
  Truck,
  CheckCircle2,
  Clock,
  Box,
  Layers,
  Palette,
  AlertTriangle,
  ArrowRight,
  Info,
  DollarSign,
  Package,
} from 'lucide-react';
import * as THREE from 'three';
import { STLViewer3D } from './STLViewer3D';
import { parseSTL, createSampleModelGeometry, ParsedSTL } from '../utils/stlParser';
import { MATERIALS, LAYER_QUALITIES, DELIVERY_OPTIONS } from '../utils/constants';
import {
  ModelStats,
  PrintConfig,
  QuoteBreakdown,
  CustomerDetails,
  MaterialType,
  LayerQuality,
  DeliveryMethod,
  OrderItem,
} from '../types';

interface CustomerPortalProps {
  onOrderPlaced: (order: OrderItem) => void;
  onNavigateToTracking: (orderNumber: string) => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  onOrderPlaced,
  onNavigateToTracking,
}) => {
  // 3D Model state
  const [currentGeometry, setCurrentGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [rawStlBase64, setRawStlBase64] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [wireframe, setWireframe] = useState<boolean>(false);

  // Print Configuration
  const [printConfig, setPrintConfig] = useState<PrintConfig>({
    technology: 'FDM',
    material: 'PLA_PLUS',
    colorName: 'Matte Obsidian Black',
    colorHex: '#1e2022',
    infillPercent: 20,
    infillPattern: 'Gyroid',
    layerQuality: 'STANDARD',
    quantity: 1,
    supportsRequired: true,
    notes: '',
  });

  // Customer Form
  const [customer, setCustomer] = useState<CustomerDetails>({
    name: 'Sarah Chen',
    email: 'sarah.chen@innovate3d.org',
    phone: '+1 (555) 438-9921',
    company: 'ProtoLab Studio',
    streetAddress: '450 Tech Hub Parkway, Suite 12',
    city: 'Seattle',
    stateOrProvince: 'WA',
    postalCode: '98101',
    country: 'United States',
    deliveryMethod: 'STANDARD_TRACKED',
  });

  // Quote & Pricing
  const [quote, setQuote] = useState<QuoteBreakdown>({
    materialCost: 0,
    machineTimeCost: 0,
    setupFee: 5.0,
    postProcessingFee: 3.0,
    quantitySubtotal: 0,
    shippingCost: 8.5,
    totalPrice: 0,
  });

  // AI DFM state
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiSource, setAiSource] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedOrder, setSubmittedOrder] = useState<OrderItem | null>(null);

  // Initialize with a default sample model so the user sees something immediately!
  useEffect(() => {
    loadSample('GEAR');
  }, []);

  const loadSample = (sampleType: 'GEAR' | 'PLANTER' | 'BRACKET') => {
    setIsParsing(true);
    setParseError(null);
    try {
      const sample = createSampleModelGeometry(sampleType);
      setCurrentGeometry(sample.geometry);
      setModelStats(sample.stats);

      // Convert ArrayBuffer to base64 for submission
      if (sample.rawArrayBuffer) {
        const bytes = new Uint8Array(sample.rawArrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        setRawStlBase64(btoa(binary));
      }
    } catch (err: any) {
      setParseError(err?.message || 'Failed to load sample model');
    } finally {
      setIsParsing(false);
    }
  };

  // Handle STL file upload / drop
  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.stl')) {
      setParseError('Please upload a valid .stl 3D file format.');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setAiAnalysis(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const parsed = parseSTL(buffer, file.name);
        setCurrentGeometry(parsed.geometry);
        setModelStats(parsed.stats);

        // Store base64 for backend upload
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        setRawStlBase64(btoa(binary));
      } catch (err: any) {
        console.error('STL Parse error:', err);
        setParseError('Failed to parse STL file. Please check that it is a valid binary or ASCII STL.');
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      setParseError('Error reading file.');
      setIsParsing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Recalculate pricing dynamically whenever model or config changes
  useEffect(() => {
    if (!modelStats) return;

    const selectedMat = MATERIALS.find((m) => m.id === printConfig.material) || MATERIALS[0];
    const selectedQuality = LAYER_QUALITIES.find((q) => q.id === printConfig.layerQuality) || LAYER_QUALITIES[2];
    const selectedDelivery = DELIVERY_OPTIONS.find((d) => d.id === customer.deliveryMethod) || DELIVERY_OPTIONS[0];

    // Infill factor: 20% infill ~ 0.6 effective volume, 100% infill ~ 1.0 effective volume
    const infillFactor = 0.45 + (printConfig.infillPercent / 100) * 0.55;
    const materialGrams = modelStats.volumeCm3 * selectedMat.densityGramsPerCm3 * infillFactor;
    const materialCost = Math.round(materialGrams * selectedMat.costPerGram * 100) / 100;

    // Machine time cost: $3.50/hour base
    const baseTimeHours = modelStats.estimatedPrintTimeHours * selectedQuality.speedMultiplier;
    const machineTimeCost = Math.round(baseTimeHours * 3.8 * selectedQuality.costMultiplier * 100) / 100;

    const setupFee = selectedMat.technology === 'SLA_RESIN' ? 8.0 : 5.0;
    const postProcessingFee = printConfig.supportsRequired ? 4.5 : 2.0;

    const singlePartPrice = materialCost + machineTimeCost + setupFee + postProcessingFee;
    const quantitySubtotal = Math.round(singlePartPrice * printConfig.quantity * 100) / 100;
    const shippingCost = selectedDelivery.price;
    const totalPrice = Math.round((quantitySubtotal + shippingCost) * 100) / 100;

    setQuote({
      materialCost,
      machineTimeCost,
      setupFee,
      postProcessingFee,
      quantitySubtotal,
      shippingCost,
      totalPrice,
    });
  }, [modelStats, printConfig, customer.deliveryMethod]);

  // Request AI DFM Printability Analysis
  const runAiDfmAnalysis = async () => {
    if (!modelStats) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensionsMm: modelStats.dimensionsMm,
          volumeCm3: modelStats.volumeCm3,
          material: printConfig.material,
          technology: printConfig.technology,
          layerQuality: printConfig.layerQuality,
          infillPercent: printConfig.infillPercent,
        }),
      });
      const data = await res.json();
      setAiAnalysis(data.analysis);
      setAiSource(data.source || 'AI Slicing Advisor');
    } catch (err) {
      console.error('AI analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelStats) {
      setParseError('Please upload an STL model first.');
      return;
    }

    if (!customer.name || !customer.email || !customer.streetAddress || !customer.city) {
      alert('Please fill in your name, email, and shipping address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelStats,
          modelRawStlBase64: rawStlBase64,
          printConfig,
          quote,
          customer,
          delivery: {
            method: customer.deliveryMethod,
          },
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setSubmittedOrder(data.order);
        onOrderPlaced(data.order);
      } else {
        alert(data.error || 'Failed to submit order');
      }
    } catch (err: any) {
      console.error('Submit order error:', err);
      alert('Network error while placing order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentMaterial = MATERIALS.find((m) => m.id === printConfig.material) || MATERIALS[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm tracking-wide uppercase">
            <Box className="w-4 h-4" /> Instant Slicing & Additive Manufacturing
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
            Order Custom 3D Prints
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 max-w-2xl">
            Drop your raw <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 font-mono text-xs">.stl</code> file
            for automated volume calculation, instant quoting, and end-to-end workshop fulfillment.
          </p>
        </div>

        {/* Preset sample loader buttons */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-500 font-medium px-2">Load Demo STL:</span>
          <button
            type="button"
            id="load-sample-gear"
            onClick={() => loadSample('GEAR')}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium shadow-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition"
          >
            Drive Gear
          </button>
          <button
            type="button"
            id="load-sample-vase"
            onClick={() => loadSample('PLANTER')}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium shadow-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition"
          >
            Vase Planter
          </button>
          <button
            type="button"
            id="load-sample-bracket"
            onClick={() => loadSample('BRACKET')}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium shadow-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition"
          >
            Drone Mount
          </button>
        </div>
      </div>

      {/* Main Grid: Left is 3D Viewer & Upload; Right is Configurator & Quote */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: 3D Viewport & Upload Box (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* File Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="relative border-2 border-dashed border-indigo-300 dark:border-indigo-900/60 hover:border-indigo-500 bg-indigo-50/40 dark:bg-slate-900/40 rounded-2xl p-6 text-center transition group"
          >
            <input
              type="file"
              id="stl-file-input"
              accept=".stl"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                Drop your .STL file here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse files</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports binary & ASCII STL up to 50MB • Real-time geometry analysis
              </p>
            </div>
          </div>

          {parseError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* 3D WebGL Canvas */}
          <div className="relative">
            {isParsing && (
              <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center rounded-xl text-white">
                <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 shadow-xl">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-medium">Computing 3D Mesh Geometry...</span>
                </div>
              </div>
            )}

            <STLViewer3D
              geometry={currentGeometry}
              stats={modelStats}
              colorHex={printConfig.colorHex}
              wireframe={wireframe}
              onWireframeChange={setWireframe}
              materialName={currentMaterial.name}
              heightClass="h-[460px]"
            />
          </div>

          {/* Geometry Statistics Card */}
          {modelStats && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white text-sm">
                  <FileCode className="w-4 h-4 text-indigo-500" />
                  <span>{modelStats.fileName}</span>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {(modelStats.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                  <div className="text-xs text-slate-500">Dimensions</div>
                  <div className="text-sm font-semibold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                    {modelStats.dimensionsMm.x}×{modelStats.dimensionsMm.y}×{modelStats.dimensionsMm.z} mm
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                  <div className="text-xs text-slate-500">True Volume</div>
                  <div className="text-sm font-semibold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {modelStats.volumeCm3} cm³
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                  <div className="text-xs text-slate-500">Est. Weight</div>
                  <div className="text-sm font-semibold font-mono text-indigo-600 dark:text-indigo-300 mt-0.5">
                    ~{quote.materialCost ? Math.round(modelStats.volumeCm3 * currentMaterial.densityGramsPerCm3 * (0.45 + (printConfig.infillPercent / 100) * 0.55)) : modelStats.estimatedGrams} g
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                  <div className="text-xs text-slate-500">Triangles</div>
                  <div className="text-sm font-semibold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                    {modelStats.triangleCount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* AI Slicing & DFM Button */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  id="ai-dfm-analyze-btn"
                  onClick={runAiDfmAnalysis}
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-linear-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>{isAnalyzing ? 'Analyzing 3D Geometry with AI...' : 'Run AI Printability & Slicing Check'}</span>
                </button>

                {aiAnalysis && (
                  <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2 whitespace-pre-line leading-relaxed">
                    <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 font-semibold border-b border-slate-200 dark:border-slate-700 pb-1.5">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" /> Additive Manufacturing DFM Report
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">{aiSource}</span>
                    </div>
                    <div>{aiAnalysis}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Slicing Configuration & Instant Quotation (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleSubmitOrder} className="space-y-6">
            {/* Slicing & Material Specs */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> 1. Slicing & Material Specs
              </h2>

              {/* Material Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Select Material
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MATERIALS.map((mat) => {
                    const isSelected = printConfig.material === mat.id;
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        onClick={() => {
                          setPrintConfig({
                            ...printConfig,
                            material: mat.id,
                            technology: mat.technology,
                            colorName: mat.colors[0].name,
                            colorHex: mat.colors[0].hex,
                          });
                        }}
                        className={`p-3 rounded-xl text-left border transition ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-600'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs">{mat.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {mat.technology}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {mat.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filament / Resin Color */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-400" /> Color: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{printConfig.colorName}</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {currentMaterial.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setPrintConfig({ ...printConfig, colorName: c.name, colorHex: c.hex })}
                      className={`w-7 h-7 rounded-full border-2 transition shadow-xs flex items-center justify-center ${
                        printConfig.colorName === c.name
                          ? 'border-indigo-600 ring-2 ring-indigo-400/40 scale-110'
                          : 'border-slate-300 dark:border-slate-700 hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {printConfig.colorName === c.name && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layer Quality / Resolution */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Layer Height (Resolution)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LAYER_QUALITIES.map((lq) => (
                    <button
                      key={lq.id}
                      type="button"
                      onClick={() => setPrintConfig({ ...printConfig, layerQuality: lq.id })}
                      className={`p-2.5 rounded-xl text-left border text-xs transition ${
                        printConfig.layerQuality === lq.id
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200'
                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-semibold">{lq.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{lq.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Infill Density & Pattern */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Infill Density: <strong className="text-indigo-600 dark:text-indigo-400">{printConfig.infillPercent}%</strong>
                    </label>
                  </div>
                  <input
                    type="range"
                    id="infill-range-slider"
                    min={10}
                    max={100}
                    step={5}
                    value={printConfig.infillPercent}
                    onChange={(e) => setPrintConfig({ ...printConfig, infillPercent: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>15% (Light)</span>
                    <span>50% (Standard)</span>
                    <span>100% (Solid)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Infill Geometry
                  </label>
                  <select
                    value={printConfig.infillPattern}
                    onChange={(e) => setPrintConfig({ ...printConfig, infillPattern: e.target.value as any })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="Gyroid">Gyroid (High Isotropic Strength)</option>
                    <option value="Honeycomb">Honeycomb (Rigid)</option>
                    <option value="Grid">Grid (Standard)</option>
                  </select>
                </div>
              </div>

              {/* Quantity */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Part Quantity</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintConfig({ ...printConfig, quantity: Math.max(1, printConfig.quantity - 1) })}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-mono font-bold text-sm text-slate-900 dark:text-white">
                    {printConfig.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPrintConfig({ ...printConfig, quantity: printConfig.quantity + 1 })}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Delivery Arrangement */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> 2. Delivery & Fulfillment
              </h2>

              <div className="space-y-2">
                {DELIVERY_OPTIONS.map((opt) => {
                  const isSelected = customer.deliveryMethod === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-start justify-between p-3 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          name="deliveryMethod"
                          checked={isSelected}
                          onChange={() => setCustomer({ ...customer, deliveryMethod: opt.id })}
                          className="mt-1 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {opt.name}
                          </div>
                          <div className="text-[11px] text-slate-500">{opt.description}</div>
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                            Transit: {opt.time}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                        {opt.price === 0 ? 'FREE' : `$${opt.price.toFixed(2)}`}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Shipping Address Inputs */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={customer.name}
                      onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Email (For Live Alerts)</label>
                    <input
                      type="email"
                      required
                      value={customer.email}
                      onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Phone (SMS Updates)</label>
                    <input
                      type="tel"
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Company (Optional)</label>
                    <input
                      type="text"
                      value={customer.company || ''}
                      onChange={(e) => setCustomer({ ...customer, company: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Street Address</label>
                  <input
                    type="text"
                    required
                    value={customer.streetAddress}
                    onChange={(e) => setCustomer({ ...customer, streetAddress: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={customer.city}
                      onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">State / Zip</label>
                    <input
                      type="text"
                      required
                      value={customer.postalCode}
                      onChange={(e) => setCustomer({ ...customer, postalCode: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Country</label>
                    <input
                      type="text"
                      value={customer.country}
                      onChange={(e) => setCustomer({ ...customer, country: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Instant Quotation Summary Card */}
            <div className="bg-linear-to-b from-slate-900 to-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="font-bold text-sm tracking-wide uppercase text-slate-300">
                  Instant Quotation
                </span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  Volume-Based
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>Material Extrusion ({currentMaterial.name})</span>
                  <span className="font-mono text-slate-100">${quote.materialCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Machine Calibration & Runtime</span>
                  <span className="font-mono text-slate-100">${quote.machineTimeCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Setup & Support Cleanup</span>
                  <span className="font-mono text-slate-100">
                    ${(quote.setupFee + quote.postProcessingFee).toFixed(2)}
                  </span>
                </div>
                {printConfig.quantity > 1 && (
                  <div className="flex justify-between text-indigo-300">
                    <span>Quantity Multiplier (×{printConfig.quantity})</span>
                    <span className="font-mono">${quote.quantitySubtotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-800/80 pt-2">
                  <span>Courier Delivery ({customer.deliveryMethod.replace('_', ' ')})</span>
                  <span className="font-mono text-slate-100">${quote.shippingCost.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Total Order Amount</div>
                  <div className="text-2xl font-bold font-mono text-white mt-0.5">
                    ${quote.totalPrice.toFixed(2)}
                  </div>
                </div>

                <button
                  type="submit"
                  id="submit-3d-order-btn"
                  disabled={isSubmitting || !modelStats}
                  className="py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  <span>{isSubmitting ? 'Transmitting to Print Queue...' : 'Send Order to Print Farm'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal when Order is placed */}
      {submittedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Order Sent to Print Queue!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Your order is registered with the workshop and queued for slicing.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Order Reference:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {submittedOrder.orderNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">File:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{submittedOrder.model.fileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Material & Quality:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {submittedOrder.printConfig.material} ({submittedOrder.printConfig.layerQuality})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Delivery Address:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 text-right">
                  {submittedOrder.customer.streetAddress}, {submittedOrder.customer.city}
                </span>
              </div>
            </div>

            {/* Notification alert preview */}
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-900 dark:text-indigo-300">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-400 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Automated Client Notification Dispatched
              </div>
              <p className="text-[11px] text-indigo-600/90 dark:text-indigo-300/80">
                A confirmation email & SMS with live tracking link was sent to{' '}
                <strong>{submittedOrder.customer.email}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                id="close-confirmation-modal-btn"
                onClick={() => setSubmittedOrder(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Upload Another Model
              </button>
              <button
                type="button"
                id="track-order-modal-btn"
                onClick={() => {
                  const num = submittedOrder.orderNumber;
                  setSubmittedOrder(null);
                  onNavigateToTracking(num);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30 transition"
              >
                <span>Track Live Status</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
