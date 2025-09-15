import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X, Crown } from 'lucide-react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';

interface PremiumBannerProps {
  onClose: () => void;
}

export default function PremiumBanner({ onClose }: PremiumBannerProps) {
  const handlePremiumPress = () => {
    router.push('/subscription');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Crown color={Colors.light.primary} size={20} style={styles.icon} />
        <Text style={styles.text}>
          Did you know you can customize your feeds and get more sources with premium?
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X color={Colors.light.text} size={20} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={handlePremiumPress} style={styles.upgradeButton}>
        <Text style={styles.upgradeText}>Learn More</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF3E0',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  upgradeButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  upgradeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});