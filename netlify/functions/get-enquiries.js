import { listEnquiries } from './lib/store.js';
import { requireAuth } from './lib/auth.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  if (!requireAuth(event)) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'Unauthorized' }) };
  }

  try {
    const enquiries = await listEnquiries();
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: true, enquiries }),
    };
  } catch (err) {
    console.error('[get-enquiries] Failed:', err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, error: 'Could not load enquiries' }),
    };
  }
};
