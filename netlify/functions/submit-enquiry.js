import crypto from 'node:crypto';
import { saveEnquiry } from './lib/store.js';
import { sendWhatsAppNotification } from './lib/whatsapp.js';
import { sendEmailNotification } from './lib/email.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function badRequest(message) {
  return {
    statusCode: 400,
    headers: JSON_HEADERS,
    body: JSON.stringify({ ok: false, error: message }),
  };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }

  // Honeypot: a hidden field real users never fill in. Bots that fill
  // every field will trip this, and we silently pretend success so
  // they don't learn to avoid it.
  if (data.website) {
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: true }),
    };
  }

  const required = [
    ['customerName', 'Customer name'],
    ['companyName', 'Company name'],
    ['phone', 'Phone number'],
    ['email', 'Email address'],
    ['product', 'Product name'],
    ['quantity', 'Quantity required'],
    ['location', 'Customer location'],
  ];
  for (const [key, label] of required) {
    if (!data[key] || !String(data[key]).trim()) {
      return badRequest(`${label} is required`);
    }
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(data.email)) {
    return badRequest('Please provide a valid email address');
  }

  const now = new Date();
  const enquiry = {
    id: crypto.randomUUID(),
    customerName: String(data.customerName).trim(),
    companyName: String(data.companyName).trim(),
    phone: String(data.phone).trim(),
    email: String(data.email).trim(),
    product: String(data.product).trim(),
    quantity: String(data.quantity).trim(),
    location: String(data.location).trim(),
    message: data.message ? String(data.message).trim() : '',
    status: 'New',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  try {
    await saveEnquiry(enquiry);
  } catch (err) {
    console.error('[submit-enquiry] Failed to save enquiry:', err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, error: 'Could not save enquiry. Please try again.' }),
    };
  }

  // Fire notifications concurrently. Neither one failing should block
  // the customer's success confirmation — the enquiry is already saved
  // and visible in the admin dashboard either way.
  const [whatsapp, email] = await Promise.all([
    sendWhatsAppNotification(enquiry).catch((err) => {
      console.error('[submit-enquiry] WhatsApp notification error:', err);
      return { sent: false, reason: 'exception' };
    }),
    sendEmailNotification(enquiry).catch((err) => {
      console.error('[submit-enquiry] Email notification error:', err);
      return { sent: false, reason: 'exception' };
    }),
  ]);

  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      ok: true,
      message:
        'Thank you! Your enquiry has been received. Our sales team will contact you shortly.',
      notifications: { whatsapp: whatsapp.sent, email: email.sent },
    }),
  };
};
