#!/usr/bin/env node
// scripts/runHistoricalSync.js - Script to run historical podcast sync

import { historicalPodcastSync } from '../lib/historicalPodcastSync.js';
import dotenv from 'dotenv';

dotenv.config();

// Check if required environment variables are set
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const force = args.includes('--force') || args.includes('-f');
  
  console.log('🎙️ PulpMX & Steve Matthes Historical Podcast Sync');
  console.log('================================================');
  console.log('');
  
  if (dryRun) {
    console.log('🧪 DRY RUN MODE: No changes will be made to the database');
    console.log('   This will show you what would be synced without actually doing it');
    console.log('');
  } else if (!force) {
    console.log('⚠️  PRODUCTION MODE: This will write episodes to your database');
    console.log('   Use --dry-run to test first, or --force to confirm production run');
    console.log('');
    console.log('💡 Recommended: Run with --dry-run first to see what will be synced');
    console.log('   Example: node scripts/runHistoricalSync.js --dry-run');
    console.log('');
    process.exit(0);
  }
  
  console.log('🚀 Starting historical sync...');
  console.log('📡 Target feeds:');
  console.log('   • The Steve Matthes Show (PulpMX)');
  console.log('   • PulpMX Show');
  console.log('');
  console.log('⏱️ Rate limiting: 2s between requests, 5s between batches');
  console.log('📦 Batch size: 20 episodes per batch');
  console.log('');
  
  try {
    const results = await historicalPodcastSync(dryRun);
    
    console.log('');
    console.log('🎉 Sync completed successfully!');
    
    if (dryRun) {
      console.log('');
      console.log('📋 DRY RUN SUMMARY:');
      console.log(`   📺 Total episodes found: ${results.totalProcessed}`);
      console.log(`   📊 Would be processed: ${results.totalNew}`);
      console.log('');
      console.log('✅ Ready for production run!');
      console.log('   Run: node scripts/runHistoricalSync.js --force');
    } else {
      console.log('');
      console.log('📋 PRODUCTION SUMMARY:');
      console.log(`   📺 Total episodes processed: ${results.totalProcessed}`);
      console.log(`   ➕ New episodes added: ${results.totalNew}`);
      console.log(`   🔄 Duplicates skipped: ${results.totalDuplicates}`);
      console.log(`   ❌ Errors: ${results.totalErrors}`);
    }
    
  } catch (error) {
    console.error('');
    console.error('💥 Sync failed:');
    console.error(`   ${error.message}`);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('   • Check your internet connection');
    console.error('   • Verify Supabase credentials');
    console.error('   • Try running with --dry-run first');
    process.exit(1);
  }
}

main();
