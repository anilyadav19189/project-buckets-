import { updateEnquiryStatus, ALLOWED_STATUSES } from './lib/store.js';
import { requireAuth } from './lib/auth.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  if (!requireAuth(event)) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'Unauthorized' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'Invalid request' }) };
  }

  if (!data.id || !data.status) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'id and status are required' }) };
  }
  if (!ALLOWED_STATUSES.includes(data.status)) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` }),
    };
  }

  try {
    const updated = await updateEnquiryStatus(data.id, data.status);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true, enquiry: updated }) };
  } catch (err) {
    console.error('[update-enquiry] Failed:', err);
    return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
