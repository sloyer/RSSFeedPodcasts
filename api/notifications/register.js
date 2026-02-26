import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { userId, expoPushToken, platform, preferences } = req.body;

    // Validate required fields
    if (!userId || !expoPushToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId and expoPushToken are required' 
      });
    }

    // Validate Expo token format
    if (!expoPushToken.startsWith('ExponentPushToken[')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Expo push token format' 
      });
    }

    console.log(`[REGISTER] User: ${userId}, Preferences: ${preferences?.length || 0}`);

    // Step 1: Upsert push token
    // notifications_globally_enabled reflects whether the user has ANY feeds enabled.
    // When the preferences array is empty the user has turned off all notifications,
    // so cron jobs (inactive reminder, race alerts) should skip them entirely.
    const globallyEnabled = Array.isArray(preferences) && preferences.length > 0;

    // Conflict on expo_push_token — the table has a unique constraint on both
    // user_id and expo_push_token. Conflicting on the token means:
    //   - same user, same token  → UPDATE (normal re-registration)
    //   - new user, same token   → UPDATE user_id (device transfer)
    //   - same/new user, new token → INSERT (new device or token rotation)
    // This avoids the 23505 duplicate key error that occurred when conflicting
    // only on user_id while the token already existed in a separate row.
    const { error: tokenError } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: userId,
        expo_push_token: expoPushToken,
        device_platform: platform || 'ios',
        last_active: new Date().toISOString(),
        is_active: true,
        notifications_globally_enabled: globallyEnabled
      }, {
        onConflict: 'expo_push_token'
      });

    if (tokenError) {
      console.error('[REGISTER] Token upsert error:', tokenError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to register push token' 
      });
    }

    // Step 2: Delete old preferences for this user
    const { error: deleteError } = await supabase
      .from('notification_preferences')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[REGISTER] Delete old prefs error:', deleteError);
    }

    // Step 3: Insert new preferences
    if (preferences && Array.isArray(preferences) && preferences.length > 0) {
      const prefsToInsert = preferences.map(pref => ({
        user_id: userId,
        feed_id: pref.feedId,
        feed_name: pref.feedName,
        feed_type: pref.feedType,
        notifications_enabled: true,
        updated_at: new Date().toISOString()
      }));

      const { error: prefsError } = await supabase
        .from('notification_preferences')
        .insert(prefsToInsert);

      if (prefsError) {
        console.error('[REGISTER] Preferences insert error:', prefsError);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to save notification preferences' 
        });
      }
    }

    console.log(`[REGISTER] ✅ Success! ${userId} registered for ${preferences?.length || 0} feeds`);

    return res.status(200).json({
      success: true,
      message: `Registered for ${preferences?.length || 0} feeds`,
      token: expoPushToken
    });

  } catch (error) {
    console.error('[REGISTER] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}