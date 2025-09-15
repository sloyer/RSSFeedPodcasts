// api/add-youtube-channel.js - Add YouTube channels dynamically
import { addYouTubeChannel } from '../lib/fetchYouTubeVideos.js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic authentication (you can enhance this)
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.ADMIN_SECRET}`;
  
  if (process.env.ADMIN_SECRET && authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { handle, displayName } = req.body;

    if (!handle) {
      return res.status(400).json({ error: 'YouTube handle is required' });
    }

    // Validate handle format
    const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;

    const result = await addYouTubeChannel(cleanHandle, displayName);

    res.status(200).json({
      success: true,
      message: result.message,
      channelId: result.channelId,
      handle: cleanHandle,
      displayName: displayName
    });

  } catch (error) {
    console.error('Error adding YouTube channel:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add YouTube channel'
    });
  }
}
