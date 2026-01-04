// api/race-schedule.js - Race Schedule API for Live tab and notifications
import { supabase } from '../lib/supabaseClient.js';

// Calculate if an event is currently "live"
// Live window: coverage start to 4 hours after gate drop
function calculateLiveStatus(coverageStartUTC, gateDropUTC) {
  const now = new Date();
  const coverageStart = new Date(coverageStartUTC);
  const gateDrop = new Date(gateDropUTC);
  const windowEnd = new Date(gateDrop.getTime() + 4 * 60 * 60 * 1000);   // 4 hours after mains
  
  return {
    isLive: now >= coverageStart && now <= windowEnd,
    isCoverageActive: now >= coverageStart && now < gateDrop,  // Between coverage start and mains
    isMainsActive: now >= gateDrop && now <= windowEnd,        // During/after mains
    liveWindowStart: coverageStart.toISOString(),
    liveWindowEnd: windowEnd.toISOString()
  };
}

// Format event for API response
function formatEvent(event) {
  const liveStatus = calculateLiveStatus(event.coverage_start_utc, event.gate_drop_utc);
  
  return {
    id: event.id,
    round: event.round,
    series: event.series,
    venue: event.venue,
    city: event.city,
    state: event.state,
    coverageStartUTC: event.coverage_start_utc,  // 10 AM local
    gateDropUTC: event.gate_drop_utc,             // Main event start
    timezone: event.timezone,
    isTBD: event.is_tbd,
    isLive: liveStatus.isLive,
    isCoverageActive: liveStatus.isCoverageActive,  // Practice/qualifying happening
    isMainsActive: liveStatus.isMainsActive,         // Mains happening
    liveWindowStart: liveStatus.liveWindowStart,
    liveWindowEnd: liveStatus.liveWindowEnd
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { series } = req.query; // Optional filter: 'supercross', 'motocross', 'smx'
    const now = new Date();
    
    // Build query
    let query = supabase
      .from('race_events')
      .select('*')
      .order('gate_drop_utc', { ascending: true });
    
    // Filter by series if specified
    if (series) {
      query = query.eq('series', series);
    }
    
    const { data: events, error } = await query;
    
    if (error) throw error;
    
    if (!events || events.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          currentEvent: null,
          nextEvent: null,
          allEvents: [],
          isAnyEventLive: false
        }
      });
    }
    
    // Format all events
    const formattedEvents = events.map(formatEvent);
    
    // Find current live event (if any)
    const currentEvent = formattedEvents.find(e => e.isLive) || null;
    
    // Find next upcoming event (first event where coverage hasn't started yet)
    const nextEvent = formattedEvents.find(e => {
      const coverageStart = new Date(e.coverageStartUTC);
      return coverageStart > now;
    }) || null;
    
    // Check if any event is live
    const isAnyEventLive = formattedEvents.some(e => e.isLive);
    
    // Calculate time until next event (coverage start)
    let timeUntilNext = null;
    if (nextEvent) {
      const nextCoverage = new Date(nextEvent.coverageStartUTC);
      const msUntil = nextCoverage.getTime() - now.getTime();
      const hoursUntil = Math.floor(msUntil / (1000 * 60 * 60));
      const daysUntil = Math.floor(hoursUntil / 24);
      
      timeUntilNext = {
        milliseconds: msUntil,
        hours: hoursUntil,
        days: daysUntil,
        formatted: daysUntil > 0 
          ? `${daysUntil} day${daysUntil !== 1 ? 's' : ''}`
          : `${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''}`
      };
    }
    
    // Separate by series for convenience
    const bySeries = {
      supercross: formattedEvents.filter(e => e.series === 'supercross'),
      motocross: formattedEvents.filter(e => e.series === 'motocross'),
      smx: formattedEvents.filter(e => e.series === 'smx')
    };
    
    return res.status(200).json({
      success: true,
      data: {
        currentEvent,
        nextEvent,
        timeUntilNext,
        isAnyEventLive,
        allEvents: formattedEvents,
        bySeries,
        totalEvents: formattedEvents.length
      },
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    console.error('Race Schedule API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
}
