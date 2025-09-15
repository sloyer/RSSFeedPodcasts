import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Colors from '@/constants/colors';

interface LoadingProgress {
  feedName: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  articlesCount?: number;
  error?: string;
}

interface DetailedLoadingIndicatorProps {
  loadingProgress: LoadingProgress[];
  totalFeeds: number;
  contentType?: 'news' | 'videos' | 'podcasts';
}

const DetailedLoadingIndicator: React.FC<DetailedLoadingIndicatorProps> = ({
  loadingProgress,
  totalFeeds,
  contentType = 'news'
}) => {
  const [currentLoadingFeed, setCurrentLoadingFeed] = useState<string>('');
  const [flashVisible, setFlashVisible] = useState(true);
  
  const completedFeeds = loadingProgress.filter(p => p.status === 'completed').length;
  const errorFeeds = loadingProgress.filter(p => p.status === 'error').length;
  const progressPercentage = totalFeeds > 0 ? ((completedFeeds + errorFeeds) / totalFeeds) * 100 : 0;
  
  // Flash the currently loading feed name
  useEffect(() => {
    const loadingFeed = loadingProgress.find(p => p.status === 'loading');
    if (loadingFeed) {
      setCurrentLoadingFeed(loadingFeed.feedName);
    } else {
      setCurrentLoadingFeed('');
    }
  }, [loadingProgress]);
  
  // Flash animation for current loading feed
  useEffect(() => {
    if (currentLoadingFeed) {
      const interval = setInterval(() => {
        setFlashVisible(prev => !prev);
      }, 800);
      return () => clearInterval(interval);
    } else {
      setFlashVisible(true);
    }
  }, [currentLoadingFeed]);
  
  const getTitle = () => {
    switch (contentType) {
      case 'videos': return 'Loading Videos';
      case 'podcasts': return 'Loading Podcasts';
      default: return 'Loading Articles';
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.light.primary} style={styles.spinner} />
      
      <Text style={styles.title}>{getTitle()}</Text>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${progressPercentage}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {completedFeeds + errorFeeds} of {totalFeeds} sources
        </Text>
      </View>
      
      {currentLoadingFeed && (
        <Text style={[styles.currentFeed, { opacity: flashVisible ? 1 : 0.3 }]}>
          Loading {currentLoadingFeed}...
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.light.background,
  },
  spinner: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 32,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    maxWidth: 280,
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.light.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.light.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'center',
  },
  currentFeed: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.primary,
    textAlign: 'center',
    marginTop: 16,
  },
});

export default DetailedLoadingIndicator;