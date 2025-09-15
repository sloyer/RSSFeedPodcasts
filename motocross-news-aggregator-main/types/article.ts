export interface Article {
  id: string;
  title: string;
  description: string;
  content?: string;
  link: string;
  publishDate: string;
  imageUrl?: string;
  author?: string;
  source: {
    id: string;
    name: string;
    logo?: string;
  };
  isBookmarked?: boolean;
}