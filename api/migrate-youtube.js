// api/migrate-youtube.js - One-time migration of hardcoded channels to database
import { migrateChannels } from '../scripts/migrate-youtube-channels.js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic authentication
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.ADMIN_SECRET}`;
  
  if (process.env.ADMIN_SECRET && authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔄 Starting YouTube channel migration via API...');
    
    // Capture console output for response
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      logs.push({ type: 'log', message: args.join(' ') });
      originalLog(...args);
    };
    
    console.error = (...args) => {
      logs.push({ type: 'error', message: args.join(' ') });
      originalError(...args);
    };

    await migrateChannels();

    // Restore console
    console.log = originalLog;
    console.error = originalError;

    res.status(200).json({
      success: true,
      message: 'YouTube channel migration completed',
      logs: logs
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Migration failed'
    });
  }
}
