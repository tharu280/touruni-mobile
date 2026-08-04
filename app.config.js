const appJson = require('./app.json');

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

module.exports = {
  ...appJson.expo,
  plugins: [
    ...(appJson.expo.plugins || []),
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow TripMind to choose a photo for a private mood check.',
        cameraPermission: 'Allow TripMind to take a photo for a private mood check.',
      },
    ],
    'expo-secure-store',
    'expo-font',
  ],
  android: {
    ...appJson.expo.android,
    config: googleMapsApiKey
      ? {
          ...(appJson.expo.android?.config || {}),
          googleMaps: { apiKey: googleMapsApiKey },
        }
      : appJson.expo.android?.config,
  },
};
