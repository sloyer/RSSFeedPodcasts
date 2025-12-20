// api/send-push.js - Send push notification to specific device
import fetch from 'node-fetch';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { push_token, title, body, data } = req.body;
    
    if (!push_token) {
      return res.status(400).json({ error: 'push_token is required' });
    }
    
    // Build Expo push notification
    const message = {
      to: push_token,
      title: title || 'Test Notification',
      body: body || 'This is a test push notification',
      data: data || {},
      sound: 'default',
      badge: 1,
      priority: 'high',
      channelId: 'default'
    };
    
    // Send to Expo
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(message)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Expo error: ${JSON.stringify(result)}`);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Push notification sent',
      result: result
    });
    
  } catch (error) {
    console.error('Push notification error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

