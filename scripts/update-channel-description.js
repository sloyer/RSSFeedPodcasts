import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const channelId = process.argv[2];
const description = process.argv[3];

if (!channelId || !description) {
  console.log('Usage: node scripts/update-channel-description.js <channel_id> "<description>"');
  process.exit(1);
}

const { data, error } = await supabase
  .from('youtube_channels')
  .update({ description })
  .eq('channel_id', channelId)
  .select()
  .single();

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} else {
  console.log(`✅ Updated: ${data.channel_title}`);
  console.log(`📝 Description: ${data.description}`);
}
