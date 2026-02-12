export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { name, email, phone, message, calculatorData } = body;

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'Name and email are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const cd = calculatorData || {};
    const fmt = (n) => {
      if (n == null) return 'N/A';
      return '$' + Math.round(Number(n)).toLocaleString('en-US');
    };

    const htmlEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #E37627; margin: 0; font-size: 24px;">New ROI Calculator Lead</h1>
        </div>

        <div style="padding: 24px; background: #fff;">
          <h2 style="color: #000; border-bottom: 2px solid #E37627; padding-bottom: 8px;">Contact Information</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold; width: 140px;">Name:</td><td style="padding: 8px;">${escapeHtml(name)}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;">${phone ? escapeHtml(phone) : 'Not provided'}</td></tr>
            ${message ? `<tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">Message:</td><td style="padding: 8px;">${escapeHtml(message)}</td></tr>` : ''}
          </table>

          <h2 style="color: #000; border-bottom: 2px solid #E37627; padding-bottom: 8px; margin-top: 24px;">Calculator Results</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Property Type:</td><td style="padding: 8px;">${escapeHtml(cd.propertyType || 'N/A')}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Acreage:</td><td style="padding: 8px;">${cd.acreage || 'N/A'} acres</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Season Length:</td><td style="padding: 8px;">${cd.seasonWeeks || 'N/A'} weeks</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Maintenance Type:</td><td style="padding: 8px;">${escapeHtml(cd.maintenanceType || 'N/A')}</td></tr>
          </table>

          <h2 style="color: #000; border-bottom: 2px solid #E37627; padding-bottom: 8px; margin-top: 24px;">Key Metrics</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #FFF3E8;"><td style="padding: 12px; font-weight: bold; font-size: 16px;">Projected Annual Savings:</td><td style="padding: 12px; font-size: 18px; font-weight: bold; color: #E37627;">${fmt(cd.projectedSavings)}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">ROI:</td><td style="padding: 8px;">${cd.roi != null ? Math.round(cd.roi) + '%' : 'N/A'}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Payback Period:</td><td style="padding: 8px;">${escapeHtml(cd.paybackPeriod || 'N/A')}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Recommended Equipment:</td><td style="padding: 8px;">${escapeHtml(cd.recommendedEquipment || 'N/A')}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Total Investment:</td><td style="padding: 8px;">${fmt(cd.totalInvestment)}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Labor Hours Saved:</td><td style="padding: 8px;">${cd.laborHoursSaved != null ? Math.round(cd.laborHoursSaved).toLocaleString() + ' hrs/year' : 'N/A'}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">CO₂ Reduced:</td><td style="padding: 8px;">${cd.co2Reduced != null ? Math.round(cd.co2Reduced).toLocaleString() + ' lbs/year' : 'N/A'}</td></tr>
          </table>
        </div>

        <div style="background: #000; padding: 16px; text-align: center;">
          <p style="color: #999; margin: 0; font-size: 12px;">Autonomous Mowing Solutions | autonomousmowingsolutions.com</p>
        </div>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ROI Calculator <calculator@autonomousmowingsolutions.com>',
        to: ['nowicki@autonomousmowingsolutions.com'],
        subject: `New ROI Calculator Lead: ${name} — ${cd.propertyType || 'Property'} (${cd.acreage || '?'} acres)`,
        html: htmlEmail,
        reply_to: email,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error('Resend API error:', errText);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Lead function error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
