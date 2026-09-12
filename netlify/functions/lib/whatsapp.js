// WhatsApp Business notification via the official Meta WhatsApp Cloud API.
//
// REQUIRED ENVIRONMENT VARIABLES (set in Netlify → Site settings →
// Environment variables — never hard-code these):
//   WHATSAPP_ACCESS_TOKEN     Permanent access token for your Meta app
//   WHATSAPP_PHONE_NUMBER_ID  The "Phone number ID" of your WhatsApp
//                              Business sender number (Meta dashboard)
//   WHATSAPP_ADMIN_NUMBER     Number to notify, in international format
//                              with no "+" or spaces, e.g. 919381566336
//
// OPTIONAL (for business-initiated template messages — see note below):
//   WHATSAPP_TEMPLATE_NAME    Name of an approved message template
//   WHATSAPP_TEMPLATE_LANG    Template language code, e.g. "en" / "en_US"
//   WHATSAPP_SEND_MODE        "template" (default) or "text"
//
// IMPORTANT — WhatsApp session-window rule:
// The Cloud API only allows free-form text messages when the recipient
// messaged your WhatsApp number in the last 24 hours. Since this is a
// business-initiated alert (the site notifying YOU), plain text can fail
// outside that window with error code 131047. The reliable fix is to
// create and submit an approved Message Template in Meta Business
// Manager (Business Settings → WhatsApp Manager → Message Templates)
// with a body like:
//
//   🔔 NEW COMMERCIAL ENQUIRY
//   Company: {{1}}
//   Customer: {{2}}
//   Phone: {{3}}
//   Email: {{4}}
//   Product: {{5}}
//   Quantity: {{6}}
//   Location: {{7}}
//   Message: {{8}}
//
//   Please follow up with the customer.
//
// Once approved, set WHATSAPP_TEMPLATE_NAME / WHATSAPP_TEMPLATE_LANG and
// this helper will use it automatically. Until then it falls back to a
// plain text message, which works only if you have messaged your own
// WhatsApp Business number within the last 24 hours (fine for testing).

const GRAPH_VERSION = 'v20.0';

function buildTextBody(enquiry) {
  return [
    '🔔 NEW COMMERCIAL ENQUIRY',
    `Company: ${enquiry.companyName}`,
    `Customer: ${enquiry.customerName}`,
    `Phone: ${enquiry.phone}`,
    `Email: ${enquiry.email}`,
    `Product: ${enquiry.product}`,
    `Quantity: ${enquiry.quantity}`,
    `Location: ${enquiry.location}`,
    'Message:',
    enquiry.message || '(none provided)',
    '',
    'Please follow up with the customer.',
  ].join('\n');
}

export async function sendWhatsAppNotification(enquiry) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const toNumber = process.env.WHATSAPP_ADMIN_NUMBER || '919381566336';

  if (!token || !phoneNumberId) {
    console.warn(
      '[whatsapp] Not configured — skipping notification. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Netlify environment variables.'
    );
    return { sent: false, reason: 'not_configured' };
  }

  const mode = (process.env.WHATSAPP_SEND_MODE || 'template').toLowerCase();
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';

  let payload;
  if (mode === 'template' && templateName) {
    payload = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: enquiry.companyName || '-' },
              { type: 'text', text: enquiry.customerName || '-' },
              { type: 'text', text: enquiry.phone || '-' },
              { type: 'text', text: enquiry.email || '-' },
              { type: 'text', text: enquiry.product || '-' },
              { type: 'text', text: enquiry.quantity || '-' },
              { type: 'text', text: enquiry.location || '-' },
              { type: 'text', text: enquiry.message || 'N/A' },
            ],
          },
        ],
      },
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'text',
      text: { body: buildTextBody(enquiry), preview_url: false },
    };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error('[whatsapp] Send failed:', JSON.stringify(data));
      return { sent: false, reason: 'api_error', details: data };
    }
    return { sent: true, details: data };
  } catch (err) {
    console.error('[whatsapp] Request error:', err);
    return { sent: false, reason: 'network_error' };
  }
}
