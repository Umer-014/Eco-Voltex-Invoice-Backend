// routes/invoiceRoutes.js
const express = require('express');
const { createInvoice, getInvoices, deleteInvoice, updatePayment, updateInvoice,getInvoiceByNumber,updateInvoiceByNumber} = require('../controllers/invoice.controller'); // Added deleteInvoice
const router = express.Router();

router.post('/create', createInvoice);
router.get('/', getInvoices);
router.delete('/:invoiceNumber', deleteInvoice); // Correct usage
router.put('/:invoiceId', updatePayment);
router.put('/:id', updateInvoice);
router.get('/number/:invoiceNumber', getInvoiceByNumber);
router.put('/number/:invoiceNumber', updateInvoiceByNumber);

module.exports = router;
