import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { PodcastEpisode } from '@/types/podcast';

type PodcastCardProps = {
  item: PodcastEpisode;
  onPress: () => void;
  testID?: string;
};

export const PodcastCard: React.FC<PodcastCardProps> = React.memo(({ item, onPress, testID }) => {
  console.log('Rendering PodcastCard for:', item.title);
  console.log('PodcastCard imageUrl:', item.imageUrl);
  console.log('PodcastCard source:', item.source.name);
  const imageUrl = item.imageUrl || 'https://via.placeholder.com/150';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      testID={testID || `podcast-card-${item.id}`}
    >
      <Image 
        source={{ uri: imageUrl }} 
        style={styles.image} 
        resizeMode="cover"
        onError={(error) => console.log('Image load error for', item.title, ':', error.nativeEvent.error)}
        onLoad={() => console.log('Image loaded successfully for', item.title)}
      />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {item.title}
        </Text>
        <Text style={styles.channel} numberOfLines={1} ellipsizeMode="tail">
          {item.source.name}
        </Text>
        <Text style={styles.date}>{new Date(item.publishDate).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );
});

PodcastCard.displayName = 'PodcastCard';

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: 100,
    height: 100,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  channel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#999999',
  },
});
