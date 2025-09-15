// debug-db-full.js - Get comprehensive database data
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function examineDatabase() {
  console.log('🔍 Getting comprehensive database data...\n');
  
  try {
    // Get all unique companies from articles
    console.log('📰 ALL COMPANIES IN ARTICLES:');
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('company');
    
    if (articlesError) {
      console.error('❌ Articles error:', articlesError);
    } else {
      const uniqueCompanies = [...new Set(articles.map(a => a.company))].sort();
      console.log(`   Total articles: ${articles.length}`);
      console.log(`   Unique companies (${uniqueCompanies.length}):`, uniqueCompanies);
    }
    
    // Get all unique podcast names
    console.log('\n🎙️ ALL PODCAST NAMES:');
    const { data: podcasts, error: podcastsError } = await supabase
      .from('podcasts')
      .select('podcast_name');
    
    if (podcastsError) {
      console.error('❌ Podcasts error:', podcastsError);
    } else {
      const uniquePodcasts = [...new Set(podcasts.map(p => p.podcast_name))].sort();
      console.log(`   Total podcasts: ${podcasts.length}`);
      console.log(`   Unique podcast names (${uniquePodcasts.length}):`, uniquePodcasts);
    }
    
    // Check motocross_feeds structure
    console.log('\n🏍️ MOTOCROSS_FEEDS STRUCTURE:');
    const { data: mxFeeds, error: mxFeedsError } = await supabase
      .from('motocross_feeds')
      .select('*');
    
    if (mxFeedsError) {
      console.error('❌ Motocross feeds error:', mxFeedsError);
    } else {
      console.log(`   Total feeds: ${mxFeeds.length}`);
      console.log('   Feed names:', mxFeeds.map(f => f.feed_name).sort());
      console.log('   Company names:', mxFeeds.map(f => f.company_name).sort());
    }
    
    // Check rss_feeds structure  
    console.log('\n📡 RSS_FEEDS STRUCTURE:');
    const { data: rssFeeds, error: rssFeedsError } = await supabase
      .from('rss_feeds')
      .select('*');
    
    if (rssFeedsError) {
      console.error('❌ RSS feeds error:', rssFeedsError);
    } else {
      console.log(`   Total feeds: ${rssFeeds.length}`);
      console.log('   Feed names:', rssFeeds.map(f => f.feed_name).sort());
    }
    
  } catch (error) {
    console.error('💥 Database examination failed:', error);
  }
}

examineDatabase();
