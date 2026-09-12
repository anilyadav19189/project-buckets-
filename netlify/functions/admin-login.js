import crypto from 'node:crypto';
import { createSessionToken } from './lib/auth.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: 'ADMIN_PASSWORD is not configured in Netlify environment variables.',
      }),
    };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'Invalid request' }) };
  }

  const supplied = Buffer.from(String(data.password || ''));
  const expected = Buffer.from(adminPassword);
  const valid =
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected);

  if (!valid) {
    return {
      statusCode: 401,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, error: 'Incorrect password' }),
    };
  }

  const token = createSessionToken();
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ ok: true, token }),
  };
};
