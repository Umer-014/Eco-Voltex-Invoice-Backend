// controllers/invoiceController.js
const Invoice = require('../models/invoice.model');
const moment = require('moment'); // for date formatting

// Create a new invoice
// Create a new invoice (uses flat £ discount)
exports.createInvoice = async (req, res) => {
  try {
    const {
      clientName,
      clientPhone,
      clientAddress,
      postCode,
      paymentOption,
      category,
      services,
      discount,      // now flat £ amount
      paidAmount,
      date           // Accept date from frontend
    } = req.body;

    console.log('Data received from frontend:', req.body);

    // basic required-fields check (clientPhone optional)
    if (
      !clientName ||
      !clientAddress ||
      !postCode ||
      !category ||
      !paymentOption ||
      !services ||
      services.length === 0 ||
      !date
    ) {
      return res
        .status(400)
        .json({ message: 'All fields are required, including date (clientPhone is optional)' });
    }

    // Cast numbers safely
    const numericServices = (services || []).map((s) => ({
      name: s.name,
      price: Number(s.price || 0),
      quantity: Number.isFinite(Number(s.quantity)) ? Number(s.quantity) : 1,
    }));

    const numericPaidAmount = Math.max(0, Number(paidAmount || 0));

    // ---- Flat £ discount (not percent)
    let numericDiscount = Math.max(0, Number(discount || 0)); // flat £, cannot be negative

    // Subtotal from services
    const subtotal = numericServices.reduce(
      (sum, s) => sum + (Number(s.price) || 0) * (Number(s.quantity) || 0),
      0
    );

    // Cap the discount at subtotal
    if (numericDiscount > subtotal) numericDiscount = subtotal;

    // Totals
    const totalPrice = +(subtotal - numericDiscount);                  // number
    const finalRemainingAmount = Math.max(totalPrice - numericPaidAmount, 0); // number

    // Convert provided date to moment format
    const providedDate = moment(date, 'YYYY-MM-DD');
    const monthYear = providedDate.format('MMYY'); // e.g., 0325 for March 2025
    const weekNumber = Math.ceil(providedDate.date() / 7); // Determine the week of the month (1-5)

    // Find the last invoice for the same month and week
    const lastInvoice = await Invoice.findOne({
      invoiceNumber: new RegExp(`^INV-${monthYear}-${weekNumber}\\d{2}$`),
    }).sort({ invoiceNumber: -1 });

    // Determine the next sequence number
    let sequenceNumber = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('-'); // ["INV", "0325", "1XX"]
      const lastSeq = parseInt(parts[2].slice(1), 10);    // Extract last 2-digit sequence
      sequenceNumber = isNaN(lastSeq) ? 1 : lastSeq + 1;
    }

    // Ensure the sequence does not exceed 99
    if (sequenceNumber > 99) {
      return res
        .status(400)
        .json({ message: 'Invoice limit reached for this week. Please start a new week or month.' });
    }

    // Format sequence number with two digits
    const paddedSequence = String(sequenceNumber).padStart(2, '0');

    // Generate the final invoice number
    const invoiceNumber = `INV-${monthYear}-${weekNumber}${paddedSequence}`;

    // Build invoice data
    const invoiceData = {
      clientName,
      clientAddress,
      postCode,
      paymentOption,
      category,
      services: numericServices,
      discount: numericDiscount,         // <-- flat £ discount stored
      paidAmount: numericPaidAmount,
      numberOfServices: numericServices.length,

      // store numeric totals
      subtotal,                          // before discount
      totalPrice,                        // after discount
      remainingAmount: finalRemainingAmount,

      invoiceNumber,
      createdAt: providedDate.toDate(),  // Use provided date instead of system date
    };
    if (clientPhone) {
      invoiceData.clientPhone = clientPhone;
    }

    const newInvoice = new Invoice(invoiceData);

    // Save to database
    await newInvoice.save();
    res.status(201).json({ message: 'Invoice created successfully', invoice: newInvoice });
  } catch (error) {
    console.error('Error creating invoice:', error.message);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};


// Get all invoices
exports.getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find();
    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoices', error });
  }
};

// Delete invoice by invoiceNumber
exports.deleteInvoice = async (req, res) => {
  try {
    const { invoiceNumber } = req.params;

    const deletedInvoice = await Invoice.findOneAndDelete({ invoiceNumber });

    if (!deletedInvoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting invoice', error });
  }
};

// Update Payment Controller
exports.updatePayment = async (req, res) => {
  try {
    console.log('Incoming Request Data:', req.body);
    console.log('Invoice ID:', req.params.invoiceId);

    // cast incoming numbers
    const paidAmountIncoming = Number(req.body.paidAmount || 0);
    const { referenceNumber, paidDate } = req.body;

    // Find invoice using invoiceNumber (not _id)
    const invoice = await Invoice.findOne({ invoiceNumber: req.params.invoiceId });

    if (!invoice) {
      console.log('Invoice not found');
      return res.status(404).json({ message: 'Invoice not found' });
    }

    console.log('Existing Invoice Data:', invoice);

    // Calculate new remaining amount
    const newPaidAmount = Number(invoice.paidAmount || 0) + paidAmountIncoming;
    const newRemainingAmount = Number(invoice.totalPrice || 0) - newPaidAmount;

    console.log('New Paid Amount:', newPaidAmount);
    console.log('New Remaining Amount:', newRemainingAmount);

    let updateFields = {
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount
    };

    // If payment is fully completed, store reference number and paid date
    if (newRemainingAmount === 0) {
      updateFields.referenceNumber = referenceNumber;
      updateFields.paidDate = paidDate;
    }

    console.log('Updated Fields:', updateFields);

    // Update the invoice
    const updatedInvoice = await Invoice.findOneAndUpdate(
      { invoiceNumber: req.params.invoiceId }, // Find by invoiceNumber
      { $set: updateFields },
      { new: true }
    );

    console.log('Updated Invoice Data:', updatedInvoice);

    res.json({ message: 'Payment updated successfully', updatedInvoice });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// edit the invoice 
exports.updateInvoice = async (req, res, next) => {
  try {
    // add discount if you allow it
    const allowed = [
      'clientName',
      'clientPhone',
      'clientAddress',
      'postCode',
      'paymentOption',
      'category',
      'services',
      'paidAmount',
      'discount',    // 👈 allow discount to be passed
          // date
    ];

    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = req.body[key];
      }
    }

    // normalise services
    if (update.services) {
      update.services = Array.isArray(update.services)
        ? update.services.map(s => ({
            name: s.name || '',
            price: Number(s.price) || 0,
            quantity: Number(s.quantity) || 0
          }))
        : [];
    }

    // always load invoice so we can recalc totals
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });

    // apply updated fields (except paidAmount, we’ll handle separately)
    for (const k of Object.keys(update)) {
      if (k === 'paidAmount') continue; // handle below
      inv[k] = update[k];
    }

    // recalc total price from services
    const services = inv.services || [];
    const subtotal = services.reduce(
      (sum, s) => sum + (s.price * s.quantity),
      0
    );
    const discount = Number(inv.discount) || 0; // optional discount field
    inv.totalPrice = subtotal - discount;

    // update paid amount if provided
    if (update.paidAmount !== undefined) {
      inv.paidAmount = Number(update.paidAmount) || 0;
    }

    // recalc remaining
    inv.remainingAmount = (inv.totalPrice || 0) - (inv.paidAmount || 0);

    // handle createdAt if present
    if (update.createdAt) inv.createdAt = new Date(update.createdAt);

    await inv.save();
    return res.json(inv);
  } catch (err) {
    next(err);
  }
};

// get single invoice by id
exports.getInvoiceByNumber = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ invoiceNumber: req.params.invoiceNumber });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateInvoiceByNumber = async (req, res) => {
  try {
    // Load invoice by invoiceNumber
    const inv = await Invoice.findOne({ invoiceNumber: req.params.invoiceNumber });
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });

    // Only allow certain fields
    const allowed = [
      'clientName',
      'clientPhone',
      'clientAddress',
      'postCode',
      'paymentOption',
      'category',
      'services',
      'paidAmount',
      'discount',      // optional discount field
      'createdAt'
    ];

    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = req.body[key];
      }
    }

    // normalise services if present
    if (update.services) {
      update.services = Array.isArray(update.services)
        ? update.services.map(s => ({
            name: s.name || '',
            price: Number(s.price) || 0,
            quantity: Number(s.quantity) || 0
          }))
        : [];
    }

    // apply all fields except paidAmount separately
    for (const k of Object.keys(update)) {
      if (k === 'paidAmount') continue;
      inv[k] = update[k];
    }

    // recalc subtotal
    const services = inv.services || [];
    const subtotal = services.reduce(
      (sum, s) => sum + (s.price * s.quantity),
      0
    );

    const discount = Number(inv.discount) || 0;
    inv.totalPrice = subtotal - discount;

    // update paid amount if provided
    if (update.paidAmount !== undefined) {
      inv.paidAmount = Number(update.paidAmount) || 0;
    }

    // recalc remaining
    inv.remainingAmount = (inv.totalPrice || 0) - (inv.paidAmount || 0);

    // handle createdAt if present
    if (update.createdAt) inv.createdAt = new Date(update.createdAt);

    await inv.save();

    res.json(inv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
