import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowLeft, RotateCcw, Share, ExternalLink } from 'lucide-react-native';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

// Web-compatible iframe component
const WebFrame = ({ url, onLoad, onError }: { url: string; onLoad: () => void; onError: () => void }) => {
  if (Platform.OS !== 'web') return null;
  
  const handleIframeLoad = () => {
    // Check if iframe loaded successfully
    setTimeout(() => {
      try {
        onLoad();
      } catch {
        onError();
      }
    }, 1000);
  };
  
  const handleIframeError = () => {
    onError();
  };
  
  return (
    <iframe
      src={url}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        border: 'none',
        backgroundColor: '#fff'
      }}
      onLoad={handleIframeLoad}
      onError={handleIframeError}
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
};

interface InAppBrowserProps {
  url: string;
  title?: string;
}

const InAppBrowser: React.FC<InAppBrowserProps> = ({ url, title }) => {
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>(url);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const webViewRef = useRef<WebView | null>(null);
  const insets = useSafeAreaInsets();
  
  // Check if URL is from a known problematic domain
  const isProblematicDomain = React.useMemo(() => {
    const problematicDomains = [
      'racerxonline.com',
      'vitalmx.com', 
      'motocrossactionmag.com',
      'transworld.net',
      'dirtbikemagazine.com',
      'cyclenews.com',
      'motocrossmag.com',
      'mxlarge.com',
      'ultimatemx.com',
      'throttlejockey.com',
      'mxvice.com'
    ];
    
    try {
      const urlObj = new URL(url);
      return problematicDomains.some(domain => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  }, [url]);
  
  // For problematic domains, show immediate fallback option
  const [showQuickFallback, setShowQuickFallback] = useState<boolean>(false);
  
  const handleError = useCallback((errorEvent?: any) => {
    console.error('WebView error for URL:', url, errorEvent);
    
    // Check if it's a common embedding restriction
    const isEmbeddingBlocked = errorEvent?.nativeEvent?.description?.includes('refused to connect') ||
                              errorEvent?.nativeEvent?.description?.includes('X-Frame-Options') ||
                              errorEvent?.nativeEvent?.description?.includes('blocks in-app viewing') ||
                              errorEvent?.nativeEvent?.description?.includes('ERR_BLOCKED_BY_RESPONSE') ||
                              errorEvent?.nativeEvent?.description?.includes('net::ERR_BLOCKED_BY_CLIENT') ||
                              errorEvent?.nativeEvent?.code === -1009 || // iOS network error
                              errorEvent?.nativeEvent?.code === -2 || // Android WebView error
                              errorEvent?.nativeEvent?.code === -6; // Android connection refused
    
    if (isEmbeddingBlocked || isProblematicDomain) {
      setError('This website blocks in-app viewing for security reasons. This is normal for many news sites including RacerX, Vital MX, and others to protect their content and advertising revenue.');
    } else {
      setError(Platform.OS === 'web' 
        ? 'This article cannot be displayed in the app. The website may be temporarily unavailable.'
        : 'Failed to load article. Please check your internet connection.'
      );
    }
    setLoading(false);
  }, [url, isProblematicDomain]);
  
  // Validate URL on mount and handle problematic domains
  React.useEffect(() => {
    if (!url || typeof url !== 'string') {
      console.error('Invalid URL provided to InAppBrowser:', url);
      setError('Invalid article URL provided');
      setLoading(false);
      return;
    }
    
    // Basic URL validation
    try {
      new URL(url);
    } catch (urlError) {
      console.error('Malformed URL provided to InAppBrowser:', url, urlError);
      setError('The article URL is malformed and cannot be opened');
      setLoading(false);
      return;
    }
    
    console.log('📱 Opening article URL:', url);
    
    // For known problematic domains, show immediate fallback option
    if (isProblematicDomain) {
      console.log('🚨 Detected problematic domain, showing quick fallback option');
      setShowQuickFallback(true);
      
      // Set a shorter timeout for problematic domains
      const timeout = setTimeout(() => {
        console.log('⏰ Quick timeout reached for problematic domain');
        handleError({ nativeEvent: { description: 'This website blocks in-app viewing for security reasons' } });
      }, 2000); // 2 second timeout for problematic domains
      
      return () => clearTimeout(timeout);
    }
  }, [url, isProblematicDomain, handleError]);

  const handleClose = () => {
    router.back();
  };

  const handleRefresh = () => {
    setError(null);
    setLoading(true);
    webViewRef.current?.reload();
  };

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: title || 'Article',
            url: currentUrl,
          });
        } else {
          // Fallback for web browsers without native sharing
          await navigator.clipboard.writeText(currentUrl);
          alert('Link copied to clipboard!');
        }
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(currentUrl, {
            dialogTitle: title || 'Share Article',
          });
        }
      }
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const handleOpenExternal = async () => {
    if (Platform.OS === 'web') {
      Linking.openURL(currentUrl);
    } else {
      // Use expo-web-browser for better in-app experience on mobile
      try {
        await WebBrowser.openBrowserAsync(currentUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          controlsColor: Colors.light.primary,
        });
      } catch (error) {
        console.log('Error opening browser:', error);
        // Fallback to system browser
        Linking.openURL(currentUrl);
      }
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    try {
      setCanGoBack(navState.canGoBack || false);
      setCurrentUrl(navState.url || url);
      setLoading(navState.loading || false);
    } catch (error) {
      console.error('Error in navigation state change:', error);
    }
  };

  const handleLoad = () => {
    setError(null);
    setLoading(false);
    setShowQuickFallback(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.light.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleClose}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText} numberOfLines={1}>
            {title || 'Article'}
          </Text>
          <Text style={styles.headerUrlText} numberOfLines={1}>
            {currentUrl}
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleRefresh}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <RotateCcw size={20} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleShare}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Share size={20} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleOpenExternal}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <ExternalLink size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingBar} />
        </View>
      )}
      
      {/* Quick fallback for problematic domains */}
      {showQuickFallback && !error && (
        <View style={styles.quickFallbackContainer}>
          <View style={styles.quickFallbackMessage}>
            <ExternalLink size={32} color={Colors.light.primary} />
            <Text style={styles.quickFallbackTitle}>Enhanced Browser Mode</Text>
            <Text style={styles.quickFallbackText}>
              Attempting to load this site with advanced browser techniques. If it doesn&apos;t work in a few seconds, we&apos;ll open it in your default browser where it works perfectly.
            </Text>
            <TouchableOpacity style={styles.quickFallbackButton} onPress={handleOpenExternal}>
              <ExternalLink size={16} color="#fff" />
              <Text style={styles.quickFallbackButtonText}>Open in Browser Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Content */}
      {error ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorMessage}>
            <ExternalLink size={48} color={Colors.light.primary} />
            <Text style={styles.errorTitle}>Enhanced Browser Required</Text>
            <Text style={styles.errorText}>
              {error}
            </Text>
            <Text style={styles.errorSubtext}>
              This is normal behavior - the website will open in your default browser where it works perfectly.
            </Text>
            <View style={styles.errorActions}>
              <TouchableOpacity style={styles.errorButtonPrimary} onPress={handleOpenExternal}>
                <ExternalLink size={16} color="#fff" />
                <Text style={styles.errorButtonPrimaryText}>Open in Browser</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : Platform.OS === 'web' ? (
        <View style={styles.webview}>
          <WebFrame
            url={url}
            onLoad={handleLoad}
            onError={handleError}
          />
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webview}
          onNavigationStateChange={handleNavigationStateChange}
          onError={handleError}
          onLoad={handleLoad}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('HTTP error loading article:', nativeEvent);
            // Common HTTP errors that indicate embedding restrictions
            if (nativeEvent.statusCode === 403 || nativeEvent.statusCode === 404) {
              handleError({ nativeEvent: { ...nativeEvent, description: 'refused to connect' } });
            } else {
              handleError(nativeEvent);
            }
          }}
          onLoadEnd={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            if (nativeEvent.loading === false) {
              setLoading(false);
            }
          }}
          startInLoadingState={true}
          scalesPageToFit={true}
          allowsBackForwardNavigationGestures={true}
          decelerationRate="normal"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode={Platform.OS === 'android' ? 'compatibility' : undefined}
          thirdPartyCookiesEnabled={true}
          userAgent={Platform.select({
            ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 FBAN/FBIOS FBAV/445.0.0.34.118 FBBV/520080087 FBDV/iPhone14,2 FBMD/iPhone FBSN/iOS FBSV/17.0 FBSS/3 FBCR/Verizon FBID/phone FBLC/en_US FBOP/5 FBRV/520080087",
            android: "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/445.0.0.34.118;] FBRV/520080087"
          })}
          originWhitelist={['*']}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={true}
          sharedCookiesEnabled={true}
          incognito={false}
          cacheEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          allowFileAccessFromFileURLs={true}
          saveFormDataDisabled={false}
          allowsProtectedMedia={true}
          injectedJavaScriptBeforeContentLoaded={`
            // Ultra-aggressive pre-load frame bypass - runs before any page scripts
            (function() {
              try {
                console.log('🚀 Pre-load frame bypass initializing...');
                
                // Immediately override critical properties before page loads
                Object.defineProperty(window, 'top', {
                  get: function() { return window.self; },
                  set: function() { return true; },
                  configurable: false,
                  enumerable: false
                });
                
                Object.defineProperty(window, 'parent', {
                  get: function() { return window.self; },
                  set: function() { return true; },
                  configurable: false,
                  enumerable: false
                });
                
                Object.defineProperty(window, 'frameElement', {
                  get: function() { return null; },
                  set: function() { return true; },
                  configurable: false,
                  enumerable: false
                });
                
                // Override location properties immediately
                const originalLocation = window.location;
                const locationProxy = new Proxy(originalLocation, {
                  set: function(target, property, value) {
                    if (property === 'href' && typeof value === 'string') {
                      if (value.includes('about:blank') || value.includes('javascript:')) {
                        console.log('🛡️ Blocked location.href redirect:', value);
                        return true;
                      }
                    }
                    return Reflect.set(target, property, value);
                  }
                });
                
                // Spoof Facebook environment immediately
                window.FB_IAB = true;
                window.FBAV = '445.0.0.34.118';
                window.FBAN = 'FBIOS';
                
                console.log('✅ Pre-load bypass complete');
              } catch (e) {
                console.error('❌ Pre-load bypass error:', e);
              }
            })();
            true;
          `}
          injectedJavaScript={`
            // Advanced Facebook/Instagram-style frame bypass techniques
            (function() {
              try {
                console.log('🚀 Initializing advanced frame bypass...');
                
                // 1. Enhanced meta tag removal with mutation observer
                const removeRestrictiveMeta = function() {
                  const metaTags = document.getElementsByTagName('meta');
                  for (let i = metaTags.length - 1; i >= 0; i--) {
                    const meta = metaTags[i];
                    const httpEquiv = meta.getAttribute('http-equiv');
                    const name = meta.getAttribute('name');
                    const content = meta.getAttribute('content');
                    
                    if (httpEquiv && (
                      httpEquiv.toLowerCase().includes('x-frame-options') ||
                      httpEquiv.toLowerCase().includes('content-security-policy')
                    )) {
                      console.log('🔧 Removing restrictive meta tag:', httpEquiv);
                      meta.remove();
                    }
                    
                    if (content && (
                      content.toLowerCase().includes('deny') ||
                      content.toLowerCase().includes('sameorigin') ||
                      content.toLowerCase().includes('frame-ancestors')
                    )) {
                      console.log('🔧 Removing restrictive content:', content);
                      meta.remove();
                    }
                    
                    if (name && name.toLowerCase().includes('referrer')) {
                      meta.setAttribute('content', 'no-referrer-when-downgrade');
                    }
                  }
                };
                
                removeRestrictiveMeta();
                
                // Watch for dynamically added meta tags
                const metaObserver = new MutationObserver(function(mutations) {
                  mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList') {
                      mutation.addedNodes.forEach(function(node) {
                        if (node.tagName === 'META') {
                          const httpEquiv = node.getAttribute('http-equiv');
                          if (httpEquiv && (
                            httpEquiv.toLowerCase().includes('x-frame-options') ||
                            httpEquiv.toLowerCase().includes('content-security-policy')
                          )) {
                            console.log('🔧 Removing dynamically added restrictive meta:', httpEquiv);
                            node.remove();
                          }
                        }
                      });
                    }
                  });
                });
                
                metaObserver.observe(document.head || document.documentElement, {
                  childList: true,
                  subtree: true
                });
                
                // 2. Advanced frame busting prevention with proxy
                const windowProxy = new Proxy(window, {
                  get: function(target, property) {
                    if (property === 'top' || property === 'parent') {
                      return window.self;
                    }
                    if (property === 'frameElement') {
                      return null;
                    }
                    return Reflect.get(target, property);
                  },
                  set: function(target, property, value) {
                    if (property === 'top' || property === 'parent') {
                      return true; // Ignore attempts to set these
                    }
                    return Reflect.set(target, property, value);
                  }
                });
                
                // 3. Override all timing functions to block frame busting
                const originalSetTimeout = window.setTimeout;
                const originalSetInterval = window.setInterval;
                const originalRequestAnimationFrame = window.requestAnimationFrame;
                
                window.setTimeout = function(fn, delay) {
                  if (typeof fn === 'string') {
                    if (fn.includes('top.location') || fn.includes('parent.location') || 
                        fn.includes('window.top') || fn.includes('self.parent') ||
                        fn.includes('frameElement') || fn.includes('!=self')) {
                      console.log('🛡️ Blocked frame-busting setTimeout:', fn.substring(0, 100));
                      return 0;
                    }
                  } else if (typeof fn === 'function') {
                    const fnString = fn.toString();
                    if (fnString.includes('top.location') || fnString.includes('parent.location') ||
                        fnString.includes('window.top') || fnString.includes('frameElement')) {
                      console.log('🛡️ Blocked frame-busting function in setTimeout');
                      return 0;
                    }
                  }
                  return originalSetTimeout.apply(this, arguments);
                };
                
                window.setInterval = function(fn, delay) {
                  if (typeof fn === 'string') {
                    if (fn.includes('top.location') || fn.includes('parent.location') ||
                        fn.includes('frameElement')) {
                      console.log('🛡️ Blocked frame-busting setInterval');
                      return 0;
                    }
                  }
                  return originalSetInterval.apply(this, arguments);
                };
                
                // 4. Enhanced location manipulation prevention
                const originalLocationReplace = window.location.replace;
                const originalLocationAssign = window.location.assign;
                
                window.location.replace = function(url) {
                  if (typeof url === 'string') {
                    if (url.includes('about:blank') || url.includes('javascript:') ||
                        url === window.location.href || url.includes('data:')) {
                      console.log('🛡️ Blocked location.replace:', url);
                      return;
                    }
                    // Allow legitimate navigation but log it
                    console.log('🔗 Allowing location.replace:', url);
                  }
                  return originalLocationReplace.call(window.location, url);
                };
                
                window.location.assign = function(url) {
                  if (typeof url === 'string') {
                    if (url.includes('about:blank') || url.includes('javascript:') ||
                        url.includes('data:')) {
                      console.log('🛡️ Blocked location.assign:', url);
                      return;
                    }
                    console.log('🔗 Allowing location.assign:', url);
                  }
                  return originalLocationAssign.call(window.location, url);
                };
                
                // 5. Override window.open with intelligent filtering
                const originalOpen = window.open;
                window.open = function(url, target, features) {
                  console.log('🔗 Intercepted window.open:', url, target);
                  
                  // Block suspicious URLs
                  if (typeof url === 'string') {
                    if (url.includes('about:blank') || url.includes('javascript:') ||
                        url.startsWith('data:') || url === '') {
                      console.log('🛡️ Blocked suspicious window.open:', url);
                      return null;
                    }
                  }
                  
                  // Redirect external opens to same window for better UX
                  if (target === '_blank' || target === '_top' || target === '_parent') {
                    target = '_self';
                  }
                  
                  return originalOpen.call(window, url, target, features);
                };
                
                // 6. Enhanced document.write prevention
                const originalDocumentWrite = document.write;
                const originalDocumentWriteln = document.writeln;
                
                document.write = function(content) {
                  if (typeof content === 'string') {
                    if (content.includes('top.location') || content.includes('parent.location') ||
                        content.includes('window.top') || content.includes('frameElement') ||
                        (content.includes('<script') && content.includes('frame'))) {
                      console.log('🛡️ Blocked frame-busting document.write');
                      return;
                    }
                  }
                  return originalDocumentWrite.call(document, content);
                };
                
                document.writeln = function(content) {
                  if (typeof content === 'string') {
                    if (content.includes('top.location') || content.includes('parent.location') ||
                        content.includes('frameElement')) {
                      console.log('🛡️ Blocked frame-busting document.writeln');
                      return;
                    }
                  }
                  return originalDocumentWriteln.call(document, content);
                };
                
                // 7. Enhanced eval prevention with better detection
                const originalEval = window.eval;
                window.eval = function(code) {
                  if (typeof code === 'string') {
                    if (code.includes('top.location') || code.includes('parent.location') ||
                        code.includes('window.top') || code.includes('self.parent') ||
                        code.includes('frameElement') || code.includes('!=self')) {
                      console.log('🛡️ Blocked frame-busting eval:', code.substring(0, 100));
                      return;
                    }
                  }
                  return originalEval.call(window, code);
                };
                
                // 8. Override Function constructor to prevent dynamic frame busting
                const originalFunction = window.Function;
                window.Function = function() {
                  const args = Array.prototype.slice.call(arguments);
                  const code = args[args.length - 1];
                  
                  if (typeof code === 'string') {
                    if (code.includes('top.location') || code.includes('parent.location') ||
                        code.includes('frameElement') || code.includes('window.top')) {
                      console.log('🛡️ Blocked frame-busting Function constructor');
                      return function() {};
                    }
                  }
                  
                  return originalFunction.apply(this, arguments);
                };
                
                // 9. Enhanced referrer spoofing
                Object.defineProperty(document, 'referrer', {
                  get: function() { return 'https://www.facebook.com/'; },
                  configurable: false
                });
                
                // 10. Simulate complete Facebook app environment
                window.FB_IAB = true;
                window.FBAV = '445.0.0.34.118';
                window.FBAN = 'FBIOS';
                window.FBDV = 'iPhone14,2';
                window.FBMD = 'iPhone';
                window.FBSN = 'iOS';
                window.FBSV = '17.0';
                
                // Add Facebook-specific properties that sites might check
                window.webkit = window.webkit || {};
                window.webkit.messageHandlers = window.webkit.messageHandlers || {};
                window.webkit.messageHandlers.facebook = {
                  postMessage: function() { console.log('Facebook webkit message intercepted'); }
                };
                
                // 11. Advanced script monitoring and removal
                const cleanupRestrictions = function() {
                  // Remove frame-busting scripts more aggressively
                  const scripts = document.getElementsByTagName('script');
                  for (let i = scripts.length - 1; i >= 0; i--) {
                    const script = scripts[i];
                    const scriptContent = script.innerHTML || script.textContent || '';
                    const scriptSrc = script.src || '';
                    
                    if (scriptContent && (
                      scriptContent.includes('top.location') ||
                      scriptContent.includes('parent.location') ||
                      scriptContent.includes('window.top') ||
                      scriptContent.includes('frameElement') ||
                      scriptContent.includes('self != top') ||
                      scriptContent.includes('top != self') ||
                      scriptContent.includes('parent != self')
                    )) {
                      console.log('🧹 Removing frame-busting script:', scriptContent.substring(0, 100));
                      script.remove();
                    }
                    
                    // Block known frame-busting script sources
                    if (scriptSrc && (
                      scriptSrc.includes('framebreaker') ||
                      scriptSrc.includes('framebuster') ||
                      scriptSrc.includes('anti-frame')
                    )) {
                      console.log('🧹 Removing frame-busting script source:', scriptSrc);
                      script.remove();
                    }
                  }
                  
                  // Enhanced CSS cleanup
                  const styles = document.getElementsByTagName('style');
                  for (let i = styles.length - 1; i >= 0; i--) {
                    const style = styles[i];
                    if (style.innerHTML) {
                      // More aggressive CSS cleanup
                      style.innerHTML = style.innerHTML
                        .replace(/display\s*:\s*none\s*!important/gi, 'display:block')
                        .replace(/display\s*:\s*none/gi, 'display:block')
                        .replace(/visibility\s*:\s*hidden\s*!important/gi, 'visibility:visible')
                        .replace(/visibility\s*:\s*hidden/gi, 'visibility:visible')
                        .replace(/opacity\s*:\s*0\s*!important/gi, 'opacity:1')
                        .replace(/height\s*:\s*0\s*!important/gi, 'height:auto')
                        .replace(/width\s*:\s*0\s*!important/gi, 'width:auto');
                    }
                  }
                  
                  // Remove any elements with frame-busting attributes
                  const allElements = document.getElementsByTagName('*');
                  for (let i = 0; i < allElements.length; i++) {
                    const element = allElements[i];
                    const onclick = element.getAttribute('onclick');
                    const onload = element.getAttribute('onload');
                    
                    if (onclick && (
                      onclick.includes('top.location') ||
                      onclick.includes('parent.location') ||
                      onclick.includes('frameElement')
                    )) {
                      console.log('🧹 Removing frame-busting onclick');
                      element.removeAttribute('onclick');
                    }
                    
                    if (onload && (
                      onload.includes('top.location') ||
                      onload.includes('parent.location') ||
                      onload.includes('frameElement')
                    )) {
                      console.log('🧹 Removing frame-busting onload');
                      element.removeAttribute('onload');
                    }
                  }
                };
                
                // Run cleanup immediately and continuously
                cleanupRestrictions();
                
                // Set up mutation observer for dynamic content
                const observer = new MutationObserver(function(mutations) {
                  let shouldCleanup = false;
                  mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                      shouldCleanup = true;
                    }
                  });
                  if (shouldCleanup) {
                    setTimeout(cleanupRestrictions, 10);
                  }
                });
                
                observer.observe(document.documentElement, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ['onclick', 'onload', 'style']
                });
                
                // Run cleanup on various events
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', cleanupRestrictions);
                } else {
                  setTimeout(cleanupRestrictions, 100);
                }
                
                window.addEventListener('load', cleanupRestrictions);
                
                // Continue aggressive cleanup
                setInterval(cleanupRestrictions, 1000);
                
                // 12. Override addEventListener to block frame-busting event listeners
                const originalAddEventListener = EventTarget.prototype.addEventListener;
                EventTarget.prototype.addEventListener = function(type, listener, options) {
                  if (typeof listener === 'function') {
                    const listenerString = listener.toString();
                    if (listenerString.includes('top.location') || 
                        listenerString.includes('parent.location') ||
                        listenerString.includes('frameElement')) {
                      console.log('🛡️ Blocked frame-busting event listener for:', type);
                      return;
                    }
                  }
                  return originalAddEventListener.call(this, type, listener, options);
                };
                
                console.log('✅ Ultra-advanced frame bypass initialized successfully');
                
                // Signal successful load
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage('loaded');
                
              } catch (e) {
                console.error('❌ Frame override script error:', e);
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage('error: ' + e.message);
              }
            })();
            true;
          `}
          onMessage={(event) => {
            const message = event.nativeEvent.data;
            console.log('WebView message:', message);
            if (message === 'loaded') {
              setLoading(false);
              setShowQuickFallback(false);
            }
          }}
        />
      )}
      
      {/* Bottom navigation bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
          onPress={() => webViewRef.current?.goBack()}
          disabled={!canGoBack}
        >
          <ArrowLeft size={20} color={canGoBack ? Colors.light.primary : Colors.light.placeholder} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
        >
          <Text style={styles.closeButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 16,
  },
  headerTitleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerUrlText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  loadingBar: {
    height: '100%',
    backgroundColor: '#fff',
    width: '30%',
    opacity: 0.8,
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  navButton: {
    padding: 12,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  closeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    marginLeft: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorMessage: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 400,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.placeholder,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.light.placeholder,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  errorButtonText: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorButtonPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickFallbackContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  quickFallbackMessage: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 350,
  },
  quickFallbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  quickFallbackText: {
    fontSize: 14,
    color: Colors.light.placeholder,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  quickFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  quickFallbackButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default InAppBrowser;