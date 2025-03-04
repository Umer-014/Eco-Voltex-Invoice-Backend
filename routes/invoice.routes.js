// routes/invoiceRoutes.js
const express = require('express');
const { createInvoice, getInvoices, deleteInvoice, updatePayment } = require('../controllers/invoice.controller'); // Added deleteInvoice
const router = express.Router();

router.post('/create', createInvoice);
router.get('/', getInvoices);
router.delete('/:invoiceNumber', deleteInvoice); // Correct usage
router.put('/:invoiceId', updatePayment);

module.exports = router;
