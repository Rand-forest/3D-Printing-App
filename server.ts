import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { OrderItem, PrinterDevice, OrderStatus, StatusLogEntry } from './src/types';
import { INITIAL_PRINTERS } from './src/utils/constants';

dotenv.config();

const app = express();
const PORT = 3000;

// Increase JSON body limit to support base64 STL uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// In-memory data store with realistic initial data
let printers: PrinterDevice[] = JSON.parse(JSON.stringify(INITIAL_PRINTERS));

let orders: OrderItem[] = [
  {
    id: 'ord-1',
    orderNumber: 'ORD-8419',
    createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    status: 'PRINTING',
    internalPriority: 'Normal',
    assignedPrinterId: 'PRN-01',
    model: {
      fileName: 'Robotics_Sensor_Bracket_V2.stl',
      fileSizeBytes: 1845000,
      dimensionsMm: { x: 78.4, y: 52.0, z: 41.5 },
      volumeCm3: 42.8,
      surfaceAreaCm2: 135.2,
      triangleCount: 36900,
      estimatedPrintTimeHours: 2.8,
      estimatedGrams: 53,
    },
    printConfig: {
      technology: 'FDM',
      material: 'PETG_CF',
      colorName: 'Matte Charcoal Black',
      colorHex: '#18181b',
      infillPercent: 40,
      infillPattern: 'Gyroid',
      layerQuality: 'FINE',
      quantity: 2,
      supportsRequired: true,
      notes: 'Please ensure high dimensional tolerance for 5mm M3 brass heat-set inserts.',
    },
    quote: {
      materialCost: 17.6,
      machineTimeCost: 18.0,
      setupFee: 5.0,
      postProcessingFee: 4.0,
      quantitySubtotal: 44.6,
      shippingCost: 8.5,
      totalPrice: 53.1,
    },
    customer: {
      name: 'Marcus Vance',
      email: 'm.vance@aerovance.tech',
      phone: '+1 (555) 234-8901',
      company: 'AeroVance Dynamics',
      streetAddress: '742 Innovation Way, Suite 300',
      city: 'Austin',
      stateOrProvince: 'TX',
      postalCode: '78701',
      country: 'United States',
      deliveryMethod: 'STANDARD_TRACKED',
    },
    delivery: {
      method: 'STANDARD_TRACKED',
      carrier: 'DHL Express Ground',
      estimatedDeliveryDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    },
    statusHistory: [
      {
        id: 'log-1',
        timestamp: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
        stage: 'PENDING_REVIEW',
        title: 'Order Received & Mesh Validated',
        description: 'STL mesh verified: manifold geometry, 36,900 triangles, estimated weight 53g.',
        updatedBy: 'System',
        automatedNotificationSent: {
          channel: 'EMAIL',
          recipient: 'm.vance@aerovance.tech',
          subjectOrSummary: 'Order #ORD-8419 Confirmed - In Production Queue',
          content: 'Hello Marcus, your 3D print order for Robotics_Sensor_Bracket_V2.stl has been validated and queued.',
        },
      },
      {
        id: 'log-2',
        timestamp: new Date(Date.now() - 3600 * 1000 * 2.5).toISOString(),
        stage: 'SLICING_QUEUED',
        title: 'Slicing Completed & Assigned',
        description: 'Sliced at 0.16mm layer height with 40% Gyroid infill. Assigned to Bambu Lab X1-Carbon #1.',
        updatedBy: 'Operator',
      },
      {
        id: 'log-3',
        timestamp: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
        stage: 'PRINTING',
        title: 'Printing in Progress',
        description: 'Extrusion active at 255°C nozzle, 60°C heated bed. Print progress: 68%.',
        updatedBy: 'System',
        automatedNotificationSent: {
          channel: 'SMS',
          recipient: '+1 (555) 234-8901',
          subjectOrSummary: '3D Print Started',
          content: 'PrintFlow: Your order ORD-8419 is currently on Bambu X1 printer (68% completed).',
        },
      },
    ],
  },
  {
    id: 'ord-2',
    orderNumber: 'ORD-8392',
    createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    status: 'READY_FOR_DISPATCH',
    internalPriority: 'Rush',
    assignedPrinterId: 'PRN-03',
    model: {
      fileName: 'HighTemp_Turbine_Impeller.stl',
      fileSizeBytes: 3200000,
      dimensionsMm: { x: 112.0, y: 112.0, z: 48.0 },
      volumeCm3: 88.4,
      surfaceAreaCm2: 245.0,
      triangleCount: 64000,
      estimatedPrintTimeHours: 5.2,
      estimatedGrams: 98,
    },
    printConfig: {
      technology: 'FDM',
      material: 'ABS_PRO',
      colorName: 'Industrial Grey',
      colorHex: '#64748b',
      infillPercent: 80,
      infillPattern: 'Honeycomb',
      layerQuality: 'STANDARD',
      quantity: 1,
      supportsRequired: true,
      notes: 'Acetone vapor smoothing requested if possible.',
    },
    quote: {
      materialCost: 28.5,
      machineTimeCost: 32.0,
      setupFee: 5.0,
      postProcessingFee: 12.0,
      quantitySubtotal: 77.5,
      shippingCost: 18.0,
      totalPrice: 95.5,
    },
    customer: {
      name: 'Dr. Elena Rostova',
      email: 'e.rostova@hydrodynamics.org',
      phone: '+1 (555) 981-4432',
      company: 'Precision Fluids Lab',
      streetAddress: '120 Science Parkway, Building D',
      city: 'Cambridge',
      stateOrProvince: 'MA',
      postalCode: '02142',
      country: 'United States',
      deliveryMethod: 'EXPRESS_COURIER',
    },
    delivery: {
      method: 'EXPRESS_COURIER',
      carrier: 'FedEx Priority Overnight',
      trackingNumber: 'FX-9821094829',
      trackingUrl: 'https://fedex.com/track?id=FX-9821094829',
      estimatedDeliveryDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      dispatchedAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    },
    statusHistory: [
      {
        id: 'log-201',
        timestamp: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
        stage: 'PENDING_REVIEW',
        title: 'Order Placed',
        description: 'Order received and payment authorization cleared.',
        updatedBy: 'System',
      },
      {
        id: 'log-202',
        timestamp: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
        stage: 'PRINTING',
        title: 'Printed on Voron 2.4 350',
        description: 'Chamber temperature kept at 50°C to eliminate warping.',
        updatedBy: 'Operator',
      },
      {
        id: 'log-203',
        timestamp: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
        stage: 'QUALITY_INSPECTION',
        title: 'Passed Optical & Dimensional Inspection',
        description: 'Bore diameter measured with digital calipers: 12.02mm (within +/- 0.05mm tolerance).',
        updatedBy: 'Operator',
      },
      {
        id: 'log-204',
        timestamp: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
        stage: 'READY_FOR_DISPATCH',
        title: 'Packaged & Courier Scheduled',
        description: 'Wrapped in anti-static bubble wrap. FedEx courier dispatch scheduled.',
        updatedBy: 'Operator',
        automatedNotificationSent: {
          channel: 'EMAIL',
          recipient: 'e.rostova@hydrodynamics.org',
          subjectOrSummary: 'FedEx Tracking: Order #ORD-8392 Dispatched',
          content: 'Hello Elena, your order has been packed and assigned FedEx Priority tracking FX-9821094829.',
        },
      },
    ],
  },
  {
    id: 'ord-3',
    orderNumber: 'ORD-8310',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    status: 'DELIVERED',
    internalPriority: 'Normal',
    assignedPrinterId: 'PRN-04',
    model: {
      fileName: 'Dental_Crown_Bridge_Mockup.stl',
      fileSizeBytes: 4800000,
      dimensionsMm: { x: 38.2, y: 26.5, z: 19.8 },
      volumeCm3: 12.4,
      surfaceAreaCm2: 45.1,
      triangleCount: 96000,
      estimatedPrintTimeHours: 1.5,
      estimatedGrams: 15,
    },
    printConfig: {
      technology: 'SLA_RESIN',
      material: 'TOUGH_RESIN',
      colorName: 'Ceramic Grey',
      colorHex: '#cbd5e1',
      infillPercent: 100,
      infillPattern: 'Grid',
      layerQuality: 'ULTRA_FINE',
      quantity: 1,
      supportsRequired: true,
      notes: 'Full UV post-cure required.',
    },
    quote: {
      materialCost: 9.8,
      machineTimeCost: 15.0,
      setupFee: 8.0,
      postProcessingFee: 8.0,
      quantitySubtotal: 40.8,
      shippingCost: 8.5,
      totalPrice: 49.3,
    },
    customer: {
      name: 'Clara Johansson',
      email: 'clara.johansson@nordicdesigns.com',
      phone: '+1 (555) 672-1190',
      streetAddress: '55 Ocean View Terrace',
      city: 'San Francisco',
      stateOrProvince: 'CA',
      postalCode: '94107',
      country: 'United States',
      deliveryMethod: 'STANDARD_TRACKED',
    },
    delivery: {
      method: 'STANDARD_TRACKED',
      carrier: 'DHL Express Ground',
      trackingNumber: 'DHL-87291039',
      trackingUrl: 'https://dhl.com/track?id=DHL-87291039',
      estimatedDeliveryDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      dispatchedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    statusHistory: [
      {
        id: 'log-301',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        stage: 'PENDING_REVIEW',
        title: 'Order Received',
        description: 'Order entered queue.',
        updatedBy: 'System',
      },
      {
        id: 'log-302',
        timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
        stage: 'DELIVERED',
        title: 'Package Delivered',
        description: 'Delivered to front desk, signed by recipient.',
        updatedBy: 'Carrier',
        automatedNotificationSent: {
          channel: 'EMAIL',
          recipient: 'clara.johansson@nordicdesigns.com',
          subjectOrSummary: 'Order #ORD-8310 Delivered Successfully',
          content: 'Hi Clara, your 3D print package was delivered. Thank you for choosing 3D Print Lab!',
        },
      },
    ],
  },
];

// --- REST API ROUTES ---

// GET /api/orders
app.get('/api/orders', (req, res) => {
  const { status, query } = req.query;
  let filtered = [...orders];

  if (status && typeof status === 'string' && status !== 'ALL') {
    filtered = filtered.filter((o) => o.status === status);
  }

  if (query && typeof query === 'string') {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.email.toLowerCase().includes(q) ||
        o.model.fileName.toLowerCase().includes(q) ||
        (o.delivery.trackingNumber && o.delivery.trackingNumber.toLowerCase().includes(q))
    );
  }

  // Sort descending by creation date
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ orders: filtered });
});

// GET /api/orders/:idOrOrderNumber
app.get('/api/orders/:id', (req, res) => {
  const param = req.params.id.toUpperCase();
  const order = orders.find(
    (o) => o.id === req.params.id || o.orderNumber.toUpperCase() === param
  );
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({ order });
});

// POST /api/orders (Customer Submits Order)
app.post('/api/orders', (req, res) => {
  const { model, printConfig, quote, customer, delivery, modelRawStlBase64 } = req.body;

  if (!model || !printConfig || !customer) {
    return res.status(400).json({ error: 'Missing required order fields' });
  }

  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `ORD-${randomDigits}`;
  const now = new Date().toISOString();

  const initialLog: StatusLogEntry = {
    id: `log-${Date.now()}`,
    timestamp: now,
    stage: 'PENDING_REVIEW',
    title: 'Order Placed & Mesh Received',
    description: `Uploaded ${model.fileName} (${model.dimensionsMm.x}×${model.dimensionsMm.y}×${model.dimensionsMm.z} mm, ${model.volumeCm3} cm³). Configured in ${printConfig.material} at ${printConfig.layerQuality}.`,
    updatedBy: 'System',
    automatedNotificationSent: {
      channel: 'EMAIL',
      recipient: customer.email,
      subjectOrSummary: `Order Confirmation #${orderNumber} - 3D Print Lab`,
      content: `Hi ${customer.name}, we received your 3D print order #${orderNumber} for "${model.fileName}". Our engineers are reviewing the mesh geometry and queuing it for slicing. Track progress anytime using tracking code: ${orderNumber}.`,
    },
  };

  const newOrder: OrderItem = {
    id: `ord-${Date.now()}`,
    orderNumber,
    createdAt: now,
    updatedAt: now,
    status: 'PENDING_REVIEW',
    internalPriority: 'Normal',
    model,
    modelRawStlBase64,
    printConfig,
    quote,
    customer,
    delivery: delivery || {
      method: customer.deliveryMethod || 'STANDARD_TRACKED',
    },
    statusHistory: [initialLog],
  };

  orders.unshift(newOrder);

  res.status(201).json({
    success: true,
    order: newOrder,
    message: 'Order created successfully and queued for workshop review.',
  });
});

// PATCH /api/orders/:id/status (Operator updates stage)
app.patch('/api/orders/:id/status', (req, res) => {
  const { status, operatorNotes, assignedPrinterId, sendClientNotification } = req.body;
  const orderIndex = orders.findIndex(
    (o) => o.id === req.params.id || o.orderNumber === req.params.id
  );

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = orders[orderIndex];
  const previousStatus = order.status;
  const now = new Date().toISOString();

  if (status) {
    order.status = status as OrderStatus;
  }
  if (operatorNotes !== undefined) {
    order.operatorNotes = operatorNotes;
  }
  if (assignedPrinterId !== undefined) {
    order.assignedPrinterId = assignedPrinterId;
  }
  order.updatedAt = now;

  // Build descriptive stage change log
  let stageTitle = `Status updated to ${order.status.replace(/_/g, ' ')}`;
  let stageDescription = `Transitioned from ${previousStatus.replace(/_/g, ' ')} to ${order.status.replace(/_/g, ' ')}.`;

  if (order.status === 'SLICING_QUEUED') {
    stageTitle = 'Model Sliced & Queued';
    stageDescription = `Toolpaths and G-code generated for ${order.printConfig.material}. Layer height: ${order.printConfig.layerQuality}.`;
  } else if (order.status === 'PRINTING') {
    stageTitle = 'Production Print Started';
    const printer = printers.find((p) => p.id === order.assignedPrinterId);
    stageDescription = `Printing on ${printer ? printer.name : 'workshop printer'}. Extrusion temp calibrated.`;
    // Update printer device status
    if (printer) {
      printer.status = 'PRINTING';
      printer.activeOrderId = order.orderNumber;
      printer.currentProgressPercent = 5;
    }
  } else if (order.status === 'POST_PROCESSING') {
    stageTitle = 'Post-Processing & Curing';
    stageDescription = 'Supports carefully removed, ultrasonic bath cleaned and surface inspected.';
  } else if (order.status === 'QUALITY_INSPECTION') {
    stageTitle = 'Quality Control Passed';
    stageDescription = 'Passed tolerance checklist: dimensions, surface finish, layer bonding verified.';
  } else if (order.status === 'READY_FOR_DISPATCH') {
    stageTitle = 'Packaged & Ready for Dispatch';
    stageDescription = 'Packed with custom shock-absorption foam and ready for courier pickup.';
  } else if (order.status === 'DELIVERED') {
    stageTitle = 'Delivery Completed';
    stageDescription = 'Order received by client. Fulfillment completed.';
  }

  // Create automated notification record
  let notificationRecord = undefined;
  if (sendClientNotification !== false) {
    notificationRecord = {
      channel: 'EMAIL' as const,
      recipient: order.customer.email,
      subjectOrSummary: `Update on Order #${order.orderNumber}: ${stageTitle}`,
      content: `Hello ${order.customer.name}, your 3D print order #${order.orderNumber} (${order.model.fileName}) is now in stage: ${order.status.replace(/_/g, ' ')}. ${stageDescription}`,
    };
  }

  const logEntry: StatusLogEntry = {
    id: `log-${Date.now()}`,
    timestamp: now,
    stage: order.status,
    title: stageTitle,
    description: operatorNotes ? `${stageDescription} Note: ${operatorNotes}` : stageDescription,
    updatedBy: 'Operator',
    automatedNotificationSent: notificationRecord,
  };

  order.statusHistory.unshift(logEntry);
  orders[orderIndex] = order;

  res.json({ success: true, order });
});

// POST /api/orders/:id/dispatch (Operator arranges courier delivery)
app.post('/api/orders/:id/dispatch', (req, res) => {
  const { carrier, trackingNumber, estimatedDeliveryDate, notes } = req.body;
  const orderIndex = orders.findIndex(
    (o) => o.id === req.params.id || o.orderNumber === req.params.id
  );

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = orders[orderIndex];
  const now = new Date().toISOString();

  const assignedTracking =
    trackingNumber ||
    `${carrier.toUpperCase().slice(0, 3)}-${Math.floor(10000000 + Math.random() * 90000000)}`;

  order.status = 'DISPATCHED';
  order.updatedAt = now;
  order.delivery = {
    ...order.delivery,
    carrier: carrier || 'DHL Express Priority',
    trackingNumber: assignedTracking,
    trackingUrl: `https://tracking.printlab.internal/track?num=${assignedTracking}`,
    dispatchedAt: now,
    estimatedDeliveryDate:
      estimatedDeliveryDate ||
      new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
  };

  const logEntry: StatusLogEntry = {
    id: `log-${Date.now()}`,
    timestamp: now,
    stage: 'DISPATCHED',
    title: 'Dispatched with Courier',
    description: `Handed over to ${order.delivery.carrier}. Tracking: ${assignedTracking}. Est. arrival: ${order.delivery.estimatedDeliveryDate}. ${notes || ''}`,
    updatedBy: 'Operator',
    automatedNotificationSent: {
      channel: 'EMAIL',
      recipient: order.customer.email,
      subjectOrSummary: `Your 3D Print #${order.orderNumber} is on the way! Tracking: ${assignedTracking}`,
      content: `Hello ${order.customer.name},\nGreat news! Your 3D printed order #${order.orderNumber} has been handed over to ${order.delivery.carrier}.\n\nTracking Number: ${assignedTracking}\nEstimated Delivery: ${order.delivery.estimatedDeliveryDate}\nShipping Address: ${order.customer.streetAddress}, ${order.customer.city}`,
    },
  };

  order.statusHistory.unshift(logEntry);
  orders[orderIndex] = order;

  res.json({
    success: true,
    order,
    trackingNumber: assignedTracking,
    message: 'Courier arranged and automated client notification sent.',
  });
});

// GET /api/printers
app.get('/api/printers', (req, res) => {
  res.json({ printers });
});

// PATCH /api/printers/:id
app.patch('/api/printers/:id', (req, res) => {
  const { status, currentProgressPercent, activeOrderId, nozzleTempC, bedTempC } = req.body;
  const printer = printers.find((p) => p.id === req.params.id);
  if (!printer) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  if (status) printer.status = status;
  if (currentProgressPercent !== undefined) printer.currentProgressPercent = currentProgressPercent;
  if (activeOrderId !== undefined) printer.activeOrderId = activeOrderId;
  if (nozzleTempC !== undefined) printer.nozzleTempC = nozzleTempC;
  if (bedTempC !== undefined) printer.bedTempC = bedTempC;

  res.json({ success: true, printer });
});

// GET /api/stats (Workshop overview)
app.get('/api/stats', (req, res) => {
  const activeJobs = orders.filter(
    (o) => o.status !== 'DELIVERED'
  ).length;
  const printingCount = orders.filter((o) => o.status === 'PRINTING').length;
  const completedCount = orders.filter((o) => o.status === 'DELIVERED').length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.quote.totalPrice || 0), 0);
  const gramsUsed = orders.reduce((sum, o) => sum + (o.model.estimatedGrams || 0), 0);

  res.json({
    activeJobsCount: activeJobs,
    queueDepth: orders.filter((o) => o.status === 'PENDING_REVIEW' || o.status === 'SLICING_QUEUED').length,
    printingNow: printingCount,
    totalCompletedOrders: completedCount,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    utilizationRatePercent: Math.round((printingCount / Math.max(1, printers.length)) * 100),
    filamentsGramsUsedThisMonth: gramsUsed,
  });
});

// POST /api/analyze-model (AI Printability & DFM Advisor)
app.post('/api/analyze-model', async (req, res) => {
  const { dimensionsMm, volumeCm3, material, technology, layerQuality, infillPercent } = req.body;

  const modelMetrics = `
Dimensions: ${dimensionsMm?.x || 0}mm (X) x ${dimensionsMm?.y || 0}mm (Y) x ${dimensionsMm?.z || 0}mm (Z)
Volume: ${volumeCm3 || 0} cm³
Target Material: ${material || 'PLA_PLUS'}
Technology: ${technology || 'FDM'}
Layer Quality: ${layerQuality || 'STANDARD'}
Infill: ${infillPercent || 20}%
`;

  try {
    const ai = getGeminiClient();
    if (ai) {
      const prompt = `You are a senior 3D printing engineer and Design for Additive Manufacturing (DFAM) specialist.
Analyze this 3D model specification for production feasibility:
${modelMetrics}

Provide a concise, practical evaluation with:
1. Printability Score (out of 10)
2. Orientation recommendation (e.g. flat face down on build plate, 45 degree angle for resin, etc.)
3. Overhang & Support risk assessment
4. Mechanical strength & warping considerations for the selected material
5. Slicer tip (e.g. brim vs raft, cooling fan speed, wall line count)

Keep your response structured, professional, clear, and actionable in markdown.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      return res.json({
        analysis: response.text,
        source: 'Gemini AI DFM Engine',
      });
    }
  } catch (err) {
    console.error('Gemini DFM analysis error:', err);
  }

  // Graceful rule-based DFM fallback if key is not active
  const maxDim = Math.max(dimensionsMm?.x || 0, dimensionsMm?.y || 0, dimensionsMm?.z || 0);
  const minDim = Math.min(dimensionsMm?.x || 0, dimensionsMm?.y || 0, dimensionsMm?.z || 0);
  const isTall = (dimensionsMm?.z || 0) > 2 * Math.max(dimensionsMm?.x || 1, dimensionsMm?.y || 1);

  const fallbackAnalysis = `### 3D Printability & DFM Report
**Overall Printability Score:** 9.2 / 10

**1. Recommended Build Plate Orientation:**
- Align the largest flat surface with the XY build plate to maximize bed adhesion.
${isTall ? '- *Caution:* Model has a high aspect ratio. A wide brim (8-10mm) is recommended to prevent print detachment due to nozzle drag.' : '- Standard skirt adhesion will be sufficient.'}

**2. Overhangs & Support Strategy:**
- Critical overhang threshold: 45° for ${material || 'PLA+'}.
- Recommend tree/organic supports to minimize contact scarring and shorten post-processing time.

**3. Material & Thermal Dynamics (${material || 'PLA+'}):**
- Material offers reliable layer bonding with minimal thermal contraction.
- Recommended nozzle temperature: 210°C - 220°C with bed at 60°C.
${material?.includes('ABS') ? '- Requires heated chamber (50°C) to prevent delamination.' : ''}

**4. Slicing Recommendations:**
- Wall loops: 3 perimeters for optimal structural integrity.
- Infill pattern: Gyroid recommended for isotropic strength across all 3 axes.`;

  res.json({
    analysis: fallbackAnalysis,
    source: 'Heuristic DFM Engine',
  });
});

// Setup Vite or Static File Serving
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`3D Print Lab Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
