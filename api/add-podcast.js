// api/add-podcast.js - Add podcast from Apple Podcasts URL
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const parser = new Parser({
  customFields: {
    feed: ['itunes:image', 'image'],
    item: ['itunes:duration', 'itunes:image', 'itunes:summary']
  }
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional auth check
  const authHeader = req.headers.authorization;
  if (process.env.ADMIN_SECRET && authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { url, appleId, displayName } = req.body;

    // Extract Apple Podcast ID from URL or use provided ID
    let podcastId = appleId;
    
    if (url && !podcastId) {
      // Extract ID from URLs like:
      // https://podcasts.apple.com/us/podcast/some-podcast/id1234567890
      // https://podcasts.apple.com/kw/podcast/inside-the-rig/id1862222625
      const match = url.match(/\/id(\d+)/);
      if (match) {
        podcastId = match[1];
      }
    }

    if (!podcastId) {
      return res.status(400).json({ 
        error: 'Could not extract podcast ID. Provide Apple Podcasts URL or appleId' 
      });
    }

    console.log(`[ADD-PODCAST] Looking up Apple Podcast ID: ${podcastId}`);

    // Lookup podcast via iTunes API
    const lookupRes = await fetch(
      `https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`
    );
    const lookupData = await lookupRes.json();

    if (!lookupData.results || lookupData.results.length === 0) {
      return res.status(404).json({ error: 'Podcast not found on Apple Podcasts' });
    }

    const podcast = lookupData.results[0];
    const feedUrl = podcast.feedUrl;
    const podcastName = displayName || podcast.collectionName;

    if (!feedUrl) {
      return res.status(400).json({ error: 'No RSS feed found for this podcast' });
    }

    console.log(`[ADD-PODCAST] Found: ${podcastName}`);
    console.log(`[ADD-PODCAST] Feed URL: ${feedUrl}`);

    // Check if already exists
    const { data: existing } = await supabase
      .from('rss_feeds')
      .select('id, feed_name')
      .eq('feed_url', feedUrl)
      .single();

    if (existing) {
      return res.status(200).json({
        success: true,
        message: `Podcast "${existing.feed_name}" already exists`,
        alreadyExists: true,
        feedUrl: feedUrl
      });
    }

    // Fetch and parse RSS feed
    console.log(`[ADD-PODCAST] Fetching RSS feed...`);
    const feed = await parser.parseURL(feedUrl);

    // Add to rss_feeds table
    const { error: feedError } = await supabase
      .from('rss_feeds')
      .insert({
        feed_url: feedUrl,
        feed_name: podcastName,
        display_name: podcastName,
        description: podcast.collectionName ? `${podcast.artistName} - ${feed.description || ''}`.substring(0, 500) : '',
        category: 'podcast',
        image_url: podcast.artworkUrl600 || podcast.artworkUrl100 || feed.itunes?.image || '',
        is_active: true
      });

    if (feedError) {
      console.error('[ADD-PODCAST] Feed insert error:', feedError);
      return res.status(500).json({ error: 'Failed to add podcast feed: ' + feedError.message });
    }

    // Insert episodes
    const episodes = feed.items.slice(0, 50).map(item => ({
      podcast_name: podcastName,
      podcast_title: item.title,
      podcast_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      podcast_description: item.contentSnippet || item['itunes:summary'] || item.content || '',
      podcast_image: item['itunes:image']?.href || podcast.artworkUrl600 || podcast.artworkUrl100 || '',
      audio_url: item.enclosure?.url || '',
      feed_url: feedUrl,
      guid: item.guid || item.link || `${feedUrl}-${item.title}`
    }));

    const { data: insertedEpisodes, error: episodesError } = await supabase
      .from('podcasts')
      .upsert(episodes, { onConflict: 'guid' })
      .select();

    if (episodesError) {
      console.error('[ADD-PODCAST] Episodes insert error:', episodesError);
      return res.status(500).json({ error: 'Failed to add episodes: ' + episodesError.message });
    }

    console.log(`[ADD-PODCAST] ✅ Added ${insertedEpisodes.length} episodes`);

    return res.status(200).json({
      success: true,
      message: `Added "${podcastName}" with ${insertedEpisodes.length} episodes`,
      podcast: {
        name: podcastName,
        feedUrl: feedUrl,
        episodeCount: insertedEpisodes.length,
        artwork: podcast.artworkUrl600 || podcast.artworkUrl100
      }
    });

  } catch (error) {
    console.error('[ADD-PODCAST] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add podcast'
    });
  }
}

