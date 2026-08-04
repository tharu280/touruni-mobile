import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '../../theme/colors';
import type { Coordinate } from '../../types';

export type SchematicMarker = {
  id: string;
  coordinate: Coordinate;
  label: string;
  color?: string;
};

type Props = {
  coordinates: Coordinate[];
  markers?: SchematicMarker[];
  title?: string;
  detail?: string;
};

const WIDTH = 330;
const HEIGHT = 244;
const PADDING = 32;

const sampleCoordinates = (coordinates: Coordinate[]) => {
  if (coordinates.length <= 80) return coordinates;
  const step = (coordinates.length - 1) / 79;
  return Array.from({ length: 80 }, (_, index) => coordinates[Math.round(index * step)]);
};

export const CoordinateSchematic = ({
  coordinates,
  markers = [],
  title = 'Route Telemetry Active',
  detail = 'Displaying GPS topography. Add a Google Maps API key to render street tiles.',
}: Props) => {
  const geometry = useMemo(() => {
    const points = sampleCoordinates(coordinates);
    const all = [...points, ...markers.map(marker => marker.coordinate)];
    if (!all.length) return null;

    const latitudes = all.map(point => point.latitude);
    const longitudes = all.map(point => point.longitude);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.015);
    const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.015);

    const project = (point: Coordinate) => ({
      x: PADDING + ((point.longitude - minLongitude) / longitudeSpan) * (WIDTH - PADDING * 2),
      y: PADDING + ((maxLatitude - point.latitude) / latitudeSpan) * (HEIGHT - PADDING * 2),
    });

    return {
      points: points.map(project),
      markers: markers.map(marker => ({ ...marker, point: project(marker.coordinate) })),
    };
  }, [coordinates, markers]);

  return (
    <View style={styles.shell}>
      <View style={styles.grid}>
        <LinearGradient
          colors={['#071A12', '#030A07']}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Radar/Lat-Long Grid Lines */}
        {[...Array(6)].map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLineVertical, { left: (WIDTH / 6) * i }]} />
        ))}
        {[...Array(5)].map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLineHorizontal, { top: (HEIGHT / 5) * i }]} />
        ))}
        
        {/* Radar Orb */}
        <View style={styles.radarOrb} />
        <View style={styles.radarOrbInner} />

        {/* Route Line Segments */}
        {geometry?.points.slice(1).map((point, index) => {
          const previous = geometry.points[index];
          const deltaX = point.x - previous.x;
          const deltaY = point.y - previous.y;
          const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
          return (
            <View
              key={`segment-${index}`}
              style={[
                styles.segment,
                {
                  width: length,
                  left: (previous.x + point.x) / 2 - length / 2,
                  top: (previous.y + point.y) / 2 - 2,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}

        {/* Route Markers */}
        {geometry?.markers.map((marker, i) => (
          <View
            key={marker.id}
            style={[
              styles.marker,
              {
                left: marker.point.x - 18,
                top: marker.point.y - 18,
                backgroundColor: marker.color || '#27B987',
                zIndex: 10 + i,
              }
            ]}
          >
            <Text style={styles.markerLabel} numberOfLines={1}>{marker.label}</Text>
          </View>
        ))}

        {!geometry && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No route coordinates</Text>
            <Text style={styles.emptyText}>Map telemetry requires GPS coordinates.</Text>
          </View>
        )}
      </View>
      <View style={styles.caption}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    height: 310,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.25)',
    backgroundColor: '#05120D',
  },
  grid: {
    height: HEIGHT,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: '#030A07',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(39, 185, 135, 0.08)',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(39, 185, 135, 0.08)',
  },
  radarOrb: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 180,
    height: 180,
    marginLeft: -90,
    marginTop: -90,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.1)',
    backgroundColor: 'rgba(39, 185, 135, 0.02)',
  },
  radarOrbInner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 60,
    height: 60,
    marginLeft: -30,
    marginTop: -30,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.2)',
    backgroundColor: 'rgba(39, 185, 135, 0.05)',
  },
  segment: {
    position: 'absolute',
    height: 4,
    borderRadius: 4,
    backgroundColor: '#27B987',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 3,
  },
  marker: {
    position: 'absolute',
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#05120D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  markerLabel: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 10, fontWeight: '900' },
  caption: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(39, 185, 135, 0.25)',
    backgroundColor: 'rgba(39, 185, 135, 0.05)',
  },
  title: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800' },
  detail: { color: '#8BA398', fontFamily: fonts.body, fontSize: 11, lineHeight: 15, marginTop: 3 },
  empty: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 15, fontWeight: '800' },
  emptyText: { color: '#8BA398', fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 6 },
});
