// Quick script to get YouTube channel ID and uploads playlist
import dotenv from 'dotenv';
dotenv.config();

const handle = process.argv[2] || 'partzillaprmxracing';
const YT_API_KEY = process.env.YOUTUBE_API_KEY;

async function getChannelInfo(handle) {
  try {
    // Try with @ prefix removed
    const cleanHandle = handle.replace('@', '');
    
    const url = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,contentDetails&forHandle=${cleanHandle}&key=${YT_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const channel = data.items[0];
      console.log('\n✅ Channel Found!');
      console.log('━'.repeat(60));
      console.log(`Channel: ${channel.snippet.title}`);
      console.log(`Channel ID: ${channel.id}`);
      console.log(`Uploads Playlist: ${channel.contentDetails.relatedPlaylists.uploads}`);
      console.log('━'.repeat(60));
      console.log('\n📋 SQL to add to database:');
      console.log(`
UPDATE youtube_channels 
SET 
  channel_id = '${channel.id}',
  uploads_playlist_id = '${channel.contentDetails.relatedPlaylists.uploads}',
  channel_title = '${channel.snippet.title}'
WHERE handle = '@${cleanHandle}';
      `);
    } else {
      console.log('❌ Channel not found. Try a different handle.');
      if (data.error) {
        console.log('Error:', data.error.message);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getChannelInfo(handle);

