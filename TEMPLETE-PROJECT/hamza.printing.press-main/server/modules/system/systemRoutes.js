const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAuth } = require('../../middleware/rbac');

// GET /api/system/next-code?type=product|outlet|invoice
router.get('/next-code', requireAuth, async (req, res) => {
  const { type } = req.query;

  let prefix = '';
  let sql = '';
  if (type === 'product' || type === 'book') {
    prefix = 'BOK-';
    sql = "SELECT code as val FROM products WHERE code LIKE 'BOK-%' ORDER BY code DESC LIMIT 1";
  } else if (type === 'outlet') {
    prefix = 'OUT-';
    sql = "SELECT code as val FROM outlets WHERE code LIKE 'OUT-%' ORDER BY code DESC LIMIT 1";
  } else if (type === 'invoice') {
    prefix = 'INV-';
    sql = "SELECT invoice_number as val FROM invoices WHERE invoice_number LIKE 'INV-%' ORDER BY invoice_number DESC LIMIT 1";
  } else {
    return res.status(400).json({ error: 'Bad Request', message: "Invalid type. Must be 'product', 'outlet', or 'invoice'." });
  }

  try {
    const row = await db.get(sql);
    let nextNum = 1;
    if (row && row.val) {
      const match = row.val.match(/\d+$/);
      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }
    const paddedNum = String(nextNum).padStart(7, '0');
    const code = `${prefix}${paddedNum}`;
    res.status(200).json({ code });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
