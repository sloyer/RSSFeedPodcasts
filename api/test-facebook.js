// api/test-facebook.js - Debug endpoint to test Facebook Page posting credentials
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token  = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  // Check credentials are present
  if (!pageId || !token) {
    return res.status(400).json({
      error: 'Missing credentials — add these to Vercel environment variables',
      FACEBOOK_PAGE_ID: pageId ? 'set' : 'MISSING',
      FACEBOOK_PAGE_ACCESS_TOKEN: token ? 'set' : 'MISSING'
    });
  }

  try {
    // Test 1: message only (no link) — checks if basic posting works
    const fbRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '[TEST] MotoAggregate Facebook integration test — ignore this post. https://www.motoaggregate.app',
          access_token: token
        })
      }
    );

    const body = await fbRes.json();

    return res.status(200).json({
      fb_http_status: fbRes.status,
      fb_response: body,
      success: fbRes.ok && !!body.id,
      post_url: body.id ? `https://www.facebook.com/${body.id}` : null
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
