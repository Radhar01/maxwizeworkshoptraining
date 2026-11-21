'use strict';

const test = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');
const report = require('../src/report');

test('monthlyTotal returns a positive number for a month with expenses', () => {
  const total = report.monthlyTotal('2026-09');
  assert.equal(typeof total, 'number');
  assert.ok(total > 0);
});

test('monthlyTotal is 0 for a month with no expenses', () => {
  assert.equal(report.monthlyTotal('2025-01'), 0);
});

test('monthlyTotal with a category never exceeds the month total', () => {
  const food = report.monthlyTotal('2026-09', { category: 'food' });
  assert.ok(food <= report.monthlyTotal('2026-09'));
});

test('byCategory groups September expenses by category label', () => {
  // Expected values worked out by hand from data/expenses.json (office-local days):
  // includes the 2026-09-01 00:40 and 2026-09-30 23:50 travel rows, the '1,250.00'
  // food row, and excludes the 2026-10-01 00:15 food row.
  assert.deepStrictEqual(report.byCategory('2026-09'), {
    'Travel': 4250,
    'Food & Dining': 2470,
    'Software': 3998,
    'Office Supplies': 4050,
    'Marketing': 9300,
    'Utilities': 3409,
  });
  assert.equal(report.monthlyTotal('2026-09'), 27477);
});

test('byCategory looks categories up once, not once per row', () => {
  const before = db.stats.queries;
  report.byCategory('2026-09');
  assert.ok(db.stats.queries - before <= 2);
});

test('sumAmounts parses comma-formatted amounts and rejects garbage', () => {
  assert.equal(report.sumAmounts([{ amount: '1,250.00' }, { amount: 50 }]), 1300);
  assert.throws(() => report.sumAmounts([{ id: 1, amount: 'abc' }]), TypeError);
});

test('findCategory treats the name as a value, not SQL', () => {
  assert.equal(db.findCategory("x' OR 'a' = 'a"), null);
  assert.equal(db.findCategory('food').label, 'Food & Dining');
});

test('reload re-reads the data file', () => {
  assert.ok(db.reload() > 0);
});

test('inRange only returns rows on or after the from date', () => {
  const rows = report.inRange(db.all(), '2026-09-01', '2026-09-30');
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.date >= '2026-09-01'));
});

test('inRange includes the to date (inclusive range)', () => {
  const rows = report.inRange([{ date: '2026-09-30' }], '2026-09-01', '2026-09-30');
  assert.equal(rows.length, 1);
});

test('isoDay keeps the office-local day for offset timestamps', () => {
  assert.equal(report.isoDay('2026-09-30T23:30:00+05:30'), '2026-09-30');
  assert.equal(report.isoDay('2026-09-01T00:40:00+05:30'), '2026-09-01');
  assert.equal(report.monthKey('2026-10-01T00:15:00+05:30'), '2026-10');
});

test('build returns the month, total and category breakdown', () => {
  const r = report.build('2026-08');
  assert.equal(r.month, '2026-08');
  assert.equal(typeof r.total, 'number');
  assert.equal(typeof r.byCategory, 'object');
});
