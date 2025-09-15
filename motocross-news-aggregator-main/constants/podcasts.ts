export interface PodcastSource {
  id: string;
  name: string;
  url: string;
  logo?: string;
  enabled: boolean;
}

// Individual Shows
const pulpmxShow = 'https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=PULPMXSHOW';
const steveMatthes = 'https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=STEVEMATTHES';
const reraceables = 'https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=RERACEABLES';
const moto60 = 'https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=MOTO60';
const vitalMX = 'https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=VITALMX';
const gypsyTales = 'https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=GYPSYTALES';
const title24 = 'https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=TITLE24';
const racerX = 'https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=RACERX';
const swapMoto = 'https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=SWAPMOTO';
const acjbShow = 'https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=ACJB';

// All shows grouped by show
export const allGrouped = 'https://rss-feed-podcasts.vercel.app/api/podcasts?group_by_show=true';

// All episodes (flat list)
export const allEpisodes = 'https://rss-feed-podcasts.vercel.app/api/podcasts';

// Search across all shows
export const searchResults = 'https://rss-feed-podcasts.vercel.app/api/podcasts?search=supercross';

// Debug - see all actual show names in database
export const debugShows = 'https://rss-feed-podcasts.vercel.app/api/podcasts?debug_shows=true';

const podcasts: PodcastSource[] = [
  {
    id: "1",
    name: "The Steve Matthes Show",
    url: steveMatthes,
    logo: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop&crop=center",
    enabled: false,
  },
  {
    id: "2",
    name: "PulpMX Show",
    url: pulpmxShow,
    logo: "https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=300&h=300&fit=crop&crop=center",
    enabled: false,
  },
  {
    id: "3",
    name: "The Re-Raceables",
    url: reraceables,
    logo: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center",
    enabled: false,
  },
  {
    id: "4",
    name: "The Fly Racing MOTO:60 Show",
    url: moto60,
    logo: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=300&h=300&fit=crop&crop=center",
    enabled: false,
  },
  {
    id: "5",
    name: "PulpMX Classic Commentary",
    url: "https://www.pulpmx.com/apptabs/z_CC.xml",
    logo: "https://images.unsplash.com/photo-1590736969955-71cc94901144?w=300&h=300&fit=crop&crop=center",
    enabled: false,
  },
  {
    id: "6",
    name: "Vital MX",
    url: vitalMX,
    logo: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=300&fit=crop&crop=center",
    enabled: false,
  },
  {
    id: "7",
    name: "Gypsy Tales",
    url: gypsyTales,
    logo: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=300&fit=crop&crop=center",
    enabled: false,
  },
  {
    id: "8",
    name: "Title 24 - Villopoto & Carmichael",
    url: title24,
    logo: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=300&h=300&fit=crop&crop=center",
    enabled: false,
  },
  {
    id: "9",
    name: "Racer X Podcast",
    url: racerX,
    logo: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=300&fit=crop&crop=center",
    enabled: false,
  },
  {
    id: "10",
    name: "Swapmoto Live Podcast",
    url: swapMoto,
    logo: "https://images.unsplash.com/photo-1590736969955-71cc94901144?w=300&h=300&fit=crop&crop=center",
    enabled: false,
  },
  {
    id: "11",
    name: "The AC & JB Show",
    url: acjbShow,
    logo: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=300&fit=crop&crop=center",
    enabled: true,
  },
];

export default podcasts;