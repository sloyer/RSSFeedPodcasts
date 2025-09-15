import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import InAppBrowser from '@/components/InAppBrowser';

export default function BrowserScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();

  if (!url) {
    return null;
  }

  return <InAppBrowser url={decodeURIComponent(url)} title={title ? decodeURIComponent(title) : undefined} />;
}