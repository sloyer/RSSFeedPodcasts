// debug-podcasts.js - Debug podcast API issue
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugPodcasts() {
  console.log('🎙️ Debugging Podcasts API Issue...\n');
  
  try {
    // 1. Check what podcast names we have
    console.log('1. UNIQUE PODCAST NAMES FROM PODCASTS TABLE:');
    const { data: podcasts, error: podcastsError } = await supabase
      .from('podcasts')
      .select('podcast_name');
    
    if (podcastsError) {
      console.error('❌ Podcasts error:', podcastsError);
      return;
    }
    
    const uniquePodcastNames = [...new Set(podcasts.map(p => p.podcast_name))].sort();
    console.log('Unique podcast names:', uniquePodcastNames);
    
    // 2. Generate API codes for each
    console.log('\n2. GENERATED API CODES:');
    uniquePodcastNames.forEach(name => {
      const apiCode = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      console.log(`"${name}" -> "${apiCode}"`);
    });
    
    // 3. Test direct podcast query
    console.log('\n3. TESTING DIRECT PODCAST QUERY:');
    const testPodcastName = 'Gypsy Tales';
    const { data: directTest, error: directError } = await supabase
      .from('podcasts')
      .select('*')
      .eq('podcast_name', testPodcastName)
      .limit(1);
    
    if (directError) {
      console.error(`❌ Direct query error for "${testPodcastName}":`, directError);
    } else {
      console.log(`✅ Direct query for "${testPodcastName}" returned ${directTest.length} results`);
      if (directTest[0]) {
        console.log('Sample:', {
          id: directTest[0].id,
          podcast_name: directTest[0].podcast_name,
          podcast_title: directTest[0].podcast_title,
          podcast_date: directTest[0].podcast_date
        });
      }
    }
    
    // 4. Test the API logic manually
    console.log('\n4. TESTING API LOGIC:');
    const testApiCode = 'GYPSYTALES';
    const { data: allPodcastNames, error: allError } = await supabase
      .from('podcasts')
      .select('podcast_name')
      .not('podcast_name', 'is', null);
    
    if (allError) {
      console.error('❌ Error fetching all podcast names:', allError);
    } else {
      const uniqueNames = [...new Set(allPodcastNames.map(item => item.podcast_name))];
      const matchingPodcast = uniqueNames.find(podcastName => {
        const apiCode = podcastName.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return apiCode === testApiCode;
      });
      
      console.log(`Looking for API code: ${testApiCode}`);
      console.log(`Found matching podcast: ${matchingPodcast || 'NONE'}`);
      
      if (matchingPodcast) {
        // Test the actual query that would be used
        const { data: finalTest, error: finalError } = await supabase
          .from('podcasts')
          .select('*')
          .eq('podcast_name', matchingPodcast)
          .order('podcast_date', { ascending: false })
          .limit(1);
        
        if (finalError) {
          console.error('❌ Final query error:', finalError);
        } else {
          console.log(`✅ Final query returned ${finalTest.length} results`);
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
}

debugPodcasts();
