export default async function handler(req, res) {
  // Only allow in development/testing
  // Remove this check if you want to keep it available
  if (process.env.NODE_ENV === 'production' && !req.query.secret) {
    return res.status(403).json({ error: 'Not available' });
  }

  const { token, title, body } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'token parameter required' });
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title: title || 'Test Notification',
        body: body || 'This is a test from Moto Aggregate!',
        sound: 'default',
        badge: 1
      })
    });

    const result = await response.json();
    
    console.log('[TEST] Notification sent:', result);
    
    return res.status(200).json({
      success: true,
      result: result
    });
  } catch (error) {
    console.error('[TEST] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}