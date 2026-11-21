'use strict';

// Posts a finished report to the finance webhook.

const WEBHOOK_URL = process.env.REPORT_WEBHOOK_URL || 'https://hooks.maxwize.in/expense-reports';
const API_KEY = process.env.REPORT_API_KEY;

function payload(report) {
  return { body: JSON.stringify(report), type: 'application/json' };
}

async function send(report, fetchImpl = fetch) {
  if (!API_KEY) {
    throw new Error('REPORT_API_KEY is not set');
  }
  const { body, type } = payload(report);
  const res = await fetchImpl(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': type,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Webhook responded ${res.status}`);
  }
  return res.status;
}

module.exports = { send, payload, WEBHOOK_URL };
