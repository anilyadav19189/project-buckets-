// Storage layer for commercial enquiries, backed by Netlify Blobs.
// Netlify Blobs is built into every Netlify site — no separate database
// account or credentials are required. Data is automatically scoped to
// this site's deploys.
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'commercial-enquiries';

export const ALLOWED_STATUSES = [
  'New',
  'Contacted',
  'Quotation Sent',
  'Negotiation',
  'Won',
  'Lost',
];

function store() {
  return getStore({
    name: STORE_NAME,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN,
  });
}

export async function saveEnquiry(enquiry) {
  await store().setJSON(enquiry.id, enquiry);
  return enquiry;
}

export async function listEnquiries() {
  const s = store();
  const { blobs } = await s.list();
  const items = await Promise.all(
    blobs.map((b) => s.get(b.key, { type: 'json' }))
  );
  return items
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getEnquiry(id) {
  return store().get(id, { type: 'json' });
}

export async function updateEnquiryStatus(id, status) {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const s = store();
  const existing = await s.get(id, { type: 'json' });
  if (!existing) {
    throw new Error('Enquiry not found');
  }
  existing.status = status;
  existing.updatedAt = new Date().toISOString();
  await s.setJSON(id, existing);
  return existing;
}
