// controllers/quote.controller.js
const Quote = require('../models/quote.model');
const moment = require('moment');

/**
 * Build next quote number with pattern: QTN-<MMYY>-<W><seq>
 * Example: QTN-1125-101  => Nov 2025, week 1, sequence 01
 */
async function getNextQuoteNumber(dateStr) {
  const providedDate = moment(dateStr, 'YYYY-MM-DD', true);
  if (!providedDate.isValid()) throw new Error('Invalid date');

  const monthYear = providedDate.format('MMYY');         // e.g., 1125
  const weekNumber = Math.ceil(providedDate.date() / 7); // 1..5
  const prefix = `QTN-${monthYear}-${weekNumber}`;

  // Find last quote of this prefix and increment its 2-digit sequence
  const last = await Quote.findOne({ quoteNumber: new RegExp(`^${prefix}\\d{2}$`) })
    .sort({ quoteNumber: -1 })
    .lean();

  let seq = 1;
  if (last) {
    const tail = last.quoteNumber.replace(prefix, ''); // e.g., "07"
    const prev = parseInt(tail, 10);
    if (!Number.isNaN(prev)) seq = prev + 1;
  }
  if (seq > 99) throw new Error('Quotation sequence limit reached for this week.');

  const padded = String(seq).padStart(2, '0');
  return `${prefix}${padded}`;
}

function toNum(n) {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function normalizeItems(items = []) {
  return (items || []).map((x) => ({
    name: (x?.name || '').trim(),
    price: toNum(x?.price),
    quantity: toNum(x?.quantity),
  }));
}

function calcTotals(services, materials, discountFlat) {
  const svc = services.reduce((s, x) => s + x.price * x.quantity, 0);
  const mat = materials.reduce((s, x) => s + x.price * x.quantity, 0);
  const subtotal = +(svc + mat).toFixed(2);
  const discount = Math.min(discountFlat, subtotal); // don’t go below zero
  const totalPrice = +(Math.max(0, subtotal - discount)).toFixed(2);
  return { servicesSubtotal: svc, materialsSubtotal: mat, subtotal, totalPrice };
}

/** POST /api/quotes/create */
exports.createQuote = async (req, res) => {
  try {
    const {
      clientName,
      clientPhone,
      clientAddress,
      postCode,
      category,
      services,
      materials,
      discount,         // flat £
      date,             // 'YYYY-MM-DD'
      validUntil,
      notes,
    } = req.body || {};

    if (!clientName || !postCode || !category || !date) {
      return res.status(400).json({ message: 'Required: clientName, postCode, category, date' });
    }

    const servicesNorm = normalizeItems(services);
    if (servicesNorm.length === 0) {
      return res.status(400).json({ message: 'At least one service is required' });
    }
    const materialsNorm = normalizeItems(materials);
    const discountFlat = toNum(discount);

    const { subtotal, totalPrice } = calcTotals(servicesNorm, materialsNorm, discountFlat);

    const quoteNumber = await getNextQuoteNumber(date);

    const doc = new Quote({
      clientName,
      clientPhone,
      clientAddress,
      postCode,
      category,
      services: servicesNorm,
      materials: materialsNorm,
      discount: discountFlat,
      numberOfServices: servicesNorm.length,
      numberOfMaterials: materialsNorm.length,
      subtotal,
      totalPrice,
      quoteNumber,
      createdAt: moment(date, 'YYYY-MM-DD').toDate(),
      validUntil: validUntil ? moment(validUntil, 'YYYY-MM-DD').toDate() : undefined,
      notes: notes || '',
      status: 'DRAFT',
    });

    await doc.save();
    res.status(201).json({ message: 'Quotation created', quote: doc });
  } catch (err) {
    console.error('createQuote error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

/** GET /api/quotes */
exports.getQuotes = async (_req, res) => {
  try {
    const quotes = await Quote.find().sort({ createdAt: -1 });
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching quotations', error: err });
  }
};

/** GET /api/quotes/number/:quoteNumber */
exports.getQuoteByNumber = async (req, res) => {
  try {
    const quote = await Quote.findOne({ quoteNumber: req.params.quoteNumber });
    if (!quote) return res.status(404).json({ message: 'Quotation not found' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** PUT /api/quotes/:id  (edit by Mongo _id) */
exports.updateQuote = async (req, res) => {
  try {
    const q = await Quote.findById(req.params.id);
    if (!q) return res.status(404).json({ message: 'Quotation not found' });

    // allowed fields
    const {
      clientName, clientPhone, clientAddress, postCode, category,
      services, materials, discount, status, validUntil, notes, createdAt
    } = req.body || {};

    if (clientName !== undefined) q.clientName = clientName;
    if (clientPhone !== undefined) q.clientPhone = clientPhone;
    if (clientAddress !== undefined) q.clientAddress = clientAddress;
    if (postCode !== undefined) q.postCode = postCode;
    if (category !== undefined) q.category = category;

    if (services !== undefined) q.services = normalizeItems(services);
    if (materials !== undefined) q.materials = normalizeItems(materials);
    if (discount !== undefined) q.discount = toNum(discount);
    if (status !== undefined) q.status = status;
    if (validUntil !== undefined) q.validUntil = validUntil ? new Date(validUntil) : undefined;
    if (notes !== undefined) q.notes = notes;
    if (createdAt !== undefined) q.createdAt = new Date(createdAt);

    // recalc totals
    const { subtotal, totalPrice } = calcTotals(q.services, q.materials, q.discount);
    q.subtotal = subtotal;
    q.totalPrice = totalPrice;
    q.numberOfServices = q.services.length;
    q.numberOfMaterials = q.materials.length;

    await q.save();
    res.json(q);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** PUT /api/quotes/number/:quoteNumber  (edit by business key) */
exports.updateQuoteByNumber = async (req, res) => {
  try {
    const q = await Quote.findOne({ quoteNumber: req.params.quoteNumber });
    if (!q) return res.status(404).json({ message: 'Quotation not found' });

    const {
      clientName, clientPhone, clientAddress, postCode, category,
      services, materials, discount, status, validUntil, notes, createdAt
    } = req.body || {};

    if (clientName !== undefined) q.clientName = clientName;
    if (clientPhone !== undefined) q.clientPhone = clientPhone;
    if (clientAddress !== undefined) q.clientAddress = clientAddress;
    if (postCode !== undefined) q.postCode = postCode;
    if (category !== undefined) q.category = category;

    if (services !== undefined) q.services = normalizeItems(services);
    if (materials !== undefined) q.materials = normalizeItems(materials);
    if (discount !== undefined) q.discount = toNum(discount);
    if (status !== undefined) q.status = status;
    if (validUntil !== undefined) q.validUntil = validUntil ? new Date(validUntil) : undefined;
    if (notes !== undefined) q.notes = notes;
    if (createdAt !== undefined) q.createdAt = new Date(createdAt);

    const { subtotal, totalPrice } = calcTotals(q.services, q.materials, q.discount);
    q.subtotal = subtotal;
    q.totalPrice = totalPrice;
    q.numberOfServices = q.services.length;
    q.numberOfMaterials = q.materials.length;

    await q.save();
    res.json(q);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** DELETE /api/quotes/:quoteNumber */
exports.deleteQuote = async (req, res) => {
  try {
    const deleted = await Quote.findOneAndDelete({ quoteNumber: req.params.quoteNumber });
    if (!deleted) return res.status(404).json({ message: 'Quotation not found' });
    res.json({ message: 'Quotation deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting quotation', error: err });
  }
};

/**
 * (Optional) GET /api/quotes/convert/:quoteNumber
 * Prepare payload to create an INVOICE from an accepted quote.
 */
exports.convertQuotePayload = async (req, res) => {
  try {
    const quote = await Quote.findOne({ quoteNumber: req.params.quoteNumber });
    if (!quote) return res.status(404).json({ message: 'Quotation not found' });

    // You may want to include materials in the invoice too (either
    // merge into services or keep a materials section on the invoice if supported)
    const payload = {
      clientName: quote.clientName,
      clientPhone: quote.clientPhone,
      clientAddress: quote.clientAddress,
      postCode: quote.postCode,
      category: quote.category,
      services: [
        // merge services + materials so your existing invoice endpoint can accept them
        ...quote.services.map(s => ({ name: s.name, price: s.price, quantity: s.quantity })),
        ...quote.materials.map(m => ({ name: `(Material) ${m.name}`, price: m.price, quantity: m.quantity })),
      ],
      // If your invoice controller expects a *flat* discount, keep it here.
      // If it expects percent, you may want to translate it there.
      discount: quote.discount,
      paidAmount: 0,
      date: moment().format('YYYY-MM-DD'),
      notes: (quote.notes || '').trim(),
    };

    res.json({ message: 'OK', invoicePayload: payload });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
