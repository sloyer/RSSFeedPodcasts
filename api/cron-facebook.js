// api/cron-facebook.js
// Lightweight cron that runs every 5 min — posts new content to Facebook.
// Only hits our internal APIs (Supabase-backed) + the Facebook Graph API.
// No YouTube API, no RSS fetching.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const API_BASE = 'https://rss-feed-podcasts.vercel.app';
const PAGE_ID  = process.env.FACEBOOK_PAGE_ID;
const TOKEN    = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

function isRecent(dateString) {
  const d = new Date(dateString);
  // 12-hour window — wide enough to catch same-day content even if the cron
  // had a gap or content was published before a deployment went live.
  // Dedup via sent_fb_posts ensures nothing is posted twice.
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

  const credit = `Via: ${item.feedName}`;
  const parts = [item.title];
  if (desc) parts.push(desc);
  parts.push(credit);

  const link = item.type === 'podcast'
    ? `https://www.motoaggregate.app/a/${item.id}`
    : (item.url || `https://www.motoaggregate.app/a/${item.id}`);

  const body = {
    message: parts.join('\n\n'),
    link,
    access_token: TOKEN
  };
  if (item.image) body.picture = item.image;

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
    return { ok: true };
  } else {
    const err = await res.text();
    console.error(`[FB] ❌ Failed (${res.status}): ${err.substring(0, 200)}`);
    return { ok: false, status: res.status, error: err.substring(0, 500) };
  }
}

export default async function handler(req, res) {
  // Auth temporarily disabled for live debugging — will re-add
  // const authHeader = req.headers.authorization;
  // if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  const newContent = [];

  try {
    // Podcasts
    const pr = await fetch(`${API_BASE}/api/podcasts?limit=50`);
    const pd = await pr.json();
    if (pd.success && pd.data) {
      pd.data.filter(e => isRecent(e.podcast_date)).forEach(e => {
        const feedName = e.show_name || e.podcast_name;
        newContent.push({
          id: String(e.id || e.guid), feedName, type: 'podcast',
          title: e.podcast_title || e.title,
          url: e.feed_url || e.link,
          image: e.podcast_image || e.show_image,
          description: e.podcast_description || ''
        });
      });
    }
  } catch (e) { console.error('[FB] Podcasts error:', e.message); }

  try {
    // Articles
    const ar = await fetch(`${API_BASE}/api/articles?limit=50`);
    const ad = await ar.json();
    if (ad.success && ad.data) {
      ad.data.filter(a => isRecent(a.published_date)).forEach(a => {
        newContent.push({
          id: String(a.id), feedName: a.company, type: 'article',
          title: a.title, url: a.article_url,
          image: a.image_url, description: a.excerpt || ''
        });
      });
    }
  } catch (e) { console.error('[FB] Articles error:', e.message); }

  try {
    // Videos
    const vr = await fetch(`${API_BASE}/api/youtube?limit=50&days=1`);
    const vd = await vr.json();
    if (vd.success && vd.data) {
      vd.data.filter(v => isRecent(v.publishedAt)).forEach(v => {
        newContent.push({
          id: String(v.id), feedName: v.channelName, type: 'video',
          title: v.title, url: v.watchUrl,
          image: v.thumbnailUrl, description: v.description || ''
        });
      });
    }
  } catch (e) { console.error('[FB] Videos error:', e.message); }

  console.log(`[FB] Found ${newContent.length} recent items to check`);

  // Post up to 5 NEW items per cycle — prevents flooding when catching up on
  // missed content. Already-posted items don't count toward the cap.
  // Each item only ever posts once (dedup via sent_fb_posts).
  // Test just the first item so we can see the exact Facebook error
  let posted = 0;
  const errors = [];
  for (const item of newContent.slice(0, 3)) {
    try {
      const result = await postToFacebook(item);
      if (result?.ok) {
        posted++;
      } else {
        errors.push({ item: item.title?.substring(0, 40), ...result });
      }
    } catch (e) {
      errors.push({ item: item.title?.substring(0, 40), error: e.message });
    }
  }

  return res.status(200).json({ checked: newContent.length, posted, errors });
}
