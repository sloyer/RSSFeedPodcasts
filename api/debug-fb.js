// api/debug-fb.js — temporary diagnostic, delete after debugging
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const API_BASE = 'https://rss-feed-podcasts.vercel.app';
const PAGE_ID  = process.env.FACEBOOK_PAGE_ID;
const TOKEN    = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

function isRecent(dateString) {
  const d = new Date(dateString);
  return d > new Date(Date.now() - 2 * 60 * 60 * 1000);
}

export default async function handler(req, res) {
  const report = { now: new Date().toISOString(), env: {}, content: [], alreadyPosted: [], fbTest: null };

  report.env.PAGE_ID = PAGE_ID ? PAGE_ID.substring(0, 6) + '...' : 'MISSING';
  report.env.TOKEN   = TOKEN   ? TOKEN.substring(0, 10) + '...' : 'MISSING';

  // 1. What content is in the 2hr window?
  try {
    const vr = await fetch(`${API_BASE}/api/youtube?limit=20&days=1`);
    const vd = await vr.json();
    if (vd.data) {
      for (const v of vd.data.slice(0, 5)) {
        report.content.push({
          type: 'video', id: String(v.id), title: v.title?.substring(0, 50),
          publishedAt: v.publishedAt, isRecent: isRecent(v.publishedAt),
          feedName: v.channelName, hasImage: !!v.thumbnailUrl, url: v.watchUrl
        });
      }
    }
  } catch(e) { report.videoError = e.message; }

  try {
    const ar = await fetch(`${API_BASE}/api/articles?limit=10`);
    const ad = await ar.json();
    if (ad.data) {
      for (const a of ad.data.slice(0, 3)) {
        report.content.push({
          type: 'article', id: String(a.id), title: a.title?.substring(0, 50),
          publishedAt: a.published_date, isRecent: isRecent(a.published_date),
          feedName: a.company, hasImage: !!a.image_url, url: a.article_url
        });
      }
    }
  } catch(e) { report.articleError = e.message; }

  // 2. Check alreadyPosted for first recent item
  const recentItems = report.content.filter(i => i.isRecent);
  for (const item of recentItems.slice(0, 3)) {
    const { data, error } = await supabase
      .from('sent_fb_posts')
      .select('id')
      .eq('content_id', item.id)
      .eq('feed_name', item.feedName)
      .single();
    report.alreadyPosted.push({ id: item.id, feedName: item.feedName, posted: !!data, supabaseError: error?.message });
  }

  // 3. Try one real Facebook post (dry run — checks API but with published: false via message flag)
  if (recentItems.length > 0 && PAGE_ID && TOKEN) {
    const item = recentItems[0];
    const body = {
      message: `[DEBUG TEST] ${item.title}\n\nVia: ${item.feedName}`,
      link: item.url,
      access_token: TOKEN
    };
    const fbRes = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const fbData = await fbRes.json();
    report.fbTest = { status: fbRes.status, ok: fbRes.ok, response: fbData };
  }

  return res.status(200).json(report);
}
