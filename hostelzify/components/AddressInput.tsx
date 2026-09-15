'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Search, Navigation, Loader2, CheckCircle2, Crosshair, AlertCircle } from 'lucide-react';
import type * as LType from 'leaflet';

export interface AddressComponents {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface AddressInputProps {
  value?: string;
  onChange?: (address: string, coordinates?: { latitude: number; longitude: number }, placeId?: string) => void;
  error?: string;
  required?: boolean;
  onGeocode?: (coordinates: { latitude: number; longitude: number }, formattedAddress: string, placeId: string) => void;
  onAddressComponents?: (components: AddressComponents) => void;
  initialCoordinates?: { latitude: number; longitude: number };
}

export default function AddressInput({
  value = '',
  onChange,
  error,
  required = false,
  onGeocode,
  onAddressComponents,
  initialCoordinates,
}: AddressInputProps) {
  const [searchQuery, setSearchQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Default coordinate (Bhopal/Central India or initialCoordinates or from address)
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>(() => {
    if (initialCoordinates && Number.isFinite(initialCoordinates.latitude) && Number.isFinite(initialCoordinates.longitude)) {
      return { lat: initialCoordinates.latitude, lng: initialCoordinates.longitude };
    }
    return { lat: 23.2599, lng: 77.4126 };
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const markerRef = useRef<LType.Marker | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (value && value !== searchQuery) {
      setSearchQuery(value);
    }
  }, [value]);

  // Parse Nominatim Address details into structured AddressComponents
  const parseNominatimAddress = (details: any, displayName: string): AddressComponents => {
    if (!details) return {};
    const street =
      details.road ||
      details.suburb ||
      details.neighbourhood ||
      details.hamlet ||
      details.pedestrian ||
      '';
    const city =
      details.city ||
      details.town ||
      details.village ||
      details.county ||
      details.state_district ||
      '';
    const state = details.state || '';
    const pincode = details.postcode || '';
    const country = details.country || 'India';

    return { street, city, state, pincode, country };
  };

  // Reverse geocode lat/lng to get address
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'HostelManagementApp/1.0 (contact@hostelzify.com)',
          'Accept-Language': 'en',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.display_name) {
        const formatted = data.display_name;
        const comps = parseNominatimAddress(data.address, formatted);

        setSearchQuery(formatted);
        if (onChange) {
          onChange(formatted, { latitude: lat, longitude: lng }, String(data.place_id || ''));
        }
        if (onGeocode) {
          onGeocode({ latitude: lat, longitude: lng }, formatted, String(data.place_id || ''));
        }
        if (onAddressComponents) {
          onAddressComponents(comps);
        }
        setFeedback(`Selected: ${formatted.slice(0, 50)}...`);
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isClient || !containerRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(containerRef.current, {
        center: [currentCoords.lat, currentCoords.lng],
        zoom: 15,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Custom Hostel Pin Icon
      const pinIcon = L.divIcon({
        className: 'hostel-map-pin',
        html: `
          <div style="background-color: #2563eb; width: 34px; height: 34px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34],
      });

      const marker = L.marker([currentCoords.lat, currentCoords.lng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      marker.bindPopup(`<b>Hostel Location</b><br/>Drag pin or click map to reposition.`);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setCurrentCoords({ lat: pos.lat, lng: pos.lng });
        reverseGeocode(pos.lat, pos.lng);
      });

      map.on('click', (e: LType.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setCurrentCoords({ lat, lng });
        reverseGeocode(lat, lng);
      });

      markerRef.current = marker;
      mapInstanceRef.current = map;

      // Force recalculation of container size after mounting
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isClient]);

  // Pan to coords when currentCoords changes
  const updateMapPosition = useCallback(
    (lat: number, lng: number) => {
      setCurrentCoords({ lat, lng });
      if (mapInstanceRef.current && markerRef.current) {
        mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1 });
        markerRef.current.setLatLng([lat, lng]);
      }
    },
    []
  );

  // Search autocomplete with OpenStreetMap Nominatim
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setShowSuggestions(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!text.trim() || text.length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5&addressdetails=1&countrycodes=in`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'HostelManagementApp/1.0 (contact@hostelzify.com)',
            'Accept-Language': 'en',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.warn('Nominatim search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSelectSuggestion = (item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const formatted = item.display_name;
    const comps = parseNominatimAddress(item.address, formatted);

    setSearchQuery(formatted);
    setShowSuggestions(false);
    setSuggestions([]);
    updateMapPosition(lat, lng);

    if (onChange) {
      onChange(formatted, { latitude: lat, longitude: lng }, String(item.place_id || ''));
    }
    if (onGeocode) {
      onGeocode({ latitude: lat, longitude: lng }, formatted, String(item.place_id || ''));
    }
    if (onAddressComponents) {
      onAddressComponents(comps);
    }
    setFeedback(`Address set: ${item.display_name.slice(0, 60)}...`);
  };

  // Browser Geolocation / GPS
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setDetectingGps(true);
    setFeedback('Detecting GPS location...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDetectingGps(false);
        updateMapPosition(lat, lng);
        reverseGeocode(lat, lng);
      },
      (err) => {
        setDetectingGps(false);
        setFeedback(null);
        alert(`Could not detect location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">
          Hostel Address & Location Coordinates {required && <span className="text-red-500">*</span>}
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Search your hostel's street/area or click anywhere on the OpenStreetMap to drop the entrance pin.
        </p>

        {/* Search Bar + GPS Button */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search hostel address (e.g. MG Road, Indore or City, State)..."
                className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
              />
              {searching && (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>

            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={detectingGps}
              className="px-3.5 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              title="Use current device GPS location"
            >
              {detectingGps ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Crosshair className="w-4 h-4 text-blue-600" />
              )}
              <span className="hidden sm:inline">Use My GPS</span>
            </button>
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {suggestions.map((item, idx) => (
                <button
                  key={item.place_id || idx}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/70 transition-colors flex items-start gap-2.5 text-xs text-gray-800"
                >
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span className="line-clamp-2 leading-relaxed">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">{feedback}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Interactive OpenStreetMap Leaflet Canvas */}
      <div className="relative rounded-2xl border border-gray-200/90 overflow-hidden shadow-xs">
        <div ref={containerRef} className="h-64 sm:h-80 w-full bg-gray-100" />

        {/* Floating Coordinates Tag */}
        <div className="absolute bottom-2.5 left-2.5 z-[1000] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm text-[11px] font-mono text-gray-700 flex items-center gap-2">
          <span className="font-bold text-blue-700">GPS Pin:</span>
          <span>{currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>Click anywhere on the map or drag the blue pin to set the exact property gate entrance.</span>
        <span className="font-semibold text-gray-700">Powered by OpenStreetMap</span>
      </div>
    </div>
  );
}
