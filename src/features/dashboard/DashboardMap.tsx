import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../../theme/colors';
import type { DashboardTab, DashboardViewModel } from './model';

type Props = {
  mode: Extract<DashboardTab, 'route' | 'crowd' | 'weather' | 'roads'>;
  model: DashboardViewModel;
};

const levelColor = (level: string) => {
  const normalized = level.toLowerCase();
  if (normalized.includes('high') || normalized.includes('severe') || normalized.includes('critical') || normalized.includes('unpassable') || normalized.includes('breakage') || normalized.includes('landslide')) return '#FF6B6B';
  if (normalized.includes('medium') || normalized.includes('moderate') || normalized.includes('foot') || normalized.includes('warning') || normalized.includes('closure')) return '#F2B84B';
  if (normalized.includes('unknown') || normalized.includes('unavailable') || normalized.includes('resolved')) return colors.textMuted;
  return colors.success;
};

export const DashboardMap = ({ mode, model }: Props) => {
  const routeCoordinates = (mode === 'route' || mode === 'roads') ? model.routeCoordinates : [];
  
  const markers = mode === 'route'
    ? [
      ...(model.originCoordinate ? [{ id: 'origin', coordinate: model.originCoordinate, label: 'Start', color: '#27B987' }] : []),
      ...model.dayMarkers.map(marker => ({ id: `day-${marker.day}`, coordinate: marker.coordinate, label: `D${marker.day}`, color: '#27B987' })),
      ...(model.destinationCoordinate ? [{ id: 'destination', coordinate: model.destinationCoordinate, label: 'End', color: '#38DFA8' }] : []),
    ]
    : mode === 'crowd'
      ? model.crowdPoints.map(point => ({ id: point.id, coordinate: point.coordinate, label: `D${point.day}`, color: levelColor(point.level) }))
      : mode === 'weather'
        ? model.weatherPoints.map(point => ({ id: point.id, coordinate: point.coordinate, label: `D${point.day}`, color: levelColor(point.level) }))
        : model.roadIncidents.map(incident => {
            const rawLabel = (incident.damage_type || 'Incident').replace(/_/g, ' ');
            const titleLabel = rawLabel.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            return {
              id: incident.report_number || `incident-${incident.coordinate.latitude}-${incident.coordinate.longitude}`,
              coordinate: incident.coordinate,
              label: titleLabel,
              color: '#FF6B6B',
            };
        });

  const allPointsForBounds = [
    ...routeCoordinates,
    ...markers.map(m => m.coordinate),
  ];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; background-color: #05120D; }
        #map { height: 100vh; width: 100vw; background-color: #05120D; }
        .leaflet-container { background: #05120D; }
        .leaflet-control-container { display: none; }
        
        .custom-marker { 
          color: white; 
          text-align: center; 
          line-height: 24px; 
          font-size: 11px; 
          font-weight: bold; 
          white-space: nowrap;
          width: fit-content !important;
          height: auto !important;
        }

        .incident-pill {
          position: relative;
          border-radius: 14px;
          border: 2px solid #05120D;
          box-shadow: 0 4px 6px rgba(0,0,0,0.4);
          padding: 0 10px;
          display: inline-block;
          transform: translate(-50%, -100%);
          white-space: nowrap;
        }

        .incident-pill::after {
          content: '';
          position: absolute;
          bottom: -6px;
          left: 50%;
          margin-left: -6px;
          border-width: 6px 6px 0;
          border-style: solid;
          /* The border-color is set inline via a style tag injected with the html */
        }
        .leaflet-layer,
        .leaflet-control-zoom-in,
        .leaflet-control-zoom-out,
        .leaflet-control-attribution {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { attributionControl: false, zoomControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        const routeData = ${JSON.stringify(routeCoordinates)};
        const markersData = ${JSON.stringify(markers)};
        const boundsData = ${JSON.stringify(allPointsForBounds)};

        const routeLatLngs = routeData.map(c => [c.latitude, c.longitude]);
        if (routeLatLngs.length > 0) {
          L.polyline(routeLatLngs, { color: '${mode === 'roads' ? '#FFFFFF' : '#27B987'}', weight: 4, opacity: 0.9 }).addTo(map);
        }

        markersData.forEach(m => {
          const contentHtml = '<style>.pill-' + m.id + '::after { border-color: ' + m.color + ' transparent transparent transparent; }</style>' +
            '<div class="incident-pill pill-' + m.id + '" style="background-color: ' + m.color + ';">' + m.label + '</div>';
          const icon = L.divIcon({
            className: 'custom-marker',
            html: contentHtml,
            iconSize: null,
            iconAnchor: [0, 0]
          });
          L.marker([m.coordinate.latitude, m.coordinate.longitude], { icon }).addTo(map);
        });

        const boundsLatLngs = boundsData.map(c => [c.latitude, c.longitude]);
        if (boundsLatLngs.length > 0) {
          map.fitBounds(L.polyline(boundsLatLngs).getBounds(), { padding: [35, 35] });
        } else {
          map.setView([7.8731, 80.7718], 7); // Default to Sri Lanka
        }

        // Force a resize calculation to ensure tiles load on Android mount
        setTimeout(() => { map.invalidateSize(); }, 250);
        setTimeout(() => { map.invalidateSize(); }, 750);
      </script>
    </body>
    </html>
  `;

  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMapReady(true), 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.shell} collapsable={false}>
      {mapReady ? (
        <WebView
          source={{ html }}
          style={[styles.map, { opacity: 0.99 }]}
          containerStyle={{ backgroundColor: '#05120D' }}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.map} />
      )}
      {allPointsForBounds.length === 0 && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyTitle}>No verified map points</Text>
          <Text style={styles.emptyText}>This view stays empty rather than estimating locations.</Text>
        </View>
      )}
      {mode === 'route' && routeCoordinates.length < 2 && (
        <View style={styles.dataNotice} pointerEvents="none">
          <Text style={styles.dataNoticeText}>Road geometry is unavailable. No straight-line route is shown.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    height: 310,
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: '#05120D',
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.25)',
  },
  map: { flex: 1, backgroundColor: '#05120D' },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    backgroundColor: 'rgba(5, 18, 13, 0.9)',
  },
  emptyTitle: { color: colors.cream, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  dataNotice: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(5, 18, 13, 0.86)',
  },
  dataNoticeText: { color: colors.warmWhite, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});

