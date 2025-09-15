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

      // Direct company name mapping - use actual company names from articles table
      if (group_by_source && group_by_source !== 'false' && group_by_source !== 'true') {
        try {
          // Get all unique company names from articles table
          const { data: companies, error: companyError } = await supabase
            .from('articles')
            .select('company')
            .not('company', 'is', null);
          
          if (companyError) {
            console.warn(`Error fetching companies for source: ${group_by_source}`, companyError);
            query = query.eq('company', group_by_source);
          } else {
            // Find company where generated API code matches the request
            const uniqueCompanies = [...new Set(companies.map(item => item.company))];
            const matchingCompany = uniqueCompanies.find(company => {
              const apiCode = company.toUpperCase().replace(/[^A-Z0-9]/g, '');
              return apiCode === group_by_source.toUpperCase();
            });
            
            if (matchingCompany) {
              // Use the actual company name from articles table
              query = query.eq('company', matchingCompany);
            } else {
              console.warn(`Company not found for api_code: ${group_by_source}`);
              // Fallback to using the provided source code as-is
              query = query.eq('company', group_by_source);
            }
          }
        } catch (error) {
          console.error('Error looking up company mapping:', error);
          // Fallback to using the provided source code as-is
          query = query.eq('company', group_by_source);
        }
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
