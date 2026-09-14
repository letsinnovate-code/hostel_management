'use client';

import { useState, useEffect } from 'react';

declare global {
  interface Window {
    google: any;
    __google_maps_loading_promise?: Promise<any>;
  }
}

/**
 * Singleton Google Maps Script Loader
 * Ensures Google Maps JavaScript API is loaded exactly once across the application.
 */
export function loadGoogleMapsScript(apiKey?: string, libraries = 'places,geometry'): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Cannot load Google Maps on server side'));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (window.__google_maps_loading_promise) {
    return window.__google_maps_loading_promise;
  }

  const key = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  window.__google_maps_loading_promise = new Promise((resolve, reject) => {
    // Check if script tag already exists in DOM
    const existingScript = document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      if (window.google?.maps) {
        resolve(window.google);
        return;
      }
      existingScript.addEventListener('load', () => resolve(window.google));
      existingScript.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=${libraries}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      resolve(window.google);
    };

    script.onerror = (err) => {
      delete window.__google_maps_loading_promise;
      reject(new Error('Failed to load Google Maps script'));
    };

    document.head.appendChild(script);
  });

  return window.__google_maps_loading_promise;
}

/**
 * React hook to access Google Maps loading status in any map component.
 */
export function useGoogleMapsScript(libraries = 'places,geometry') {
  const [isLoaded, setIsLoaded] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.google?.maps) {
      return true;
    }
    return false;
  });
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadGoogleMapsScript(undefined, libraries)
      .then(() => {
        if (isMounted) setIsLoaded(true);
      })
      .catch((err) => {
        if (isMounted) setLoadError(err);
      });

    return () => {
      isMounted = false;
    };
  }, [libraries]);

  return {
    isLoaded,
    loadError,
    google: typeof window !== 'undefined' ? window.google : undefined,
  };
}

export default useGoogleMapsScript;
