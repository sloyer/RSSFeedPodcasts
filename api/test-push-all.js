// api/test-push-all.js - Send test notification to all users (or filter by platform)
import { supabase } from '../lib/supabaseClient.js';
import fetch from 'node-fetch';

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

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
    const { platform, title, body } = req.body;
    
    // Get all active push tokens
    let query = supabase
      .from('push_tokens')
      .select('expo_push_token, platform')
      .eq('is_active', true);
    
    // Filter by platform if specified
    if (platform) {
      query = query.eq('platform', platform);
    }
    
    const { data: tokens, error } = await query;
    
    if (error) throw error;
    
    if (!tokens || tokens.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active push tokens found',
        sent: 0
      });
    }
    
    console.log(`Sending test notification to ${tokens.length} devices${platform ? ` (${platform} only)` : ''}`);
    
    // Build messages
    const messages = tokens.map(t => ({
      to: t.expo_push_token,
      title: title || 'Test Notification',
      body: body || 'This is a test from your backend!',
      sound: 'default',
      badge: 1,
      priority: 'high',
      channelId: 'default'
    }));
    
    // Send in chunks of 100
    const chunks = chunkArray(messages, 100);
    let totalSent = 0;
    
    for (const chunk of chunks) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(chunk)
      });
      
      if (response.ok) {
        totalSent += chunk.length;
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Sent test notification to ${totalSent} devices`,
      platform: platform || 'all',
      sent: totalSent
    });
    
  } catch (error) {
    console.error('Test push error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

