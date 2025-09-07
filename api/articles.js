// api/articles.js - UPDATED with clean URL mappings for all your feeds
import { supabase } from '../lib/supabaseClient.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    try {
      const { 
        limit = 20, 
        offset = 0, 
        search, 
        company,
        group_by_source = 'false'
      } = req.query;

      let query = supabase
        .from('articles')
        .select('*')
        .order('published_date', { ascending: false });

      // Clean URL mappings for all motocross sources
      if (group_by_source && group_by_source !== 'false' && group_by_source !== 'true') {
        const sourceMappings = {
          // Major MX News Sites
          'VITALMX': 'Vital MX',
          'VITAL': 'Vital MX',
          'RACERX': 'Racer X',
          'RACER': 'Racer X',
          'RACERXONLINE': 'Racer X',
          'MOTOCROSSACTION': 'Motocross Action',
          'MXA': 'Motocross Action',
          'MXACTION': 'Motocross Action',
          'TRANSWORLD': 'Transworld MX',
          'TRANSWORLDMX': 'Transworld MX',
          'TWMX': 'Transworld MX',
          'CYCLENEWS': 'Cycle News',
          'DIRTBIKEMAGAZINE': 'Dirt Bike Magazine',
          'DIRTBIKE': 'Dirt Bike Magazine',
          'DIRTBIKETEST': 'Dirt Bike Test',
          'PULPMX': 'PulpMX',
          
          // International MX Sites
          'MXLARGE': 'MX Large',
          'MXVICE': 'MX Vice',
          'GATEDROP': 'GateDrop',
          'MOTOONLINE': 'MotoOnline',
          'DIRTHUB': 'DirtHub',
          
          // Community/Specialty Sites
          'SWAPMOTO': 'Swap Moto Live',
          'SWAPBROS': 'Swap Moto Live',
          'SWAPMOTOLIVE': 'Swap Moto Live',
          'MOTOXADDICTS': 'MotoXAddicts',
          'MOTOXPOD': 'MotoXPod',
          'MOTOCROSSPLANET': 'Motocross Planet',
          'MXPLANET': 'Motocross Planet',
          'MOTOCROSSPERFORMANCEMAGAZINE': 'Motocross Performance Magazine',
          'MXPERFORMANCE': 'Motocross Performance Magazine',
          
          // Racing Series Official Sites
          'SUPERCROSSOFFICIAL': 'Supercross Official',
          'SUPERCROSS': 'Supercross Official',
          'SX': 'Supercross Official',
          'SMXOFFICIAL': 'SMX Official',
          'SMX': 'SMX Official',
          'WORLDSUPERCROSSCHAMPIONSHIP': 'World Supercross Championship',
          'WSX': 'World Supercross Championship',
          'AUSTRALIANSUPERCROSSOFFICIAL': 'Australian Supercross Official',
          'AUSSX': 'Australian Supercross Official',
          
          // Retailers/Industry
          'DIRECTMOTOCROSS': 'Direct Motocross',
          'DIRECTMX': 'Direct Motocross',
          
          // Testing/Reviews
          'KEEFER': 'keefer, Inc Testing',
          'KEEFERINC': 'keefer, Inc Testing',
          'KEEFERTESTING': 'keefer, Inc Testing',
          'KEEFERINCTESTING': 'keefer, Inc Testing',
        };
        
        // Convert to uppercase and look up the actual company name
        const actualCompanyName = sourceMappings[group_by_source.toUpperCase()] || group_by_source;
        query = query.eq('company', actualCompanyName);
      } else if (company) {
        // Direct company name filter (legacy support)
        query = query.eq('company', company);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
      }

      query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      const { data: articles, error } = await query;
      if (error) throw error;

      return res.status(200).json({ 
        success: true, 
        data: articles,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: articles.length
        },
        grouped_by_source: group_by_source !== 'false'
      });
      
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
