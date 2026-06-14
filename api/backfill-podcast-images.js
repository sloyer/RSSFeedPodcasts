// api/backfill-podcast-images.js
// Fetches and stores artwork for all podcast feeds missing an image_url.
import Parser from 'rss-parser';
import { supabase } from '../lib/supabaseClient.js';

const parser = new Parser({
  customFields: {
    feed: ['itunes:image', 'image']
  }
});

function extractFeedImage(feed) {
  // Priority: itunes:image > image.url > image (string)
  if (feed['itunes:image']) {
    const img = feed['itunes:image'];
    if (typeof img === 'string') return img;
    if (img?.$?.href) return img.$.href;
    if (img?.href) return img.href;
  }
  if (feed.image?.url) {
    return Array.isArray(feed.image.url) ? feed.image.url[0] : feed.image.url;
  }
  if (typeof feed.image === 'string') return feed.image;
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const missingOnly = req.query.missing !== 'false'; // default: only fill missing

    let query = supabase
      .from('rss_feeds')
      .select('id, feed_name, feed_url, image_url')
      .eq('is_active', true)
      .eq('category', 'podcast');

    if (missingOnly) {
      query = query.or('image_url.is.null,image_url.eq.');
    }

    const { data: feeds, error: fetchError } = await query;
    if (fetchError) throw new Error(`DB fetch error: ${fetchError.message}`);

    if (!feeds || feeds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All podcast feeds already have artwork',
        updated: 0
      });
    }

    console.log(`🎙️ Fetching artwork for ${feeds.length} podcast feeds...`);

    let updated = 0;
    const errors = [];

    for (const feed of feeds) {
      try {
        const parsedFeed = await Promise.race([
          parser.parseURL(feed.feed_url),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);

        const imageUrl = extractFeedImage(parsedFeed);
        if (!imageUrl) {
          errors.push(`${feed.feed_name}: no artwork found in feed`);
          continue;
        }

        const { error: updateError } = await supabase
          .from('rss_feeds')
          .update({ image_url: imageUrl })
          .eq('id', feed.id);

        if (updateError) {
          errors.push(`${feed.feed_name}: ${updateError.message}`);
        } else {
          updated++;
          console.log(`✅ ${feed.feed_name}`);
        }
      } catch (err) {
        errors.push(`${feed.feed_name}: ${err.message}`);
      }

      // Small delay to be nice to feed servers
      await new Promise(r => setTimeout(r, 200));
    }

    return res.status(200).json({
      success: true,
      message: `Updated artwork for ${updated} of ${feeds.length} podcast feeds`,
      updated,
      total: feeds.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Backfill podcast images error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
