// Sales/admin email notification, sent via the Resend API
// (https://resend.com — free tier available, simple REST API, no SMTP
// server to manage). Swap the fetch call below for SendGrid/SMTP/etc.
// if you prefer a different provider — the enquiry data shape stays
// the same.
//
// REQUIRED ENVIRONMENT VARIABLES:
//   RESEND_API_KEY   Your Resend API key
//   SALES_EMAIL      The inbox that should receive new-enquiry alerts
//
// OPTIONAL:
//   EMAIL_FROM       Verified "From" address, e.g.
//                     "BUCKETS.COM Enquiries <enquiries@yourdomain.com>"
//                     Defaults to Resend's shared test sender, which only
//                     works for quick testing — verify your own domain
//                     in Resend before going live.

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildEmailHtml(enquiry) {
  const row = (label, value) =>
    `<tr><td style="padding:6px 12px;color:#63747a;font:13px Arial">${label}</td><td style="padding:6px 12px;font:13px Arial;font-weight:bold">${escapeHtml(
      value || '-'
    )}</td></tr>`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#102b37">🔔 New Commercial Enquiry</h2>
      <table style="border-collapse:collapse;width:100%">
        ${row('Company', enquiry.companyName)}
        ${row('Customer', enquiry.customerName)}
        ${row('Phone', enquiry.phone)}
        ${row('Email', enquiry.email)}
        ${row('Product', enquiry.product)}
        ${row('Quantity', enquiry.quantity)}
        ${row('Location', enquiry.location)}
        ${row('Date & time', enquiry.createdAt)}
      </table>
      <p style="font:13px Arial;color:#193d4c"><strong>Message:</strong><br>${escapeHtml(
        enquiry.message || '(none provided)'
      )}</p>
      <p style="font:12px Arial;color:#63747a">Please follow up with the customer.</p>
    </div>
  `;
}

export async function sendEmailNotification(enquiry) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = (process.env.SALES_EMAIL || '').trim().replace(/['"]/g, '');
  const fromEmail =
    process.env.EMAIL_FROM || 'BUCKETS.COM Enquiries <onboarding@resend.dev>';

  if (!apiKey || !toEmail) {
    console.warn(
      '[email] Not configured — skipping notification. Set RESEND_API_KEY and SALES_EMAIL in Netlify environment variables.'
    );
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `New Commercial Enquiry — ${enquiry.companyName}`,
        html: buildEmailHtml(enquiry),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[email] Send failed:', JSON.stringify(data));
      return { sent: false, reason: 'api_error', details: data };
    }
    return { sent: true, details: data };
  } catch (err) {
    console.error('[email] Request error:', err);
    return { sent: false, reason: 'network_error' };
  }
}
