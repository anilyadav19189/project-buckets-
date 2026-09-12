// Lightweight session tokens for the admin dashboard. No database or
// third-party auth service required — just an HMAC-signed, expiring
// token checked on the server for every admin request.
//
// REQUIRED ENVIRONMENT VARIABLES:
//   ADMIN_PASSWORD   The password used to log into /admin.html
//   SESSION_SECRET   A long random string used to sign session tokens
//                     (e.g. generate one with `openssl rand -hex 32`)
//
// Note: this is intentionally simple and suited to a single-admin
// internal tool. If several staff need individual logins and audit
// trails, consider Netlify Identity or a dedicated auth provider
// instead.
import crypto from 'node:crypto';

const SESSION_HOURS = 12;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET is not set in Netlify environment variables.'
    );
  }
  return secret;
}

export function createSessionToken() {
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = String(expires);
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifySessionToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [payload, sig] = decoded.split('.');
    if (!payload || !sig) return false;
    const expected = crypto
      .createHmac('sha256', getSecret())
      .update(payload)
      .digest('hex');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return false;
    }
    return Date.now() <= Number(payload);
  } catch {
    return false;
  }
}

export function requireAuth(event) {
  const header = event.headers.authorization || event.headers.Authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  return verifySessionToken(token);
}
