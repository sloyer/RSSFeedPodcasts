// api/facebook-auth.js - Start Facebook OAuth flow with correct permissions
export default async function handler(req, res) {
  const appId = '138597397053662';
  const redirectUri = encodeURIComponent('https://rss-feed-podcasts.vercel.app/api/facebook-callback');
  const scope = 'pages_manage_posts,pages_read_engagement,pages_show_list';

  const url = `https://www.facebook.com/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;

  return res.redirect(302, url);
}
