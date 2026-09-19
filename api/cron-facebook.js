// api/cron-facebook.js
// Lightweight cron that runs every 5 min — posts new content to Facebook.
// Only hits our internal APIs (Supabase-backed) + the Facebook Graph API.
// No YouTube API, no RSS fetching.
//
// KEY RULE: never pass `picture` when posting a `link`.
// Facebook error #100: "Only owners of the URL have the ability to specify
// the picture param." — Facebook auto-pulls the OG thumbnail from the link.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const API_BASE = 'https://rss-feed-podcasts.vercel.app';
const PAGE_ID  = process.env.FACEBOOK_PAGE_ID;
const TOKEN    = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

function isShort(video) {
  // Skip YouTube Shorts: duration ≤ 60s OR #shorts in title/description
  const title = (video.title || '').toLowerCase();
  const desc  = (video.description || '').toLowerCase();
  if (title.includes('#shorts') || desc.includes('#shorts')) return true;
  // duration is ISO 8601 (e.g. "PT58S", "PT1M2S") — parse seconds
  const dur = video.duration || '';
  const match = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (match) {
    const secs = (parseInt(match[1] || 0) * 3600)
               + (parseInt(match[2] || 0) * 60)
               + (parseInt(match[3] || 0));
    if (secs > 0 && secs <= 60) return true;
  }
  return false;
}

function isRecent(dateString) {
  const d = new Date(dateString);
  // 12-hour window — catches same-day content even across deployments/gaps.
  // Dedup via sent_fb_posts ensures nothing posts twice.
  return d > new Date(Date.now() - 12 * 60 * 60 * 1000);
}

async function alreadyPosted(contentId, feedName) {
  const { data } = await supabase
    .from('sent_fb_posts')
    .select('id')
    .eq('content_id', contentId)
    .eq('feed_name', feedName)
    .single();
  return !!data;
}

async function postToFacebook(item) {
  if (!PAGE_ID || !TOKEN) return false;
  if (await alreadyPosted(item.id, item.feedName)) {
    console.log(`[FB] Already posted: ${item.title.substring(0, 40)}`);
    return false;
  }

  const rawDesc = item.description || '';
  const desc = rawDesc.length > 200
    ? rawDesc.substring(0, 197).trimEnd() + '...'
    : rawDesc.trim();

  const parts = [item.title];
  if (desc) parts.push(desc);
  parts.push(`Via: ${item.feedName}`);

  const link = item.type === 'podcast'
    ? `https://www.motoaggregate.app/a/${item.id}`
    : (item.url || `https://www.motoaggregate.app/a/${item.id}`);

  // Do NOT include `picture` — Facebook only allows the URL owner to override
  // the thumbnail. Facebook will auto-pull the OG image from `link` instead.
  const body = {
    message: parts.join('\n\n'),
    link,
    access_token: TOKEN
  };

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${PAGE_ID}/feed`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (res.ok) {
    const data = await res.json();
    console.log(`[FB] ✅ Posted: ${item.title.substring(0, 50)} → ${data.id}`);
    await supabase.from('sent_fb_posts').insert({
      content_id: item.id,
      content_type: item.type,
      feed_name: item.feedName,
      title: item.title,
      fb_post_id: data.id,
      posted_at: new Date().toISOString()
    });
    return true;
  } else {
    const err = await res.text();
    console.error(`[FB] ❌ Failed (${res.status}): ${err.substring(0, 300)}`);
    return false;
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const newContent = [];

  try {
    const pr = await fetch(`${API_BASE}/api/podcasts?limit=50`);
    const pd = await pr.json();
    if (pd.success && pd.data) {
      pd.data.filter(e => isRecent(e.podcast_date)).forEach(e => {
        newContent.push({
          id: String(e.id || e.guid),
          feedName: e.show_name || e.podcast_name,
          type: 'podcast',
          title: e.podcast_title || e.title,
          url: e.feed_url || e.link,
          description: e.podcast_description || ''
        });
      });
    }
  } catch (e) { console.error('[FB] Podcasts error:', e.message); }

  try {
    const ar = await fetch(`${API_BASE}/api/articles?limit=50`);
    const ad = await ar.json();
    if (ad.success && ad.data) {
      ad.data.filter(a => isRecent(a.published_date)).forEach(a => {
        newContent.push({
          id: String(a.id),
          feedName: a.company,
          type: 'article',
          title: a.title,
          url: a.article_url,
          description: a.excerpt || ''
        });
      });
    }
  } catch (e) { console.error('[FB] Articles error:', e.message); }

  try {
    const vr = await fetch(`${API_BASE}/api/youtube?limit=50&days=1`);
    const vd = await vr.json();
    if (vd.success && vd.data) {
      vd.data
        .filter(v => isRecent(v.publishedAt) && !isShort(v))
        .forEach(v => {
          newContent.push({
            id: String(v.id),
            feedName: v.channelName,
            type: 'video',
            title: v.title,
            url: v.watchUrl,
            description: v.description || ''
          });
        });
    }
  } catch (e) { console.error('[FB] Videos error:', e.message); }

  console.log(`[FB] Found ${newContent.length} recent items to check`);

  // Up to 5 NEW posts per cycle — catches up gradually without flooding.
  // Already-posted items don't count toward the cap.
  let posted = 0;
  for (const item of newContent) {
    if (posted >= 5) break;
    try {
      const didPost = await postToFacebook(item);
      if (didPost) posted++;
    } catch (e) {
      console.error('[FB] Post error:', e.message);
    }
  }

  return res.status(200).json({ checked: newContent.length, posted });
}
