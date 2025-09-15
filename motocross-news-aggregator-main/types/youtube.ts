export interface YouTubeVideo {
  id: string;
  channelId: string;
  channelName: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string;
  embedUrl: string;
  watchUrl: string;
  embedHtml: string;
  isBookmarked?: boolean;
}