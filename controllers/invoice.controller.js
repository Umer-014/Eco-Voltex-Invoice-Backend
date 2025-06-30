// controllers/invoiceController.js
const Invoice = require('../models/invoice.model');
const moment = require('moment'); // for date formatting


// Create a new invoice
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
      discount, 
      paidAmount,
      date // Accept date from frontend
    } = req.body;

    console.log("Data received from frontend:", req.body);

    if (!clientName || !clientAddress || !postCode || !category || !paymentOption || !paidAmount || services.length === 0 || !date) {
      return res.status(400).json({ message: 'All fields are required, including date (clientPhone is optional)' });
    }

    // Calculate total price
    const totalPrice = services.reduce((sum, service) => {
      return sum + parseFloat(service.price) * parseInt(service.quantity || 1, 10);
    }, 0);

    // Apply discount
    const discountedPrice = totalPrice - (totalPrice * discount) / 100;

    // Calculate remaining amount after paidAmount payment
    const finalRemainingAmount = Math.max(discountedPrice - parseFloat(paidAmount || 0), 0);

    // Convert provided date to moment format
    const providedDate = moment(date, "YYYY-MM-DD");
    const monthYear = providedDate.format('MMYY'); // e.g., 0325 for March 2025
    const weekNumber = Math.ceil(providedDate.date() / 7); // Determine the week of the month (1-4)

    // Find the last invoice for the same month and week
    const lastInvoice = await Invoice.findOne({
      invoiceNumber: new RegExp(`^INV-${monthYear}-${weekNumber}\\d{2}$`) // Match correct format
    }).sort({ invoiceNumber: -1 });

    // Determine the next sequence number
    let sequenceNumber = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('-'); // ["INV", "0325", "1XX"]
      const lastSeq = parseInt(parts[2].slice(1), 10); // Extract last 2-digit sequence
      sequenceNumber = isNaN(lastSeq) ? 1 : lastSeq + 1;
    }

    // Ensure the sequence does not exceed 99
    if (sequenceNumber > 99) {
      return res.status(400).json({ message: 'Invoice limit reached for this week. Please start a new week or month.' });
    }

    // Format sequence number with two digits
    const paddedSequence = String(sequenceNumber).padStart(2, '0');

    // Generate the final invoice number
    const invoiceNumber = `INV-${monthYear}-${weekNumber}${paddedSequence}`;

    // Create a new invoice
    // Build invoice data, only include clientPhone if provided
    const invoiceData = {
      clientName,
      clientAddress,
      postCode,
      paymentOption,
      category,
      services,
      paidAmount,
      discount,
      numberOfServices: services.length,
      totalPrice: discountedPrice,
      remainingAmount: finalRemainingAmount,
      invoiceNumber,
      createdAt: providedDate.toDate() // Use provided date instead of system date
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
    console.log("Incoming Request Data:", req.body);
    console.log("Invoice ID:", req.params.invoiceId);

    const { paidAmount, referenceNumber, paidDate } = req.body;

    // Find invoice using invoiceNumber (not _id)
    const invoice = await Invoice.findOne({ invoiceNumber: req.params.invoiceId });

    if (!invoice) {
      console.log("Invoice not found");
      return res.status(404).json({ message: 'Invoice not found' });
    }

    console.log("Existing Invoice Data:", invoice);

    // Calculate new remaining amount
    const newPaidAmount = invoice.paidAmount + paidAmount;
    const newRemainingAmount = invoice.totalPrice - newPaidAmount;

    console.log("New Paid Amount:", newPaidAmount);
    console.log("New Remaining Amount:", newRemainingAmount);

    let updateFields = {
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount
    };

    // If payment is fully completed, store reference number and paid date
    if (newRemainingAmount === 0) {
      updateFields.referenceNumber = referenceNumber;
      updateFields.paidDate = paidDate;
    }

    console.log("Updated Fields:", updateFields);

    // Update the invoice
    const updatedInvoice = await Invoice.findOneAndUpdate(
      { invoiceNumber: req.params.invoiceId }, // Find by invoiceNumber
      { $set: updateFields },
      { new: true }
    );

    console.log("Updated Invoice Data:", updatedInvoice);

    res.json({ message: 'Payment updated successfully', updatedInvoice });

  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({ message: 'Server error', error });
  }
};
