// api/backfill-news-logos.js
// Fetches logos for all news sources in motocross_feeds.
// Uses Clearbit Logo API (free, good quality) with Google favicon as fallback.
// POST /api/backfill-news-logos         — only fill missing logos
// POST /api/backfill-news-logos?all=true — re-fetch every source
import { supabase } from '../lib/supabaseClient.js';

async function urlIsReachable(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.ok && res.status === 200;
  } catch {
    return false;
  }
}

function domainFromFeedUrl(feedUrl) {
  try {
    const url = new URL(feedUrl);
    // Strip "www.", "feeds.", "rss." prefixes for a cleaner root domain
    return url.hostname
      .replace(/^(www\.|feeds\.|rss\.|news\.)/, '');
  } catch {
    return null;
  }
}

async function fetchLogo(domain) {
  // 1. Try Clearbit first — best quality, square logos
  const clearbitUrl = `https://logo.clearbit.com/${domain}`;
  if (await urlIsReachable(clearbitUrl)) {
    return clearbitUrl;
  }

  // 2. Google favicon service — always returns something at 128px
  const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  return googleUrl;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const refetchAll = req.query.all === 'true';

    let query = supabase
      .from('motocross_feeds')
      .select('id, company_name, feed_url, logo_url')
      .eq('is_active', true);

    if (!refetchAll) {
      query = query.or('logo_url.is.null,logo_url.eq.');
    }

    const { data: feeds, error } = await query;
    if (error) throw error;

    if (!feeds || feeds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All news sources already have logos',
        updated: 0,
        total: 0
      });
    }

    const results = { updated: 0, skipped: 0, errors: [] };

    for (const feed of feeds) {
      const domain = domainFromFeedUrl(feed.feed_url);
      if (!domain) {
        results.errors.push(`${feed.company_name}: Could not parse domain from ${feed.feed_url}`);
        continue;
      }

      try {
        const logoUrl = await fetchLogo(domain);

        const { error: updateError } = await supabase
          .from('motocross_feeds')
          .update({ logo_url: logoUrl })
          .eq('id', feed.id);

        if (updateError) {
          results.errors.push(`${feed.company_name}: ${updateError.message}`);
        } else {
          results.updated++;
          console.log(`✅ ${feed.company_name} (${domain}): ${logoUrl}`);
        }
      } catch (err) {
        results.errors.push(`${feed.company_name}: ${err.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Updated logos for ${results.updated} of ${feeds.length} news sources`,
      updated: results.updated,
      total: feeds.length,
      errors: results.errors.length > 0 ? results.errors : undefined
    });
  } catch (err) {
    console.error('Backfill news logos error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
