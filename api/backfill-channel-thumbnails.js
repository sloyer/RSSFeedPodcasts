// api/backfill-channel-thumbnails.js
// Fetches and stores thumbnail_url for all YouTube channels that are missing one.
// Also keeps thumbnails fresh since YouTube occasionally rotates CDN URLs.
import { supabase } from '../lib/supabaseClient.js';

const YT_API_KEY = process.env.YOUTUBE_API_KEY;
const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

async function fetchChannelThumbnails(channelIds) {
  const url = new URL(`${YT_API_BASE}/channels`);
  url.searchParams.append('key', YT_API_KEY);
  url.searchParams.append('part', 'snippet');
  url.searchParams.append('id', channelIds.join(','));
  url.searchParams.append('maxResults', '50');

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`YouTube API error: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  const map = {};
  for (const item of data.items || []) {
    const t = item.snippet?.thumbnails;
    map[item.id] =
      t?.high?.url || t?.medium?.url || t?.default?.url || null;
  }
  return map;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!YT_API_KEY) {
    return res.status(500).json({ success: false, error: 'YouTube API key not configured' });
  }

  try {
    // Fetch all active channels — optionally restrict to missing thumbnails only
    const missingOnly = req.query.missing !== 'false'; // default: only fill missing
    let query = supabase
      .from('youtube_channels')
      .select('id, channel_id, channel_title, thumbnail_url')
      .eq('is_active', true);

    if (missingOnly) {
      query = query.is('thumbnail_url', null);
    }

    const { data: channels, error: fetchError } = await query;
    if (fetchError) throw new Error(`DB fetch error: ${fetchError.message}`);

    if (!channels || channels.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All channels already have thumbnails',
        updated: 0
      });
    }

    console.log(`🖼️ Fetching thumbnails for ${channels.length} channels...`);

    // Process in batches of 50 (YouTube API limit)
    const BATCH = 50;
    let updated = 0;
    const errors = [];

    for (let i = 0; i < channels.length; i += BATCH) {
      const batch = channels.slice(i, i + BATCH);
      const ids = batch.map(c => c.channel_id);

      try {
        const thumbnailMap = await fetchChannelThumbnails(ids);

        for (const channel of batch) {
          const thumbnailUrl = thumbnailMap[channel.channel_id];
          if (!thumbnailUrl) continue;

          const { error: updateError } = await supabase
            .from('youtube_channels')
            .update({ thumbnail_url: thumbnailUrl })
            .eq('id', channel.id);

          if (updateError) {
            errors.push(`${channel.channel_title}: ${updateError.message}`);
          } else {
            updated++;
          }
        }
      } catch (batchError) {
        errors.push(`Batch ${i / BATCH + 1}: ${batchError.message}`);
      }

      // Small delay between batches
      if (i + BATCH < channels.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log(`✅ Updated ${updated} channel thumbnails`);

    return res.status(200).json({
      success: true,
      message: `Updated thumbnails for ${updated} of ${channels.length} channels`,
      updated,
      total: channels.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Backfill thumbnails error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
