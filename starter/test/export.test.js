const { test, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Work on a temp copy of the data so tests never touch data/expenses.json
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'expenses-')), 'expenses.json');
fs.copyFileSync(path.join(__dirname, '..', 'data', 'expenses.json'), tmp);
process.env.EXPENSES_FILE = tmp;

const app = require('../src/app');
const server = app.listen(0);
after(() => server.close());

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ port: server.address().port, path: urlPath }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        const parsed = res.headers['content-type']?.includes('json') ? JSON.parse(body) : body;
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    }).on('error', reject);
  });
}

const SEPT = '/expenses/export.csv?from=2026-09-01&to=2026-09-30';
const lines = (csv) => csv.split('\n').filter((l) => l !== '');

test('export.csv returns header and 18 September rows in date order', async () => {
  const res = await get(SEPT);
  assert.strictEqual(res.status, 200);
  const all = lines(res.body);
  assert.strictEqual(all[0], 'date,category,amount,note');
  const rows = all.slice(1);
  assert.strictEqual(rows.length, 18);
  const dates = rows.map((r) => r.slice(0, 10));
  assert.deepStrictEqual(dates, [...dates].sort());
  assert.ok(dates.every((d) => d >= '2026-09-01' && d <= '2026-09-30'));
});

test('export.csv quotes a note that contains a comma', async () => {
  const res = await get(SEPT);
  const row = lines(res.body).find((l) => l.startsWith('2026-09-05') && l.includes('Groceries'));
  assert.ok(row, 'groceries row present');
  assert.ok(row.endsWith(',"Groceries: rice, dal, oil"'), row);
});

test('export.csv sets CSV content type and attachment filename', async () => {
  const res = await get(SEPT);
  assert.match(res.headers['content-type'], /^text\/csv; charset=utf-8/);
  assert.strictEqual(
    res.headers['content-disposition'],
    'attachment; filename="expenses-2026-09-01-2026-09-30.csv"'
  );
});

test('export.csv rejects missing, invalid or reversed dates with 400', async () => {
  const bad = [
    '/expenses/export.csv?from=2026-09-01',
    '/expenses/export.csv?to=2026-09-30',
    '/expenses/export.csv?from=2026-13-45&to=2026-09-30',
    '/expenses/export.csv?from=2026-02-30&to=2026-03-01',
    '/expenses/export.csv?from=2026-9-1&to=2026-09-30',
    '/expenses/export.csv?from=2026-09-01&from=2026-09-02&to=2026-09-30',
    '/expenses/export.csv?from=2026-09-30&to=2026-09-01',
  ];
  for (const p of bad) {
    const res = await get(p);
    assert.strictEqual(res.status, 400, p);
    assert.strictEqual(typeof res.body.error, 'string', p);
  }
});

test('export.csv with an empty range returns only the header', async () => {
  const res = await get('/expenses/export.csv?from=2020-01-01&to=2020-01-31');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(lines(res.body), ['date,category,amount,note']);
});

test('export.csv with from == to returns just that day', async () => {
  const res = await get('/expenses/export.csv?from=2026-09-05&to=2026-09-05');
  assert.strictEqual(res.status, 200);
  const rows = lines(res.body).slice(1);
  assert.ok(rows.length >= 1);
  assert.ok(rows.every((r) => r.startsWith('2026-09-05,')));
});
