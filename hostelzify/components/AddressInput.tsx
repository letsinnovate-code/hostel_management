'use client';

import { useEffect, useRef, useState } from 'react';

interface AddressComponents {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

interface AddressInputProps {
  value?: string;
  onChange?: (address: string, coordinates?: { latitude: number; longitude: number }, placeId?: string) => void;
  error?: string;
  required?: boolean;
  onGeocode?: (coordinates: { latitude: number; longitude: number }, formattedAddress: string, placeId: string) => void;
  onAddressComponents?: (components: AddressComponents) => void;
}

declare global {
  interface Window {
    google: any;
  }
}

export default function AddressInput({
  value = '',
  onChange,
  error,
  required = false,
  onGeocode,
  onAddressComponents,
}: AddressInputProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value);
  const [mapCenter, setMapCenter] = useState({ lat: 28.6139, lng: 77.2090 }); // Default to Delhi
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('');
  const [addressComponents, setAddressComponents] = useState<AddressComponents>({});
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const geocoderRef = useRef<any>(null);

  // Helper function to parse address components
  const parseAddressComponents = (components: any[]): AddressComponents => {
    const parsed: AddressComponents = {};
    let streetNumber = '';
    let route = '';

    components.forEach((component: any) => {
      const types = component.types;

      if (types.includes('street_number')) {
        streetNumber = component.long_name;
      } else if (types.includes('route')) {
        route = component.long_name;
      } else if (types.includes('locality') || types.includes('sublocality_level_1') || types.includes('sublocality')) {
        if (!parsed.city) {
          parsed.city = component.long_name;
        }
      } else if (types.includes('administrative_area_level_1')) {
        parsed.state = component.long_name;
      } else if (types.includes('postal_code')) {
        parsed.pincode = component.long_name;
      } else if (types.includes('country')) {
        parsed.country = component.long_name;
      }
    });

    // Combine street number and route
    if (streetNumber && route) {
      parsed.street = `${streetNumber} ${route}`;
    } else if (route) {
      parsed.street = route;
    } else if (streetNumber) {
      parsed.street = streetNumber;
    }

    return parsed;
  };

  // Load Google Maps script
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).google) {
      const script = document.createElement('script');
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsLoaded(true);
      script.onerror = () => {
        console.error('Failed to load Google Maps script');
        setIsLoaded(false);
      };
      document.head.appendChild(script);
    } else if ((window as any).google) {
      setIsLoaded(true);
    }
  }, []);

  // Initialize Autocomplete
  useEffect(() => {
    if (!isLoaded || !inputRef.current || !(window as any).google) return;

    const google = (window as any).google;
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'in' },
    });

    autocompleteRef.current = autocomplete;

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        console.error('No details available for the selected place');
        return;
      }

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const formattedAddress = place.formatted_address || place.name || '';
      const placeId = place.place_id || '';

      // Parse address components
      const components = place.address_components || [];
      const parsedComponents = parseAddressComponents(components);

      setSearchQuery(formattedAddress);
      setMapCenter({ lat, lng });
      setMarkerPosition({ lat, lng });
      setSelectedAddress(formattedAddress);
      setSelectedPlaceId(placeId);
      setAddressComponents(parsedComponents);

      // Pass address components to parent
      if (onAddressComponents) {
        onAddressComponents(parsedComponents);
      }
    });

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded]);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !(window as any).google || map) return;

    const google = (window as any).google;
    const newMap = new google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: 15,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });

    setMap(newMap);
    geocoderRef.current = new google.maps.Geocoder();

    // Add click listener - update marker position and geocode
    newMap.addListener('click', (e: any) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setMapCenter({ lat, lng });
        setMarkerPosition({ lat, lng });

        // Reverse geocode to get address components
        geocoderRef.current.geocode(
          { location: { lat, lng } },
          (results: any[], status: string) => {
            if (status === 'OK' && results[0]) {
              const formattedAddress = results[0].formatted_address;
              const placeId = results[0].place_id;
              const components = results[0].address_components || [];
              const parsedComponents = parseAddressComponents(components);

              setSelectedAddress(formattedAddress);
              setSelectedPlaceId(placeId);
              setAddressComponents(parsedComponents);

              // Pass address components to parent
              if (onAddressComponents) {
                onAddressComponents(parsedComponents);
              }
            } else {
              setSelectedAddress('');
              setSelectedPlaceId('');
              setAddressComponents({});
            }
          }
        );
      }
    });
  }, [isLoaded, map]);

  // Update marker position
  useEffect(() => {
    if (!map || !(window as any).google) return;

    // If we have a marker position, update/create marker
    if (markerPosition) {
      const position = { lat: markerPosition.lat, lng: markerPosition.lng };

      map.setCenter(position);

      if (marker) {
        marker.setPosition(position);
      } else {
        const google = (window as any).google;
        const newMarker = new google.maps.Marker({
          position: position,
          map: map,
          draggable: true,
          animation: google.maps.Animation.DROP,
        });

        newMarker.addListener('dragend', (e: any) => {
          if (e.latLng) {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            setMapCenter({ lat, lng });
            setMarkerPosition({ lat, lng });

            // Reverse geocode to get address components
            if (geocoderRef.current) {
              geocoderRef.current.geocode(
                { location: { lat, lng } },
                (results: any[], status: string) => {
                  if (status === 'OK' && results[0]) {
                    const formattedAddress = results[0].formatted_address;
                    const placeId = results[0].place_id;
                    const components = results[0].address_components || [];
                    const parsedComponents = parseAddressComponents(components);

                    setSelectedAddress(formattedAddress);
                    setSelectedPlaceId(placeId);
                    setAddressComponents(parsedComponents);

                    // Pass address components to parent
                    if (onAddressComponents) {
                      onAddressComponents(parsedComponents);
                    }
                  } else {
                    setSelectedAddress('');
                    setSelectedPlaceId('');
                    setAddressComponents({});
                  }
                }
              );
            }
          }
        });

        setMarker(newMarker);
      }
    } else {
      // If no marker position, remove marker if it exists
      if (marker) {
        marker.setMap(null);
        setMarker(null);
      }
    }
  }, [map, markerPosition, marker]);

  const handleAddressInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
  };

  const applySavedLocation = (
    lat: number,
    lng: number,
    address: string,
    placeId: string,
    components: AddressComponents
  ) => {
    if (onChange) {
      onChange(address, { latitude: lat, longitude: lng }, placeId);
    }
    if (onGeocode) {
      onGeocode({ latitude: lat, longitude: lng }, address, placeId);
    }
    if (onAddressComponents && Object.keys(components).length > 0) {
      onAddressComponents(components);
    }
    setSaveFeedback('Location saved');
    setTimeout(() => setSaveFeedback(null), 2500);
  };

  const handleSaveLocation = () => {
    if (markerPosition) {
      const address = selectedAddress || `Location at ${markerPosition.lat.toFixed(6)}, ${markerPosition.lng.toFixed(6)}`;
      applySavedLocation(
        markerPosition.lat,
        markerPosition.lng,
        address,
        selectedPlaceId,
        addressComponents
      );
      return;
    }

    // No marker: try to geocode the search query
    const query = (searchQuery || value || '').trim();
    if (!query) return;

    setSaving(true);
    const google = typeof window !== 'undefined' ? (window as any).google : null;
    if (!google?.maps?.Geocoder) {
      setSaveFeedback('Enter an address and select from suggestions, or click on the map.');
      setSaving(false);
      setTimeout(() => setSaveFeedback(null), 4000);
      return;
    }

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results: any[], status: string) => {
      setSaving(false);
      if (status !== 'OK' || !results?.[0]) {
        setSaveFeedback('Could not find that address. Select from the dropdown or click on the map.');
        setTimeout(() => setSaveFeedback(null), 4000);
        return;
      }
      const loc = results[0].geometry.location;
      const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
      const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
      const formattedAddress = results[0].formatted_address || query;
      const placeId = results[0].place_id || '';
      const components = parseAddressComponents(results[0].address_components || []);
      setMarkerPosition({ lat, lng });
      setSelectedAddress(formattedAddress);
      setSelectedPlaceId(placeId);
      setAddressComponents(components);
      setMapCenter({ lat, lng });
      applySavedLocation(lat, lng, formattedAddress, placeId, components);
    });
  };

  const canSave = !!markerPosition || !!((searchQuery || value || '').trim());

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not supported by your browser.');
      setTimeout(() => setLocationError(null), 4000);
      return;
    }
    setLocationError(null);
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setMarkerPosition({ lat, lng });
        setMapCenter({ lat, lng });
        setGettingLocation(false);
        const google = typeof window !== 'undefined' ? (window as any).google : null;
        if (!google?.maps?.Geocoder) {
          setSaveFeedback('Location set. Click Save Location to confirm.');
          setTimeout(() => setSaveFeedback(null), 3000);
          return;
        }
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === 'OK' && results?.[0]) {
            const formattedAddress = results[0].formatted_address;
            const placeId = results[0].place_id || '';
            const components = parseAddressComponents(results[0].address_components || []);
            setSelectedAddress(formattedAddress);
            setSelectedPlaceId(placeId);
            setAddressComponents(components);
            setSearchQuery(formattedAddress);
            applySavedLocation(lat, lng, formattedAddress, placeId, components);
          } else {
            const fallbackAddress = `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            setSelectedAddress(fallbackAddress);
            setSearchQuery(fallbackAddress);
            applySavedLocation(lat, lng, fallbackAddress, '', {});
          }
        });
      },
      (err) => {
        setGettingLocation(false);
        const message =
          err.code === 1
            ? 'Location permission denied. Please allow access in your browser settings.'
            : err.code === 2
              ? 'Location unavailable. Please try again.'
              : err.code === 3
                ? 'Location request timed out. Please try again.'
                : 'Could not get your location. Please try again.';
        setLocationError(message);
        setTimeout(() => setLocationError(null), 5000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const containerStyle = {
    width: '100%',
    height: '400px',
  };

  return (
    <div className="space-y-4">
      <label
        htmlFor="address"
        className="text-slate-700 font-medium flex items-center gap-2"
      >
        <svg
          className="w-4 h-4 text-emerald-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Address
      </label>

      {/* Search Bar and Use current location */}
      {isLoaded ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="address"
              name="address"
              value={searchQuery}
              onChange={handleAddressInputChange}
              placeholder="Search for an address"
              className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                error
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                  : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500'
              }`}
              aria-invalid={!!error}
              required={required}
            />
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={gettingLocation}
              className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm whitespace-nowrap border border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Use your current location"
            >
              {gettingLocation ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Getting location...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Use my location
                </>
              )}
            </button>
          </div>
          {locationError && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {locationError}
            </p>
          )}
        </div>
      ) : (
        <input
          disabled
          placeholder="Loading Google Maps..."
          className="w-full px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-500"
        />
      )}

      {/* Map */}
      <div className="h-[400px] w-full rounded-lg overflow-hidden border border-slate-200">
        {isLoaded ? (
          <div ref={mapRef} style={containerStyle} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-100">
            <svg
              className="w-6 h-6 animate-spin text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Display coordinates and address */}
      {markerPosition && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium text-slate-700">Latitude: </span>
              <span className="text-slate-900">{markerPosition.lat.toFixed(6)}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700">Longitude: </span>
              <span className="text-slate-900">{markerPosition.lng.toFixed(6)}</span>
            </div>
            {selectedAddress && (
              <div className="mt-2 pt-2 border-t border-slate-200">
                <span className="font-medium text-slate-700">Address: </span>
                <span className="text-slate-900">{selectedAddress}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <p className="text-sm text-slate-600">
        Search for an address or click on the map to select a location. Drag the marker to adjust.
      </p>

      {/* Save Button */}
      <button
        type="button"
        onClick={handleSaveLocation}
        disabled={!canSave || saving}
        className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
          canSave && !saving
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
        }`}
      >
        {saving ? 'Finding location...' : 'Save Location'}
      </button>

      {saveFeedback && (
        <p className={`text-sm ${saveFeedback.startsWith('Location saved') ? 'text-emerald-600 font-medium' : 'text-amber-700'}`}>
          {saveFeedback}
        </p>
      )}
      {error && (
        <p className="text-xs text-rose-500">{error}</p>
      )}
    </div>
  );
}

