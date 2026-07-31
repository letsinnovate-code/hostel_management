const { Client } = require('@googlemaps/google-maps-services-js');

const client = new Client({});

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Validate API key
if (!GOOGLE_MAPS_API_KEY) {
  console.warn('WARNING: GOOGLE_MAPS_API_KEY is not set in environment variables. Google Maps API calls will fail.');
}

// Geocode address to get coordinates
const geocodeAddress = async (address) => {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY in your environment variables.');
  }

  try {
    const response = await client.geocode({
      params: {
        address: address,
        key: GOOGLE_MAPS_API_KEY,
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        addressComponents: result.address_components,
      };
    }
    throw new Error('No results found for the address');
  } catch (error) {
    console.error('Geocoding Error:', error);
    throw new Error(`Failed to geocode address: ${error.message}`);
  }
};

// Reverse geocode coordinates to get address
const reverseGeocode = async (latitude, longitude) => {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY in your environment variables.');
  }

  try {
    const response = await client.reverseGeocode({
      params: {
        latlng: { lat: latitude, lng: longitude },
        key: GOOGLE_MAPS_API_KEY,
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      return {
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        addressComponents: result.address_components,
      };
    }
    throw new Error('No results found for the coordinates');
  } catch (error) {
    console.error('Reverse Geocoding Error:', error);
    throw new Error(`Failed to reverse geocode: ${error.message}`);
  }
};

// Get nearby places
const getNearbyPlaces = async (latitude, longitude, types = ['hospital', 'school', 'shopping_mall']) => {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY in your environment variables.');
  }

  try {
    const places = [];
    
    for (const type of types) {
      try {
        const response = await client.placesNearby({
          params: {
            location: { lat: latitude, lng: longitude },
            radius: 2000, // 2km radius
            type: type,
            key: GOOGLE_MAPS_API_KEY,
          },
        });

        if (response.data.results && response.data.results.length > 0) {
          const place = response.data.results[0];
          places.push({
            name: place.name,
            distance: place.vicinity || 'Nearby',
            type: type,
            location: {
              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng,
            },
          });
        }
      } catch (err) {
        console.error(`Error fetching ${type}:`, err);
      }
    }

    return places;
  } catch (error) {
    console.error('Nearby Places Error:', error);
    throw new Error(`Failed to get nearby places: ${error.message}`);
  }
};

// Get place details
const getPlaceDetails = async (placeId) => {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY in your environment variables.');
  }

  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        key: GOOGLE_MAPS_API_KEY,
        fields: ['name', 'formatted_address', 'geometry', 'photos', 'rating', 'reviews'],
      },
    });

    if (response.data.result) {
      return response.data.result;
    }
    throw new Error('Place not found');
  } catch (error) {
    console.error('Place Details Error:', error);
    throw new Error(`Failed to get place details: ${error.message}`);
  }
};

module.exports = {
  geocodeAddress,
  reverseGeocode,
  getNearbyPlaces,
  getPlaceDetails,
};

