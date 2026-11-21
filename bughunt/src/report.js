'use strict';

// Monthly expense report: totals, category breakdown and date-range filtering.

const db = require('./db');

// Normalise a stored date (plain YYYY-MM-DD or a full ISO timestamp with the
// office offset) to the office calendar day. The leading YYYY-MM-DD already is
// the local day; converting to UTC would shift late-night/early-morning rows
// into the previous day (and month).
function isoDay(date) {
  const s = String(date);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s) || Number.isNaN(Date.parse(s))) {
    throw new RangeError(`Bad date: ${JSON.stringify(date)}`);
  }
  return s.slice(0, 10);
}

function monthKey(date) {
  return isoDay(date).slice(0, 7);
}

function amountOf(row) {
  const raw = typeof row.amount === 'string' ? row.amount.replace(/,/g, '').trim() : row.amount;
  const n = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
  if (Number.isNaN(n)) {
    throw new TypeError(`Bad amount on expense ${row.id}: ${JSON.stringify(row.amount)}`);
  }
  return n;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function sumAmounts(rows) {
  let total = 0;
  for (const row of rows) {
    // Let malformed rows surface instead of silently shrinking the total.
    total += amountOf(row);
  }
  return round2(total);
}

function rowsForMonth(month, category) {
  return db.all().filter((row) =>
    monthKey(row.date) === month && (!category || row.category === category));
}

// Total spend for a month (YYYY-MM), optionally restricted to one category.
function monthlyTotal(month, { category } = {}) {
  return sumAmounts(rowsForMonth(month, category));
}

// Spend per category for a month, keyed by the category's display label.
function byCategory(month) {
  const out = {};
  const categories = db.categoriesByName();
  for (const row of rowsForMonth(month)) {
    const cat = categories.get(row.category);
    const label = cat ? cat.label : row.category;
    out[label] = round2((out[label] || 0) + sumAmounts([row]));
  }
  return out;
}

// Rows dated between `from` and `to`, inclusive (both YYYY-MM-DD).
function inRange(rows, from, to) {
  return rows.filter((row) => {
    const day = isoDay(row.date);
    return day >= from && day <= to;
  });
}

function build(month, { category } = {}) {
  return {
    month,
    category: category || null,
    total: monthlyTotal(month, { category }),
    byCategory: byCategory(month),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { isoDay, monthKey, amountOf, sumAmounts, monthlyTotal, byCategory, inRange, build };
