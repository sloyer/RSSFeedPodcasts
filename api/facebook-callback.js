// api/facebook-callback.js - Exchange OAuth code for page token
export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).json({ error: 'OAuth denied', detail: error });
  }

  if (!code) {
    return res.status(400).json({ error: 'No code received' });
  }

  const appId = '138597397053662';
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = 'https://rss-feed-podcasts.vercel.app/api/facebook-callback';

  if (!appSecret) {
    return res.status(500).json({ error: 'FACEBOOK_APP_SECRET not set in Vercel env vars' });
  }

  try {
    // Step 1: Exchange code for short-lived user token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.status(400).json({ error: 'Token exchange failed', detail: tokenData.error });
    }

    const shortLivedToken = tokenData.access_token;

    // Step 2: Exchange for long-lived user token
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`
    );
    const longData = await longRes.json();
    const longLivedToken = longData.access_token || shortLivedToken;

    // Step 3: Get page tokens via /me/accounts
    const accountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedToken}`
    );
    const accountsData = await accountsRes.json();

    // Find MotoXAddicts
    const motoXAddicts = accountsData.data?.find(p => p.id === '110724349003532');

    return res.status(200).json({
      success: true,
      message: motoXAddicts
        ? 'Found MotoXAddicts page token — copy FACEBOOK_PAGE_ACCESS_TOKEN value below into Vercel'
        : 'MotoXAddicts not found in your pages — check you are logged in as the right account',
      FACEBOOK_PAGE_ID: '110724349003532',
      FACEBOOK_PAGE_ACCESS_TOKEN: motoXAddicts?.access_token || null,
      all_pages: accountsData.data?.map(p => ({ name: p.name, id: p.id }))
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
