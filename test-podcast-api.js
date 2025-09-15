// test-podcast-api.js - Test the actual API logic step by step
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPodcastAPI() {
  console.log('🧪 Testing Podcast API Logic Step by Step...\n');
  
  try {
    const group_by_show = 'GYPSYTALES';
    const limit = 1;
    const offset = 0;
    
    console.log(`Testing with group_by_show: ${group_by_show}`);
    
    // Step 1: Base query
    console.log('\n1. Creating base query...');
    let query = supabase
      .from('podcasts')
      .select('*')
      .order('podcast_date', { ascending: false });
    console.log('✅ Base query created');
    
    // Step 2: Handle show filtering (this is where the error might be)
    console.log('\n2. Adding show filtering...');
    if (group_by_show && group_by_show !== 'false' && group_by_show !== 'true') {
      try {
        // Get all unique podcast names from podcasts table
        const { data: podcastNames, error: podcastError } = await supabase
          .from('podcasts')
          .select('podcast_name')
          .not('podcast_name', 'is', null);
        
        if (podcastError) {
          console.error('❌ Error fetching podcast names:', podcastError);
          return;
        }
        
        console.log(`✅ Fetched ${podcastNames.length} podcast name records`);
        
        // Find podcast where generated API code matches the request
        const uniquePodcastNames = [...new Set(podcastNames.map(item => item.podcast_name))];
        console.log(`✅ Found ${uniquePodcastNames.length} unique podcast names`);
        
        const matchingPodcast = uniquePodcastNames.find(podcastName => {
          const apiCode = podcastName.toUpperCase().replace(/[^A-Z0-9]/g, '');
          return apiCode === group_by_show.toUpperCase();
        });
        
        if (matchingPodcast) {
          console.log(`✅ Found matching podcast: "${matchingPodcast}"`);
          // Use the actual podcast name from podcasts table
          query = query.eq('podcast_name', matchingPodcast);
        } else {
          console.warn(`⚠️ Podcast not found for api_code: ${group_by_show}`);
          // Fallback to using the provided show code as-is
          query = query.eq('podcast_name', group_by_show);
        }
      } catch (error) {
        console.error('❌ Error in show filtering:', error);
        return;
      }
    }
    
    // Step 3: Apply pagination
    console.log('\n3. Applying pagination...');
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    console.log('✅ Pagination applied');
    
    // Step 4: Execute query
    console.log('\n4. Executing final query...');
    const { data: podcasts, error } = await query;
    
    if (error) {
      console.error('❌ Query execution error:', error);
      return;
    }
    
    console.log(`✅ Query executed successfully, returned ${podcasts.length} results`);
    
    if (podcasts.length > 0) {
      console.log('\n5. Sample result:');
      console.log({
        id: podcasts[0].id,
        podcast_name: podcasts[0].podcast_name,
        podcast_title: podcasts[0].podcast_title,
        podcast_date: podcasts[0].podcast_date
      });
    }
    
    // Step 5: Format response like the API
    console.log('\n6. Formatting response...');
    const response = {
      success: true,
      data: podcasts,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: podcasts.length
      },
      grouped_by_show: false
    };
    
    console.log('✅ Response formatted successfully');
    console.log('Final response structure:', {
      success: response.success,
      dataLength: response.data.length,
      pagination: response.pagination
    });
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testPodcastAPI();
