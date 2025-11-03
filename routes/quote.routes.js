// routes/quote.routes.js
const express = require('express');
const {
  createQuote,
  getQuotes,
  getQuoteByNumber,
  updateQuote,
  updateQuoteByNumber,
  deleteQuote,
  convertQuotePayload,
} = require('../controllers/quote.controller');

const router = express.Router();

// CRUD
router.post('/create', createQuote);
router.get('/', getQuotes);
router.get('/number/:quoteNumber', getQuoteByNumber);
router.put('/:id', updateQuote);                     // by Mongo _id
router.put('/number/:quoteNumber', updateQuoteByNumber); // by business key
router.delete('/:quoteNumber', deleteQuote);

// Utility
router.get('/convert/:quoteNumber', convertQuotePayload);

module.exports = router;
