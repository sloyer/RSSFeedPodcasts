// debug-db.js - Examine Supabase database structure
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function examineDatabase() {
  console.log('🔍 Examining Supabase database structure...\n');
  
  try {
    // 1. Check articles table
    console.log('📰 ARTICLES TABLE:');
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('company')
      .limit(10);
    
    if (articlesError) {
      console.error('❌ Articles error:', articlesError);
    } else {
      const uniqueCompanies = [...new Set(articles.map(a => a.company))];
      console.log(`   Found ${articles.length} articles`);
      console.log(`   Unique companies: ${uniqueCompanies.join(', ')}`);
    }
    
    // 2. Check podcasts table
    console.log('\n🎙️ PODCASTS TABLE:');
    const { data: podcasts, error: podcastsError } = await supabase
      .from('podcasts')
      .select('podcast_name')
      .limit(10);
    
    if (podcastsError) {
      console.error('❌ Podcasts error:', podcastsError);
    } else {
      const uniquePodcasts = [...new Set(podcasts.map(p => p.podcast_name))];
      console.log(`   Found ${podcasts.length} podcasts`);
      console.log(`   Unique podcast names: ${uniquePodcasts.slice(0, 5).join(', ')}${uniquePodcasts.length > 5 ? '...' : ''}`);
    }
    
    // 3. Check motocross_feeds table
    console.log('\n🏍️ MOTOCROSS_FEEDS TABLE:');
    const { data: mxFeeds, error: mxFeedsError } = await supabase
      .from('motocross_feeds')
      .select('*')
      .limit(5);
    
    if (mxFeedsError) {
      console.error('❌ Motocross feeds error:', mxFeedsError);
    } else {
      console.log(`   Found ${mxFeeds.length} feeds`);
      console.log('   Sample feed:', JSON.stringify(mxFeeds[0], null, 2));
    }
    
    // 4. Check rss_feeds table
    console.log('\n📡 RSS_FEEDS TABLE:');
    const { data: rssFeeds, error: rssFeedsError } = await supabase
      .from('rss_feeds')
      .select('*')
      .limit(5);
    
    if (rssFeedsError) {
      console.error('❌ RSS feeds error:', rssFeedsError);
    } else {
      console.log(`   Found ${rssFeeds.length} feeds`);
      console.log('   Sample feed:', JSON.stringify(rssFeeds[0], null, 2));
    }
    
    // 5. Check youtube_channels table
    console.log('\n📺 YOUTUBE_CHANNELS TABLE:');
    const { data: ytChannels, error: ytError } = await supabase
      .from('youtube_channels')
      .select('*')
      .limit(5);
    
    if (ytError) {
      console.error('❌ YouTube channels error:', ytError);
    } else {
      console.log(`   Found ${ytChannels.length} channels`);
      if (ytChannels[0]) {
        console.log('   Sample channel:', JSON.stringify(ytChannels[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('💥 Database examination failed:', error);
  }
}

examineDatabase();
