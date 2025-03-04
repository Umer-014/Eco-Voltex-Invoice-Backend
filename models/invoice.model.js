const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  clientPhone: { type: String, required: true },
  clientAddress: { type: String, required: true },
  postCode: { type: String, required: true },
  paymentOption: { type: String, required: true },
  category: { type: String, required: true },
  services: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
    },
  ],
  discount: { type: Number, default: 0 },
  numberOfServices: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  invoiceNumber: { type: String, unique: true, required: true },
  createdAt: { type: Date, required: true },

  // New Fields for Payment Confirmation
  referenceNumber: { type: String, default: null }, // Store Reference Number
  paidDate: { type: Date, default: null }, // Store Payment Date
});

module.exports = mongoose.model('Invoice', invoiceSchema);
