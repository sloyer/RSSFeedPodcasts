declare module 'react-native-rss-parser' {
  export interface RSSEnclosure {
    url: string;
    length?: string;
    mimeType?: string;
  }

  export interface RSSLink {
    url: string;
    rel?: string;
  }

  export interface RSSItem {
    id?: string;
    title?: string;
    description?: string;
    content?: string;
    links?: RSSLink[];
    published?: string;
    enclosures?: RSSEnclosure[];
  }

  export interface RSSFeed {
    title?: string;
    description?: string;
    items: RSSItem[];
  }

  export function parse(rssString: string): Promise<RSSFeed>;
}