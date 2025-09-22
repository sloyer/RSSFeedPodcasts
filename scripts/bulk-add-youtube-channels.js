// scripts/bulk-add-youtube-channels.js - Bulk add YouTube channels from URL list
import fetch from 'node-fetch';

const API_BASE = 'https://rss-feed-podcasts.vercel.app/api';
// const API_BASE = 'http://localhost:3000/api'; // Use for local testing

const CHANNEL_URLS = [
  'https://www.youtube.com/@themotoacademyYT',
  'https://www.youtube.com/@motocross',
  'https://www.youtube.com/@supermotocross',
  'https://www.youtube.com/@MXGB-TV',
  'https://www.youtube.com/@SupercrossLive',
  'https://www.youtube.com/@AmericanMotocross',
  'https://www.youtube.com/@mattburkeen820',
  'https://www.youtube.com/@DNXShow',
  'https://www.youtube.com/@nitrocircus',
  'https://www.youtube.com/@CarsonBrown910',
  'https://www.youtube.com/@DirtBikeMagazine',
  'https://www.youtube.com/@vurbmoto',
  'https://www.youtube.com/@KevinHorgmo24',
  'https://www.youtube.com/@LiveMotocross',
  'https://www.youtube.com/@Deegan38',
  'https://www.youtube.com/@441motocross',
  'https://www.youtube.com/@RacerXVideoVault',
  'https://www.youtube.com/@motofevermedia1',
  'https://www.youtube.com/@motocrossaction',
  'https://www.youtube.com/@PaigeChristianCraig',
  'https://www.youtube.com/@maineventmoto',
  'https://www.youtube.com/@RotoMoto',
  'https://www.youtube.com/@ClubMX',
  'https://www.youtube.com/@Keeferinctesting/',
  'https://www.youtube.com/@TwoTwo_TV',
  'https://www.youtube.com/@CboysTV',
  'https://www.youtube.com/@ashsowman',
  'https://www.youtube.com/@StartYourSystems',
  'https://www.youtube.com/@buttery_films_',
  'https://www.youtube.com/@JaumeSolerMovies',
  'https://www.youtube.com/@channel199official',
  'https://www.youtube.com/@DIRTRACKR',
  'https://www.youtube.com/@ThisisLawrence',
  'https://www.youtube.com/@deanwilson3194',
  'https://www.youtube.com/@chasesexton4',
  'https://www.youtube.com/@adamcianciarulo277/videos',
  'https://www.youtube.com/@AxellHodges96/videos',
  'https://www.youtube.com/@TylerBereman653',
  'https://www.youtube.com/@raha/videos',
  'https://www.youtube.com/GrahamJarvis/videos',
  'https://www.youtube.com/channel/UC2Jhqbj1NKCMdR0ky8mVvSw'
];

async function addChannel(url) {
  try {
    console.log(`🔍 Processing: ${url}`);
    
    const response = await fetch(`${API_BASE}/add-youtube-channel-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        is_active: true
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Added: ${result.data.display_name} (${result.data.channel_id})`);
      return { success: true, channel: result.data };
    } else {
      console.log(`❌ Failed: ${result.error}`);
      return { success: false, error: result.error, url };
    }
    
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
    return { success: false, error: error.message, url };
  }
}

async function bulkAddChannels() {
  console.log(`🚀 Starting bulk YouTube channel import...`);
  console.log(`📊 Total channels to process: ${CHANNEL_URLS.length}`);
  console.log(`🌐 API endpoint: ${API_BASE}/add-youtube-channel-url`);
  console.log('');
  
  const results = {
    added: [],
    failed: [],
    duplicates: []
  };
  
  // Process channels with delay to be nice to APIs
  for (let i = 0; i < CHANNEL_URLS.length; i++) {
    const url = CHANNEL_URLS[i];
    
    console.log(`\n[${i + 1}/${CHANNEL_URLS.length}] Processing channel...`);
    
    const result = await addChannel(url);
    
    if (result.success) {
      results.added.push(result.channel);
    } else {
      if (result.error.includes('already exists')) {
        results.duplicates.push({ url, error: result.error });
      } else {
        results.failed.push({ url, error: result.error });
      }
    }
    
    // Small delay between requests
    if (i < CHANNEL_URLS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 BULK IMPORT COMPLETE!');
  console.log('='.repeat(60));
  console.log(`✅ Successfully added: ${results.added.length} channels`);
  console.log(`🔄 Already existed: ${results.duplicates.length} channels`);
  console.log(`❌ Failed: ${results.failed.length} channels`);
  console.log(`📊 Total processed: ${CHANNEL_URLS.length} URLs`);
  
  if (results.added.length > 0) {
    console.log('\n📺 NEW CHANNELS ADDED:');
    results.added.forEach(channel => {
      console.log(`  • ${channel.display_name} (@${channel.handle.replace('@', '')})`);
    });
  }
  
  if (results.duplicates.length > 0) {
    console.log('\n🔄 DUPLICATE CHANNELS (already in database):');
    results.duplicates.forEach(item => {
      console.log(`  • ${item.url}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED CHANNELS:');
    results.failed.forEach(item => {
      console.log(`  • ${item.url} - ${item.error}`);
    });
  }
  
  console.log('\n🎬 Next steps:');
  console.log('1. Check /api/videos/channels to see all channels');
  console.log('2. Use /api/trigger-video-pull to fetch initial videos');
  console.log('3. Regular cron job will keep them updated');
  
  return results;
}

// Run the bulk import
bulkAddChannels()
  .then(results => {
    console.log('\n✨ Bulk import finished successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Bulk import failed:', error);
    process.exit(1);
  });
