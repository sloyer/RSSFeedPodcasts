// scripts/migrate-youtube-channels.js - Migrate hardcoded channels to database
import { addYouTubeChannel } from '../lib/fetchYouTubeVideos.js';

// The channels that were previously hardcoded
const LEGACY_CHANNELS = [
  { handle: '@VitalMX', name: 'Vital MX' },
  { handle: '@RacerXIllustrated', name: 'Racer X' },
  { handle: '@AmericanMotocross', name: 'Pro Motocross' },
  { handle: '@supercrosslive', name: 'Monster Energy Supercross' },
  { handle: '@PulpMX', name: 'PulpMX' },
  { handle: '@Keeferinctesting', name: 'Keefer Inc Testing' },
  { handle: '@swapmotolive', name: 'Swap Moto Live' },
  { handle: '@MXVice', name: 'MX Vice' },
  { handle: '@GypsyTales', name: 'Gypsy Tales' },
  { handle: '@DirtBikeMagazine', name: 'Dirt Bike Magazine' },
  { handle: '@MotocrossActionMag', name: 'Motocross Action' },
  { handle: '@FOXracing', name: 'Fox Racing' },
  { handle: '@motoplayground', name: 'Moto Playground' },
  { handle: '@WSXOfficial', name: 'World Supercross' },
  { handle: '@teamfried8326', name: 'Team Fried' }
];

async function migrateChannels() {
  console.log('🔄 Starting YouTube channel migration...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const channel of LEGACY_CHANNELS) {
    try {
      console.log(`📺 Processing ${channel.name} (${channel.handle})...`);
      
      const result = await addYouTubeChannel(channel.handle, channel.name);
      
      if (result.success) {
        successCount++;
        console.log(`✅ ${result.message}`);
      }
      
      // Add small delay to be nice to YouTube API
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to add ${channel.name}: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Migration complete:`);
  console.log(`  ✅ Success: ${successCount} channels`);
  console.log(`  ❌ Errors: ${errorCount} channels`);
  console.log(`  📺 Total: ${LEGACY_CHANNELS.length} channels processed`);
  
  if (successCount > 0) {
    console.log(`\n🎉 ${successCount} YouTube channels are now in your database!`);
    console.log(`🔄 Next cron job will start fetching videos from these channels.`);
  }
  
  if (errorCount > 0) {
    console.log(`\n⚠️ ${errorCount} channels failed - check the errors above.`);
    console.log(`   Most common issues: Invalid handles or YouTube API limits.`);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateChannels()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { migrateChannels };
