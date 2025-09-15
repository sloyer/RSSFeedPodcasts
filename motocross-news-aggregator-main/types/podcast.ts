export interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  link: string;
  publishDate: string;
  duration?: string;
  imageUrl?: string;
  audioUrl?: string;
  isBookmarked?: boolean;
  source: {
    id: string;
    name: string;
    logo?: string;
  };
}

export interface PlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  currentEpisode: PodcastEpisode | null;
  playbackRate: number;
  isBuffering: boolean;
}

export interface PlayerControls {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
  loadEpisode: (episode: PodcastEpisode, autoPlay?: boolean) => Promise<void>;
  loadAndPlay: (episode: PodcastEpisode) => Promise<void>;
  clearCurrentEpisode: () => Promise<void>;
}