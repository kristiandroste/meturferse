// Mixpanel Analytics for Meturferse NFT Land Visualization App
// Comprehensive tracking strategy for user behavior, preferences, and engagement
(() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION & INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  const MIXPANEL_TOKEN = 'a414caabda3e9c8cc879e2141baa865a';
  const APP_VERSION = '1.0.0';
  
  // Session tracking configuration (simplified)
  // Removed heartbeat and pause tracking - only session start/end
  
  // Performance tracking
  let sessionStartTime = Date.now();
  let lastInteractionTime = Date.now();
  let interactionCount = 0;
  let pageLoadTime = null;
  
  // User behavior tracking
  let currentSession = {
    zoomEvents: 0,
    panEvents: 0,
    plotSelections: 0,
    filterApplied: 0,
    walletLookups: 0,
    themeChanges: 0,
    mobileMenuUsage: 0,
    errorCount: 0
  };

  // Device and browser detection
  const deviceInfo = {
    isMobile: window.innerWidth <= 768,
    isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
    isDesktop: window.innerWidth > 1024,
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenResolution: `${screen.width}x${screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    pixelRatio: window.devicePixelRatio || 1,
    colorDepth: screen.colorDepth,
    orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  };

  // Initialize Mixpanel when DOM is ready
  function initializeMixpanel() {
    if (typeof mixpanel === 'undefined') {
      console.warn('Mixpanel not loaded, tracking disabled');
      return;
    }

    try {
      mixpanel.init(MIXPANEL_TOKEN, {
        debug: false,
        track_pageview: true,
        persistence: 'localStorage',
        property_blacklist: [],
        batch_requests: true,
        batch_size: 50,
        batch_flush_interval_ms: 5000
      });

      // Set initial user properties with error handling
      try {
        setUserProperties();
      } catch (error) {
        console.warn('Failed to set user properties:', error);
      }
      
      // Track page load completion
      try {
        trackPageLoad();
      } catch (error) {
        console.warn('Failed to track page load:', error);
      }
      
      // Setup automatic session tracking
      try {
        setupSessionTracking();
      } catch (error) {
        console.warn('Failed to setup session tracking:', error);
      }
      
      // Setup error tracking
      try {
        setupErrorTracking();
      } catch (error) {
        console.warn('Failed to setup error tracking:', error);
      }
      
      console.log('Mixpanel initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Mixpanel:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER IDENTIFICATION & PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  function setUserProperties() {
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const hasUrlState = urlParams.toString().length > 0;
    
    // Use localStorage for session counting
    const sessionCount = parseInt(localStorage.getItem('meturferse-session-count') || '0') + 1;
    localStorage.setItem('meturferse-session-count', sessionCount.toString());
    
    // Check if this is first visit
    const isFirstVisit = !localStorage.getItem('meturferse-first-visit');
    if (isFirstVisit) {
      localStorage.setItem('meturferse-first-visit', new Date().toISOString());
    }
    
    try {
      mixpanel.people.set({
        '$name': 'Anonymous Turf Explorer',
        'App Version': APP_VERSION,
        'Device Type': deviceInfo.isMobile ? 'Mobile' : deviceInfo.isTablet ? 'Tablet' : 'Desktop',
        'Screen Resolution': deviceInfo.screenResolution,
        'Viewport Size': deviceInfo.viewportSize,
        'Pixel Ratio': deviceInfo.pixelRatio,
        'Language': deviceInfo.language,
        'Timezone': deviceInfo.timezone,
        'User Agent': deviceInfo.userAgent,
        'Color Depth': deviceInfo.colorDepth,
        'Orientation': deviceInfo.orientation,
        'Has URL State': hasUrlState,
        'First Visit': localStorage.getItem('meturferse-first-visit'),
        'Total Sessions': sessionCount,
        'Is Return Visitor': !isFirstVisit
      });
    } catch (error) {
      console.warn('Failed to set people properties:', error);
    }

    try {
      mixpanel.register({
        'App Version': APP_VERSION,
        'Device Category': deviceInfo.isMobile ? 'Mobile' : deviceInfo.isTablet ? 'Tablet' : 'Desktop'
      });
    } catch (error) {
      console.warn('Failed to register super properties:', error);
    }
  }

  // Update user properties for wallet connections
  function updateWalletProperties(walletAddress, holdingsCount) {
    try {
      // Use localStorage for wallet lookup counting
      const walletLookupCount = parseInt(localStorage.getItem('meturferse-wallet-lookups') || '0') + 1;
      localStorage.setItem('meturferse-wallet-lookups', walletLookupCount.toString());
      
      mixpanel.people.set({
        'Has Connected Wallet': true,
        'Last Wallet Address': walletAddress,
        'Last Holdings Count': holdingsCount,
        'Total Wallet Lookups': walletLookupCount
      });
      
      // Use people.increment for server-side tracking as well
      mixpanel.people.increment('Wallet Lookups');
    } catch (error) {
      console.warn('Failed to update wallet properties:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE EVENT TRACKING FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function trackEvent(eventName, properties = {}) {
    if (typeof mixpanel === 'undefined') {
      // Silently fail if Mixpanel is not loaded
      return;
    }
    
    try {
      const baseProperties = {
        'Session Duration': Math.round((Date.now() - sessionStartTime) / 1000),
        'Time Since Last Interaction': Math.round((Date.now() - lastInteractionTime) / 1000),
        'Interaction Count': interactionCount,
        'Current URL': window.location.href,
        'Timestamp': new Date().toISOString(),
        'Device Type': deviceInfo.isMobile ? 'Mobile' : deviceInfo.isTablet ? 'Tablet' : 'Desktop',
        'Viewport Size': `${window.innerWidth}x${window.innerHeight}`,
        'Page Title': document.title
      };

      // Safely merge properties
      const eventProperties = { ...baseProperties };
      
      // Add custom properties with error handling
      try {
        Object.assign(eventProperties, properties);
      } catch (propertyError) {
        console.warn('Error merging event properties:', propertyError);
      }

      mixpanel.track(eventName, eventProperties);
      
      // Update interaction tracking
      lastInteractionTime = Date.now();
      interactionCount++;
      
    } catch (error) {
      // Log error but don't break the application
      console.warn('Failed to track event:', eventName, error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APPLICATION LIFECYCLE TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  let sessionStartTracked = false; // Prevent duplicate session start tracking

  function trackPageLoad() {
    pageLoadTime = performance.now();
    // Don't track page load separately - will be included in consolidated session start
  }

  function trackAppReady() {
    const readyTime = performance.now();
    
    // Only track session start once when app is fully ready
    if (!sessionStartTracked) {
      sessionStartTracked = true;
      
      trackEvent('Session Started', {
        'Load Time': Math.round(pageLoadTime || 0),
        'App Ready Time': Math.round(readyTime),
        'Time to Interactive': Math.round(readyTime - (pageLoadTime || 0)),
        'Navigation Type': performance.navigation ? performance.navigation.type : 'unknown',
        'Referrer': document.referrer || 'direct',
        'Has Service Worker': 'serviceWorker' in navigator,
        'Connection Type': navigator.connection ? navigator.connection.effectiveType : 'unknown',
        'Memory': navigator.deviceMemory || 'unknown',
        'Hardware Concurrency': navigator.hardwareConcurrency || 'unknown',
        'Total Assets Loaded': document.images.length,
        'Canvas Support': !!document.createElement('canvas').getContext,
        'Session ID': Date.now().toString(), // Unique session identifier
        'Start Time': new Date().toISOString()
      });
    }
  }

  function trackMetadataLoaded(metadataCount) {
    trackEvent('Metadata Loaded', {
      'Total Plots': metadataCount,
      'Load Success': true,
      'Load Time': Math.round(performance.now() - pageLoadTime)
    });
  }

  function trackSpriteLoaded(spriteType, success = true) {
    trackEvent('Sprite Loaded', {
      'Sprite Type': spriteType,
      'Load Success': success,
      'Load Time': Math.round(performance.now() - pageLoadTime)
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAP INTERACTION TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  function trackZoomEvent(zoomType, fromScale, toScale, method = 'unknown') {
    currentSession.zoomEvents++;
    
    trackEvent('Map Zoom', {
      'Zoom Type': zoomType, // 'in', 'out'
      'From Scale': Math.round(fromScale * 100) / 100,
      'To Scale': Math.round(toScale * 100) / 100,
      'Zoom Delta': Math.round((toScale - fromScale) * 100) / 100,
      'Zoom Method': method, // 'button', 'wheel', 'pinch', 'keyboard'
      'Session Zoom Count': currentSession.zoomEvents,
      'Final Zoom Level': `${Math.round(toScale * 100)}%`
    });
  }

  function trackPanEvent(deltaX, deltaY, method = 'unknown') {
    currentSession.panEvents++;
    
    // Only track significant pan movements to avoid spam
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance < 10) return;
    
    trackEvent('Map Pan', {
      'Pan Distance': Math.round(distance),
      'Delta X': Math.round(deltaX),
      'Delta Y': Math.round(deltaY),
      'Pan Method': method, // 'drag', 'touch', 'keyboard', 'wheel'
      'Session Pan Count': currentSession.panEvents,
      'Pan Direction': Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
    });
  }

  function trackPlotSelection(tokenId, coordinates, selectionMethod = 'click', plotData = null) {
    currentSession.plotSelections++;
    
    const baseProperties = {
      'Token ID': tokenId,
      'X Coordinate': coordinates.x,
      'Y Coordinate': coordinates.y,
      'Selection Method': selectionMethod, // 'click', 'double-click', 'search'
      'Session Selection Count': currentSession.plotSelections,
      'Current Zoom Level': getCurrentZoomLevel(),
      'Plot Region': getPlotRegion(coordinates.x, coordinates.y)
    };
    
    // Add plot metadata if available
    if (plotData) {
      const metadata = extractPlotMetadata(plotData);
      Object.assign(baseProperties, metadata);
    }
    
    trackEvent('Plot Selected', baseProperties);
  }

  function trackPlotPopupOpened(tokenId, plotData) {
    const baseProperties = {
      'Token ID': tokenId,
      'Action': 'opened',
      'Open Method': 'double-click',
      'Current Zoom Level': getCurrentZoomLevel(),
      'Has Image': true // Always true in this app
    };
    
    // Add plot metadata
    if (plotData) {
      const metadata = extractPlotMetadata(plotData);
      Object.assign(baseProperties, metadata);
    }
    
    trackEvent('Plot Popup Opened', baseProperties);
  }

  function trackPlotPopup(tokenId, attributes, viewDuration = 0) {
    // Legacy function - kept for backward compatibility
    trackEvent('Plot Popup Viewed', {
      'Token ID': tokenId,
      'Plot Type': attributes['Plot Type'] || 'unknown',
      'Rarity': attributes['Rarity'] || 'unknown',
      'View Duration': viewDuration,
      'Attributes Count': Object.keys(attributes).length,
      'Has Image': true // Always true in this app
    });
  }

  function trackFullscreenImage(tokenId, fromPopup = false) {
    trackEvent('Fullscreen Image Viewed', {
      'Token ID': tokenId,
      'Source': fromPopup ? 'popup' : 'direct',
      'Current Zoom Level': getCurrentZoomLevel()
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTER & SEARCH TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  function trackFilterApplied(filterType, filterValue, resultsCount, filterMethod = 'manual') {
    currentSession.filterApplied++;
    
    trackEvent('Filter Applied', {
      'Filter Type': filterType,
      'Filter Value': typeof filterValue === 'object' ? JSON.stringify(filterValue) : filterValue,
      'Filter Method': filterMethod, // 'manual', 'url-state', 'preset'
      'Results Count': resultsCount,
      'Total Active Filters': getCurrentActiveFiltersCount(),
      'Session Filter Count': currentSession.filterApplied,
      'Filter Selectivity': resultsCount / getTotalPlotsCount()
    });
  }

  function trackFilterRemoved(filterType, remainingFilters) {
    trackEvent('Filter Removed', {
      'Filter Type': filterType,
      'Remaining Filters': remainingFilters,
      'Active Filters Count': remainingFilters,
      'Removal Method': 'chip-close' // Could be extended for other methods
    });
  }

  function trackFilterPanelToggle(isOpen, method = 'button') {
    trackEvent('Filter Panel Toggled', {
      'Panel State': isOpen ? 'opened' : 'closed',
      'Toggle Method': method, // 'button', 'mobile-menu', 'outside-click'
      'Active Filters': getCurrentActiveFiltersCount(),
      'Device Type': deviceInfo.isMobile ? 'Mobile' : 'Desktop'
    });
  }

  function trackSearchQuery(searchType, query, resultsCount) {
    trackEvent('Search Performed', {
      'Search Type': searchType, // 'general', 'plot-type'
      'Query': query,
      'Query Length': query.length,
      'Results Count': resultsCount,
      'Search Effectiveness': resultsCount / getTotalPlotsCount(),
      'Has Results': resultsCount > 0
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WALLET INTEGRATION TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  function trackWalletLookup(walletAddress, holdingsCount, lookupDuration, success = true) {
    currentSession.walletLookups++;
    
    trackEvent('Wallet Lookup', {
      'Wallet Address': walletAddress,
      'Holdings Count': holdingsCount,
      'Lookup Duration': lookupDuration,
      'Lookup Success': success,
      'Session Wallet Lookups': currentSession.walletLookups,
      'Holdings Percentage': holdingsCount / getTotalPlotsCount(),
      'Address Format Valid': walletAddress.startsWith('0x') && walletAddress.length === 42
    });

    if (success && holdingsCount > 0) {
      updateWalletProperties(walletAddress, holdingsCount);
    }
  }

  function trackWalletError(walletAddress, errorType, errorMessage) {
    trackEvent('Wallet Lookup Error', {
      'Wallet Address': walletAddress,
      'Error Type': errorType, // 'invalid-address', 'network-error', 'api-error'
      'Error Message': errorMessage,
      'Address Length': walletAddress.length,
      'Has 0x Prefix': walletAddress.startsWith('0x')
    });
  }

  function trackWalletRemoved(walletAddress, hadHoldings) {
    trackEvent('Wallet Removed', {
      'Wallet Address': walletAddress,
      'Had Holdings': hadHoldings,
      'Removal Method': 'chip-close'
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI & UX TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  function trackThemeChange(fromTheme, toTheme, method = 'selector') {
    currentSession.themeChanges++;
    
    trackEvent('Theme Changed', {
      'From Theme': fromTheme,
      'To Theme': toTheme,
      'Change Method': method, // 'selector', 'mobile-selector', 'auto-random'
      'Session Theme Changes': currentSession.themeChanges,
      'Device Type': deviceInfo.isMobile ? 'Mobile' : 'Desktop'
    });

    try {
      // Use localStorage for theme change counting
      const themeChangeCount = parseInt(localStorage.getItem('meturferse-theme-changes') || '0') + 1;
      localStorage.setItem('meturferse-theme-changes', themeChangeCount.toString());
      
      // Update user preferences
      mixpanel.people.set({
        'Preferred Theme': toTheme,
        'Total Theme Changes': themeChangeCount
      });
      
      // Use people.increment for server-side tracking as well
      mixpanel.people.increment('Theme Changes');
    } catch (error) {
      console.warn('Failed to update theme change properties:', error);
    }
  }

  function trackMobileMenuUsage(action, duration = 0) {
    currentSession.mobileMenuUsage++;
    
    trackEvent('Mobile Menu', {
      'Action': action, // 'opened', 'closed', 'item-clicked'
      'Duration Open': duration,
      'Session Mobile Menu Usage': currentSession.mobileMenuUsage,
      'Is Mobile Device': deviceInfo.isMobile
    });
  }

  function trackNeighborhoodToggle(isEnabled, matchedPlotsCount) {
    trackEvent('Neighborhoods Toggled', {
      'Neighborhoods Enabled': isEnabled,
      'Matched Plots Count': matchedPlotsCount,
      'Has Active Filters': matchedPlotsCount > 0,
      'Current Zoom Level': getCurrentZoomLevel()
    });
  }

  function trackKeyboardNavigation(key, context = 'map') {
    trackEvent('Keyboard Navigation', {
      'Key': key,
      'Context': context, // 'map', 'popup', 'filter'
      'Current Zoom Level': getCurrentZoomLevel(),
      'Has Active Selection': getCurrentSelectedPlots().length > 0
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE & ERROR TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  function trackPerformanceMetric(metricType, value, context = '') {
    trackEvent('Performance Metric', {
      'Metric Type': metricType, // 'render-time', 'api-response', 'memory-usage'
      'Value': value,
      'Context': context,
      'Current Zoom Level': getCurrentZoomLevel(),
      'Total Plots Visible': getVisiblePlotsCount()
    });
  }

  function trackError(errorType, errorMessage, context = '', stack = '') {
    currentSession.errorCount++;
    
    trackEvent('Error Occurred', {
      'Error Type': errorType,
      'Error Message': errorMessage,
      'Context': context,
      'Stack Trace': stack.substring(0, 500), // Limit stack trace length
      'Session Error Count': currentSession.errorCount,
      'User Agent': navigator.userAgent,
      'Viewport Size': `${window.innerWidth}x${window.innerHeight}`
    });
  }

  function setupErrorTracking() {
    // Global error handler
    window.addEventListener('error', (event) => {
      trackError(
        'JavaScript Error',
        event.message,
        `${event.filename}:${event.lineno}:${event.colno}`,
        event.error ? event.error.stack : ''
      );
    });

    // Promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      trackError(
        'Unhandled Promise Rejection',
        event.reason.toString(),
        'Promise',
        event.reason.stack || ''
      );
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION & ENGAGEMENT TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  function setupSessionTracking() {
    // Removed session heartbeat tracking - only track session start/end

    // Removed session pause/resume tracking - creates too much noise from tab switching

    // Track session end on page unload
    window.addEventListener('beforeunload', () => {
      if (!sessionStartTracked) return; // Don't track end if start wasn't tracked
      
      const finalSessionData = {
        'Session Duration': Math.round((Date.now() - sessionStartTime) / 1000),
        'Total Interactions': interactionCount,
        'Zoom Events': currentSession.zoomEvents,
        'Pan Events': currentSession.panEvents,
        'Plot Selections': currentSession.plotSelections,
        'Filter Applications': currentSession.filterApplied,
        'Wallet Lookups': currentSession.walletLookups,
        'Theme Changes': currentSession.themeChanges,
        'Mobile Menu Usage': currentSession.mobileMenuUsage,
        'Error Count': currentSession.errorCount,
        'Engagement Score': calculateEngagementScore(),
        'End Time': new Date().toISOString()
      };

      mixpanel.track('Session Ended', finalSessionData);
      
      // Update user lifetime statistics
      try {
        mixpanel.people.increment({
          'Total Zoom Events': currentSession.zoomEvents,
          'Total Pan Events': currentSession.panEvents,
          'Total Plot Selections': currentSession.plotSelections,
          'Total Filter Applications': currentSession.filterApplied,
          'Total Wallet Lookups': currentSession.walletLookups,
          'Total Theme Changes': currentSession.themeChanges,
          'Total Mobile Menu Usage': currentSession.mobileMenuUsage,
          'Total Errors': currentSession.errorCount,
          'Total Session Time': Math.round((Date.now() - sessionStartTime) / 1000)
        });
      } catch (error) {
        console.warn('Failed to increment user lifetime statistics:', error);
      }
    });
  }

  function calculateEngagementScore() {
    const sessionDuration = (Date.now() - sessionStartTime) / 1000;
    const interactionRate = interactionCount / Math.max(sessionDuration / 60, 1); // interactions per minute
    const diversityScore = Object.values(currentSession).filter(count => count > 0).length;
    
    return Math.round((interactionRate * 10) + (diversityScore * 5));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function getCurrentZoomLevel() {
    // This will be implemented by the main app
    return window.turfApp ? window.turfApp.getCurrentZoomLevel() : '100%';
  }

  function getCurrentActiveFiltersCount() {
    // This will be implemented by the main app
    return window.turfApp ? window.turfApp.getActiveFiltersCount() : 0;
  }

  function getTotalPlotsCount() {
    // This will be implemented by the main app
    return window.turfApp ? window.turfApp.getTotalPlotsCount() : 0;
  }

  function getCurrentSelectedPlots() {
    // This will be implemented by the main app
    return window.turfApp ? window.turfApp.getSelectedPlots() : [];
  }

  function getVisiblePlotsCount() {
    // This will be implemented by the main app  
    return window.turfApp ? window.turfApp.getVisiblePlotsCount() : 0;
  }

  function getPlotRegion(x, y) {
    // Simple region classification based on coordinates
    const centerX = 50; // Approximate center, adjust based on actual data
    const centerY = 50;
    
    if (x < centerX - 20) return y < centerY - 20 ? 'northwest' : y > centerY + 20 ? 'southwest' : 'west';
    if (x > centerX + 20) return y < centerY - 20 ? 'northeast' : y > centerY + 20 ? 'southeast' : 'east';
    return y < centerY - 20 ? 'north' : y > centerY + 20 ? 'south' : 'center';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - EXPOSE TRACKING FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Create global namespace for tracking functions
  window.MixpanelTracker = {
    // Core functions
    trackEvent,
    
    // Application lifecycle
    trackAppReady,
    trackMetadataLoaded,
    trackSpriteLoaded,
    
    // Map interactions
    trackZoomEvent,
    trackPanEvent,
    trackPlotSelection,
    trackPlotPopup,
    trackFullscreenImage,
    
    // Filter & search
    trackFilterApplied,
    trackFilterRemoved,
    trackFilterPanelToggle,
    trackSearchQuery,
    
    // Wallet integration
    trackWalletLookup,
    trackWalletError,
    trackWalletRemoved,
    
    // UI & UX
    trackThemeChange,
    trackMobileMenuUsage,
    trackNeighborhoodToggle,
    trackKeyboardNavigation,
    
    // Performance & errors
    trackPerformanceMetric,
    trackError,
    
    // Session data
    getSessionData: () => ({
      ...currentSession,
      sessionDuration: Math.round((Date.now() - sessionStartTime) / 1000),
      engagementScore: calculateEngagementScore()
    })
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL INTERACTION TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  function trackFooterLinkClick(linkType, url, linkText) {
    trackEvent('Footer Link Clicked', {
      'Link Type': linkType, // 'donate', 'github', 'discord', 'faq'
      'URL': url,
      'Link Text': linkText,
      'Device Type': deviceInfo.isMobile ? 'Mobile' : 'Desktop',
      'Current Page Section': getCurrentPageSection()
    });
  }

  function trackFooterLinkHover(linkType, hoverDuration = 0) {
    trackEvent('Footer Link Hovered', {
      'Link Type': linkType,
      'Hover Duration': hoverDuration,
      'Device Type': deviceInfo.isMobile ? 'Mobile' : 'Desktop'
    });
  }

  function trackFAQModalInteraction(action, section = '', details = {}) {
    trackEvent('FAQ Modal Interaction', {
      'Action': action, // 'opened', 'closed', 'section-viewed', 'scrolled'
      'Section': section,
      'Close Method': details.closeMethod || '', // 'button', 'overlay', 'escape', 'outside-click'
      'Time Spent': details.timeSpent || 0,
      'Scroll Depth': details.scrollDepth || 0,
      'Source': details.source || '', // 'footer-link', 'direct'
      'Device Type': deviceInfo.isMobile ? 'Mobile' : 'Desktop',
      ...details
    });
  }

  function trackMobileMenuInteraction(action, details = {}) {
    trackEvent('Mobile Menu Interaction', {
      'Action': action, // 'opened', 'closed', 'item-clicked', 'outside-click'
      'Menu Item': details.menuItem || '', // 'zoom', 'filters', 'wallet', 'theme'
      'Duration Open': details.duration || 0,
      'Close Method': details.closeMethod || '', // 'toggle', 'outside-click', 'item-click'
      'Session Mobile Menu Usage': currentSession.mobileMenuUsage,
      ...details
    });
  }

  function trackNeighborhoodInteraction(isEnabled, context = {}) {
    trackEvent('Neighborhood Toggle', {
      'Neighborhoods Enabled': isEnabled,
      'Active Filters Count': context.activeFilters || 0,
      'Matched Plots Count': context.matchedPlots || 0,
      'Current Zoom Level': context.zoomLevel || '100%',
      'Device Type': deviceInfo.isMobile ? 'Mobile' : 'Desktop',
      'Toggle Source': context.source || 'unknown', // 'desktop', 'mobile'
      'Has Active Search': context.hasActiveSearch || false
    });
  }

  function trackPlotPopupInteraction(action, tokenId, details = {}) {
    trackEvent('Plot Popup Interaction', {
      'Action': action, // 'image-clicked', 'fullscreen-opened', 'closed'
      'Token ID': tokenId,
      'View Duration': details.viewDuration || 0,
      'Close Method': details.closeMethod || '', // 'button', 'overlay', 'escape'
      'Went Fullscreen': details.wentFullscreen || false,
      'Current Zoom Level': getCurrentZoomLevel()
    });
  }

  function trackHoverInteraction(elementType, elementId, hoverDuration) {
    // Only track significant hovers (>500ms) to avoid spam
    if (hoverDuration < 500) return;
    
    trackEvent('Element Hover', {
      'Element Type': elementType, // 'button', 'link', 'control'
      'Element ID': elementId,
      'Hover Duration': hoverDuration,
      'Device Type': deviceInfo.isMobile ? 'Mobile' : 'Desktop',
      'Page Section': getCurrentPageSection()
    });
  }

  function trackFilterInputInteraction(action, filterType, details = {}) {
    trackEvent('Filter Input Interaction', {
      'Action': action, // 'focus', 'blur', 'typing', 'clear'
      'Filter Type': filterType,
      'Input Length': details.inputLength || 0,
      'Time Spent': details.timeSpent || 0,
      'Typing Speed': details.typingSpeed || 0, // characters per second
      'Device Type': deviceInfo.isMobile ? 'Mobile' : 'Desktop'
    });
  }

  // URL state change tracking removed per user request

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM EVENT LISTENERS SETUP
  // ═══════════════════════════════════════════════════════════════════════════

  function setupFooterLinkTracking() {
    // Donate link tracking
    const donateLink = document.querySelector('a[href*="etherscan.io/address/meturferse.eth"]');
    if (donateLink) {
      let hoverStartTime = 0;
      
      donateLink.addEventListener('mouseenter', () => {
        hoverStartTime = Date.now();
      });
      
      donateLink.addEventListener('mouseleave', () => {
        if (hoverStartTime) {
          const hoverDuration = Date.now() - hoverStartTime;
          trackFooterLinkHover('donate', hoverDuration);
          hoverStartTime = 0;
        }
      });
      
      donateLink.addEventListener('click', () => {
        trackFooterLinkClick('donate', donateLink.href, donateLink.textContent.trim());
      });
    }

    // GitHub link tracking
    const githubLink = document.querySelector('a[href*="github.com"]');
    if (githubLink) {
      let hoverStartTime = 0;
      
      githubLink.addEventListener('mouseenter', () => {
        hoverStartTime = Date.now();
      });
      
      githubLink.addEventListener('mouseleave', () => {
        if (hoverStartTime) {
          const hoverDuration = Date.now() - hoverStartTime;
          trackFooterLinkHover('github', hoverDuration);
          hoverStartTime = 0;
        }
      });
      
      githubLink.addEventListener('click', () => {
        trackFooterLinkClick('github', githubLink.href, githubLink.textContent.trim());
      });
    }

    // Discord link tracking
    const discordLink = document.querySelector('a[href*="discord.gg"]');
    if (discordLink) {
      let hoverStartTime = 0;
      
      discordLink.addEventListener('mouseenter', () => {
        hoverStartTime = Date.now();
      });
      
      discordLink.addEventListener('mouseleave', () => {
        if (hoverStartTime) {
          const hoverDuration = Date.now() - hoverStartTime;
          trackFooterLinkHover('discord', hoverDuration);
          hoverStartTime = 0;
        }
      });
      
      discordLink.addEventListener('click', () => {
        trackFooterLinkClick('discord', discordLink.href, discordLink.textContent.trim());
      });
    }

    // FAQ link tracking
    const faqLink = document.getElementById('faqLink');
    if (faqLink) {
      let hoverStartTime = 0;
      
      faqLink.addEventListener('mouseenter', () => {
        hoverStartTime = Date.now();
      });
      
      faqLink.addEventListener('mouseleave', () => {
        if (hoverStartTime) {
          const hoverDuration = Date.now() - hoverStartTime;
          trackFooterLinkHover('faq', hoverDuration);
          hoverStartTime = 0;
        }
      });
      
      faqLink.addEventListener('click', () => {
        trackFooterLinkClick('faq', '#faq', 'FAQ');
        trackFAQModalInteraction('opened', '', { source: 'footer-link' });
      });
    }
  }

  function setupFAQModalTracking() {
    const faqOverlay = document.getElementById('faqOverlay');
    const faqModal = document.getElementById('faqModal');
    const faqCloseBtn = document.getElementById('faqCloseBtn');
    
    if (!faqOverlay || !faqModal) return;

    let faqOpenTime = 0;
    let faqScrollDepth = 0;
    let sectionsViewed = new Set();

    // Track FAQ sections with 3-second hover detection
    const setupFAQSectionTracking = () => {
      const sections = faqModal.querySelectorAll('.faq-section, h2, h3');
      const sectionHoverTimers = new Map(); // Track timers for each section
      
      sections.forEach(section => {
        let hoverTimer = null;
        let hoverStartTime = 0;
        
        const sectionText = section.textContent.trim().substring(0, 50);
        
        section.addEventListener('mouseenter', () => {
          hoverStartTime = Date.now();
          
          // Set 3-second timer for sustained hover
          hoverTimer = setTimeout(() => {
            if (!sectionsViewed.has(sectionText)) {
              sectionsViewed.add(sectionText);
              const hoverDuration = Math.round((Date.now() - hoverStartTime) / 1000);
              
              trackFAQModalInteraction('section-viewed', sectionText, {
                'Total Sections Viewed': sectionsViewed.size,
                'Section Type': section.tagName.toLowerCase(),
                'Hover Duration': hoverDuration,
                'Engagement Type': 'sustained-hover'
              });
            }
            hoverTimer = null;
          }, 3000); // 3-second threshold
          
          // Store timer reference for cleanup
          sectionHoverTimers.set(section, hoverTimer);
        });
        
        section.addEventListener('mouseleave', () => {
          // Clear timer if user leaves before 3 seconds
          if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
            sectionHoverTimers.delete(section);
          }
        });
      });
      
      // Return cleanup function instead of observer
      return {
        disconnect: () => {
          // Clear all active timers
          sectionHoverTimers.forEach((timer, section) => {
            if (timer) {
              clearTimeout(timer);
            }
          });
          sectionHoverTimers.clear();
        }
      };
    };

    // Track FAQ scroll depth
    const trackFAQScroll = () => {
      const scrollTop = faqModal.scrollTop;
      const scrollHeight = faqModal.scrollHeight - faqModal.clientHeight;
      const currentScrollDepth = Math.round((scrollTop / scrollHeight) * 100);
      
      if (currentScrollDepth > faqScrollDepth) {
        faqScrollDepth = currentScrollDepth;
        trackFAQModalInteraction('scrolled', '', {
          'Scroll Depth': faqScrollDepth,
          'Scroll Position': scrollTop
        });
      }
    };

    let sectionObserver = null;

    // FAQ opened
    const originalDisplay = faqOverlay.style.display;
    const checkFAQOpened = () => {
      if (faqOverlay.style.display === 'flex' && originalDisplay !== 'flex') {
        faqOpenTime = Date.now();
        faqScrollDepth = 0;
        sectionsViewed.clear();
        sectionObserver = setupFAQSectionTracking();
        faqModal.addEventListener('scroll', trackFAQScroll);
      }
    };

    // Use MutationObserver to detect style changes
    const observer = new MutationObserver(checkFAQOpened);
    observer.observe(faqOverlay, { attributes: true, attributeFilter: ['style'] });

    // FAQ close tracking
    const trackFAQClose = (method) => {
      if (faqOpenTime) {
        const timeSpent = Date.now() - faqOpenTime;
        trackFAQModalInteraction('closed', '', {
          closeMethod: method,
          timeSpent: Math.round(timeSpent / 1000),
          scrollDepth: faqScrollDepth,
          sectionsViewed: sectionsViewed.size
        });
        
        if (sectionObserver) {
          sectionObserver.disconnect();
          sectionObserver = null;
        }
        
        faqModal.removeEventListener('scroll', trackFAQScroll);
        faqOpenTime = 0;
      }
    };

    // Close button
    if (faqCloseBtn) {
      faqCloseBtn.addEventListener('click', () => trackFAQClose('button'));
    }

    // Overlay click
    faqOverlay.addEventListener('click', (e) => {
      if (e.target === faqOverlay) {
        trackFAQClose('overlay');
      }
    });

    // Escape key (will be handled by existing listener, but we'll track it)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && faqOverlay.style.display === 'flex') {
        trackFAQClose('escape');
      }
    });
  }

  function setupMobileMenuTracking() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (!mobileMenuToggle || !mobileMenu) return;

    let menuOpenTime = 0;
    let isMenuOpen = false;

    // Track menu state changes
    const observer = new MutationObserver(() => {
      const currentlyOpen = mobileMenu.classList.contains('show');
      
      if (currentlyOpen && !isMenuOpen) {
        // Menu opened
        menuOpenTime = Date.now();
        isMenuOpen = true;
        trackMobileMenuInteraction('opened', {});
      } else if (!currentlyOpen && isMenuOpen) {
        // Menu closed
        const duration = menuOpenTime ? Math.round((Date.now() - menuOpenTime) / 1000) : 0;
        isMenuOpen = false;
        menuOpenTime = 0;
        trackMobileMenuInteraction('closed', { duration });
      }
    });

    observer.observe(mobileMenu, { attributes: true, attributeFilter: ['class'] });

    // Track specific menu item interactions
    const mobileControls = {
      'zoomInMobile': 'zoom-in',
      'zoomOutMobile': 'zoom-out', 
      'filterToggleMobile': 'filters',
      'walletBtnMobile': 'wallet',
      'themeSelectorMobile': 'theme',
      'shadeToggleMobile': 'neighborhoods'
    };

    Object.entries(mobileControls).forEach(([elementId, itemType]) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.addEventListener('click', () => {
          const duration = menuOpenTime ? Math.round((Date.now() - menuOpenTime) / 1000) : 0;
          trackMobileMenuInteraction('item-clicked', {
            menuItem: itemType,
            duration: duration
          });
        });
      }
    });
  }

  function setupNeighborhoodTracking() {
    const shadeToggle = document.getElementById('shadeToggle');
    const shadeToggleMobile = document.getElementById('shadeToggleMobile');

    const trackNeighborhoodToggle = (isEnabled, source) => {
      const context = {
        activeFilters: window.turfApp ? window.turfApp.getActiveFiltersCount() : 0,
        matchedPlots: window.turfApp ? window.turfApp.getMatchedPlotsCount() : 0,
        zoomLevel: window.turfApp ? window.turfApp.getCurrentZoomLevel() : '100%',
        source: source,
        hasActiveSearch: window.turfApp ? window.turfApp.hasActiveSearch() : false
      };
      
      trackNeighborhoodInteraction(isEnabled, context);
    };

    if (shadeToggle) {
      shadeToggle.addEventListener('change', (e) => {
        trackNeighborhoodToggle(e.target.checked, 'desktop');
      });
    }

    if (shadeToggleMobile) {
      shadeToggleMobile.addEventListener('change', (e) => {
        trackNeighborhoodToggle(e.target.checked, 'mobile');
      });
    }
  }

  function setupFilterInputTracking() {
    // Track filter input interactions
    const trackFilterInput = (input, filterType) => {
      let focusTime = 0;
      let lastInputTime = 0;
      let inputCount = 0;

      input.addEventListener('focus', () => {
        focusTime = Date.now();
        trackFilterInputInteraction('focus', filterType);
      });

      input.addEventListener('blur', () => {
        if (focusTime) {
          const timeSpent = Math.round((Date.now() - focusTime) / 1000);
          trackFilterInputInteraction('blur', filterType, { timeSpent });
          focusTime = 0;
        }
      });

      input.addEventListener('input', () => {
        const now = Date.now();
        inputCount++;
        
        if (lastInputTime) {
          const timeDiff = now - lastInputTime;
          const typingSpeed = timeDiff > 0 ? 1000 / timeDiff : 0;
          
          trackFilterInputInteraction('typing', filterType, {
            inputLength: input.value.length,
            typingSpeed: Math.round(typingSpeed * 10) / 10,
            inputCount: inputCount
          });
        }
        
        lastInputTime = now;
      });
    };

    // Setup tracking for search inputs
    const generalSearch = document.querySelector('input[placeholder*="Search any metadata"]');
    if (generalSearch) {
      trackFilterInput(generalSearch, 'general-search');
    }

    const plotTypeSearch = document.querySelector('input[placeholder*="Search plot types"]');
    if (plotTypeSearch) {
      trackFilterInput(plotTypeSearch, 'plot-type-search');
    }

    // Setup tracking for wallet inputs
    const walletInput = document.getElementById('walletInput');
    if (walletInput) {
      trackFilterInput(walletInput, 'wallet-address');
    }

    const walletInputMobile = document.getElementById('walletInputMobile');
    if (walletInputMobile) {
      trackFilterInput(walletInputMobile, 'wallet-address-mobile');
    }
  }

  // URL state change tracking removed per user request

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function getCurrentPageSection() {
    // Determine which section of the page user is focused on
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    
    if (scrollY < windowHeight * 0.1) return 'header';
    if (scrollY > document.body.scrollHeight - windowHeight * 1.2) return 'footer';
    return 'main';
  }

  function extractPlotMetadata(plotData) {
    // Extract relevant plot attributes for tracking
    if (!plotData || !plotData.attributes) return {};
    
    const metadata = {};
    
    // Define important attributes to track
    const importantAttributes = [
      'Plot Type', 'Rarity', 'District', 'Zone', 'Terrain', 'Climate',
      'Elevation', 'Water Access', 'Resource Type', 'Development Level',
      'Transportation', 'Population Density', 'X.Coord', 'Y.Coord'
    ];
    
    // Extract each attribute if it exists
    importantAttributes.forEach(attrName => {
      const attr = plotData.attributes.find(a => a.trait_type === attrName);
      if (attr) {
        metadata[attrName] = attr.value;
      }
    });
    
    // Add derived metadata
    metadata['Total Attributes'] = plotData.attributes.length;
    metadata['Token ID'] = plotData.tokenId;
    
    // Add coordinate-based region classification
    const xCoord = metadata['X.Coord'];
    const yCoord = metadata['Y.Coord'];
    if (xCoord !== undefined && yCoord !== undefined) {
      metadata['Plot Region'] = getPlotRegion(parseInt(xCoord), parseInt(yCoord));
    }
    
    return metadata;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENHANCED PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  // Add new tracking functions to the public API
  const additionalAPI = {
    // Footer interactions
    trackFooterLinkClick,
    trackFooterLinkHover,
    
    // FAQ interactions
    trackFAQModalInteraction,
    
    // Mobile menu
    trackMobileMenuInteraction,
    
    // Neighborhoods
    trackNeighborhoodInteraction,
    
    // Plot popup enhancements
    trackPlotPopupInteraction,
    trackPlotPopupOpened,
    
    // General interactions
    trackHoverInteraction,
    trackFilterInputInteraction,
    // trackURLStateChange removed per user request
    
    // Utility functions
    extractPlotMetadata
  };

  // Extend the existing MixpanelTracker object
  Object.assign(window.MixpanelTracker, additionalAPI);

  // ═══════════════════════════════════════════════════════════════════════════
  // ENHANCED INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function initializeEnhancedTracking() {
    // Setup all DOM-based tracking
    setupFooterLinkTracking();
    setupFAQModalTracking();
    setupMobileMenuTracking();
    setupNeighborhoodTracking();
    setupFilterInputTracking();
    // setupURLStateTracking() removed per user request
    
    console.log('Enhanced Mixpanel tracking initialized');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeMixpanel();
      // Small delay to ensure main app elements are ready
      setTimeout(initializeEnhancedTracking, 100);
    });
  } else {
    initializeMixpanel();
    setTimeout(initializeEnhancedTracking, 100);
  }

  // Initialize when Mixpanel script loads (fallback)
  if (typeof mixpanel !== 'undefined') {
    initializeMixpanel();
  } else {
    // Wait for Mixpanel to load
    const checkMixpanel = setInterval(() => {
      if (typeof mixpanel !== 'undefined') {
        clearInterval(checkMixpanel);
        initializeMixpanel();
      }
    }, 100);
    
    // Stop checking after 10 seconds
    setTimeout(() => clearInterval(checkMixpanel), 10000);
  }

})();