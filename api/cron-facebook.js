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
  // Only consider content from the last 2 hours (buffer for cron gaps)
  return d > new Date(Date.now() - 2 * 60 * 60 * 1000);
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

async function storiesTodayCount() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('sent_fb_posts')
    .select('id', { count: 'exact', head: true })
    .eq('content_type', 'story')
    .gte('posted_at', startOfDay.toISOString());
  return count || 0;
}

async function postStoryToFacebook(item) {
  if (!PAGE_ID || !TOKEN || !item.image) return;

  const storyContentId = `story_${item.id}`;
  if (await alreadyPosted(storyContentId, item.feedName)) {
    console.log(`[FB STORY] Already posted story for: ${item.title.substring(0, 40)}`);
    return;
  }

  try {
    // Step 1: Upload the image to Facebook (unpublished)
    const uploadRes = await fetch(
      `https://graph.facebook.com/v21.0/${PAGE_ID}/photos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: item.image,
          published: false,
          access_token: TOKEN
        })
      }
    );
    const uploadData = await uploadRes.json();
    if (!uploadData.id) {
      console.error(`[FB STORY] ❌ Photo upload failed:`, JSON.stringify(uploadData).substring(0, 200));
      return;
    }

    // Step 2: Create the story using the uploaded photo ID
    const storyRes = await fetch(
      `https://graph.facebook.com/v21.0/${PAGE_ID}/photo_stories`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_id: uploadData.id,
          access_token: TOKEN
        })
      }
    );
    const storyData = await storyRes.json();

    if (storyRes.ok && storyData.success) {
      console.log(`[FB STORY] ✅ Posted story for: ${item.title.substring(0, 50)}`);
      await supabase.from('sent_fb_posts').insert({
        content_id: storyContentId,
        content_type: 'story',
        feed_name: item.feedName,
        title: item.title,
        fb_post_id: uploadData.id,
        posted_at: new Date().toISOString()
      });
    } else {
      console.error(`[FB STORY] ❌ Story creation failed:`, JSON.stringify(storyData).substring(0, 200));
    }
  } catch (e) {
    console.error('[FB STORY] Error:', e.message);
  }
}

async function postToFacebook(item) {
  if (!PAGE_ID || !TOKEN) return;
  if (await alreadyPosted(item.id, item.feedName)) {
    console.log(`[FB] Already posted: ${item.title.substring(0, 40)}`);
    return;
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
  } else {
    const err = await res.text();
    console.error(`[FB] ❌ Failed (${res.status}): ${err.substring(0, 200)}`);
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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

  // Feed posts — up to 3 per cycle
  let posted = 0;
  for (const item of newContent) {
    if (posted >= 3) break;
    try {
      await postToFacebook(item);
      posted++;
    } catch (e) {
      console.error('[FB] Post error:', e.message);
    }
  }

  // Stories — videos and podcasts only, 10/day cap
  let storiesPosted = 0;
  const storiesAlreadyToday = await storiesTodayCount();
  const storiesRemaining = Math.max(0, 10 - storiesAlreadyToday);

  if (storiesRemaining > 0) {
    const storyEligible = newContent.filter(i => i.type === 'video' || i.type === 'podcast');
    for (const item of storyEligible) {
      if (storiesPosted >= storiesRemaining) break;
      try {
        await postStoryToFacebook(item);
        storiesPosted++;
      } catch (e) {
        console.error('[FB STORY] Error:', e.message);
      }
    }
  }

  return res.status(200).json({ checked: newContent.length, posted, stories_posted: storiesPosted });
}
