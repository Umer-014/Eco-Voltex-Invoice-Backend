// models/quote.model.js
const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const quoteSchema = new mongoose.Schema({
  // Client
  clientName: { type: String, required: true },
  clientPhone: { type: String },
  clientAddress: { type: String },
  postCode: { type: String, required: true },

  // Meta
  category: { type: String, required: true, enum: ['Residential', 'Commercial', 'Industrial'] },

  // Items
  services: { type: [lineItemSchema], default: [] },
  materials: { type: [lineItemSchema], default: [] },

  // Pricing
  discount: { type: Number, default: 0, min: 0 }, // flat £ amount
  numberOfServices: { type: Number, required: true },
  numberOfMaterials: { type: Number, required: true },
  subtotal: { type: Number, required: true },     // services + materials (before discount)
  totalPrice: { type: Number, required: true },   // subtotal - discount (>=0)

  // Identity + Dates
  quoteNumber: { type: String, unique: true, required: true },
  createdAt: { type: Date, required: true },
  validUntil: { type: Date },

  // Status/Notes
  status: {
    type: String,
    enum: ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED'],
    default: 'DRAFT',
  },
  notes: { type: String, default: '' },
});

module.exports = mongoose.model('Quote', quoteSchema);
