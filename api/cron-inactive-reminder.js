// api/cron-inactive-reminder.js - Send reminder to users inactive for 14+ hours
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Calculate 14 hours ago
    const fourteenHoursAgo = new Date();
    fourteenHoursAgo.setHours(fourteenHoursAgo.getHours() - 14);

    // Find users who haven't been active in 14+ hours
    // and haven't received a reminder in the last 24 hours
    const { data: inactiveUsers, error: queryError } = await supabase
      .from('push_tokens')
      .select('user_id, expo_push_token, last_active, last_reminder_sent')
      .eq('is_active', true)
      .lt('last_active', fourteenHoursAgo.toISOString());

    if (queryError) throw queryError;

    if (!inactiveUsers || inactiveUsers.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No inactive users to notify',
        sent: 0
      });
    }

    // Filter out users who received a reminder in the last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const usersToNotify = inactiveUsers.filter(user => {
      if (!user.last_reminder_sent) return true;
      return new Date(user.last_reminder_sent) < twentyFourHoursAgo;
    });

    if (usersToNotify.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All inactive users already received reminder recently',
        sent: 0
      });
    }

    console.log(`[REMINDER] Sending to ${usersToNotify.length} inactive users`);

    // Build Expo push messages
    const messages = usersToNotify.map(user => ({
      to: user.expo_push_token,
      title: "🏍️ Miss us?",
      body: "Don't forget to get your moto fix!",
      sound: 'default',
      badge: 1,
      priority: 'default',
      channelId: 'default'
    }));

    // Send in batches of 100 (Expo limit)
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(batch)
      });

      if (response.ok) {
        successCount += batch.length;
      } else {
        errorCount += batch.length;
        console.error('[REMINDER] Expo error:', await response.text());
      }
    }

    // Update last_reminder_sent for notified users
    const userIds = usersToNotify.map(u => u.user_id);
    await supabase
      .from('push_tokens')
      .update({ last_reminder_sent: new Date().toISOString() })
      .in('user_id', userIds);

    return res.status(200).json({
      success: true,
      message: `Sent reminders to ${successCount} users`,
      sent: successCount,
      errors: errorCount
    });

  } catch (error) {
    console.error('[REMINDER] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

