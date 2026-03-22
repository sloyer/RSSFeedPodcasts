// api/backfill-articles.js - Trigger a historical backfill of motocross news articles
import { fetchMotocrossFeeds } from '../lib/fetchMotocrossFeeds.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const days = parseInt(req.query.days || '7', 10);
  if (isNaN(days) || days < 1 || days > 60) {
    return res.status(400).json({ error: 'days must be a number between 1 and 60.' });
  }

  try {
    console.log(`🔄 Article backfill triggered: last ${days} days`);
    const result = await fetchMotocrossFeeds(`days:${days}`);

    return res.status(200).json({
      success: true,
      days,
      articlesProcessed: result.articlesProcessed,
      feedsSkipped: result.feedsSkipped,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Backfill error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
