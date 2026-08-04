import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/colors';
import type { FlightOption } from '../types';

interface Props {
  option: FlightOption;
  onSelect: (option: FlightOption) => void;
  selected?: boolean;
}

const formatTime = (value: string | null) => {
  if (!value) return '--:--';
  const isoMatch = value.match(/(?:T| )(\d{2}):(\d{2})/);
  if (!isoMatch) return value;
  const hour = Number(isoMatch[1]);
  const minute = isoMatch[2];
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const airlineInitials = (name: string | null | undefined) => {
  const clean = (name || 'Airline').trim().split(/\s+/).filter(Boolean);
  return clean.slice(0, 2).map(part => part[0]).join('').toUpperCase();
};

export const FlightOptionCard = ({ option, onSelect, selected = false }: Props) => {
  const airline = option.airline || 'Airline';
  const price = option.price !== undefined && option.price !== null
    ? `${option.currency || 'USD'} ${Number(option.price).toLocaleString()}`
    : 'Fare unavailable';
  const departure = option.departure_time || option.departure_at || null;
  const arrival = option.arrival_time || option.return_at || null;
  const bookingLink = option.booking_link || option.generated_booking_link || option.link || null;
  const stops = option.transfers === undefined
    ? 'Stops unknown'
    : option.transfers === 0
      ? 'Non-stop'
      : `${option.transfers} stop${option.transfers === 1 ? '' : 's'}`;

  const openBookingLink = () => {
    if (bookingLink) Linking.openURL(bookingLink);
  };

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => onSelect(option)}
      style={({ pressed }) => [
        styles.card,
        selected && styles.selectedCard,
        pressed && styles.pressedCard,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.airlineRow}>
          <View style={[styles.logo, selected && styles.selectedLogo]}>
            <Text style={[styles.logoText, selected && styles.selectedLogoText]}>{airlineInitials(airline)}</Text>
          </View>
          <View style={styles.airlineCopy}>
            {option.is_best_value && (
              <Text style={styles.bestValue}>{selected ? 'BEST VALUE SELECTED' : 'BEST VALUE'}</Text>
            )}
            <Text numberOfLines={1} style={styles.airline}>{airline}</Text>
          </View>
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{price}</Text>
          <Text style={styles.priceCaption}>total for {option.passengers || 1}</Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.endpoint}>
          <Text style={styles.code}>{option.origin || '---'}</Text>
          <Text style={styles.time}>{formatTime(departure)}</Text>
        </View>
        <View style={styles.journey}>
          <Text style={styles.duration}>{option.duration || 'Flight'}</Text>
          <View style={styles.routeLine}>
            <View style={styles.routeDot} />
            <View style={styles.routeRule} />
            <Ionicons name="airplane" size={14} color="#27B987" style={styles.planeIcon} />
            <View style={styles.routeRule} />
            <View style={styles.routeDot} />
          </View>
          <Text style={styles.stops}>{stops}</Text>
        </View>
        <View style={[styles.endpoint, styles.arrivalEndpoint]}>
          <Text style={styles.code}>{option.destination || 'CMB'}</Text>
          <Text style={styles.time}>{formatTime(arrival)}</Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        {bookingLink ? (
          <Pressable onPress={openBookingLink} hitSlop={10} style={styles.bookingButton}>
            <Text style={styles.bookingText}>View details & booking</Text>
            <Ionicons name="open-outline" size={14} color="#27B987" style={{ marginLeft: 6, marginTop: -1 }} />
          </Pressable>
        ) : (
          <Text style={styles.noLinkText}>Booking link unavailable</Text>
        )}
        <View style={[styles.selector, selected && styles.selectorSelected]}>
          {selected && <Ionicons name="checkmark" size={16} color="#05120D" />}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0A1C14',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.15)',
  },
  selectedCard: { 
    borderColor: 'rgba(39, 185, 135, 0.6)', 
    backgroundColor: '#0C2218',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  pressedCard: { transform: [{ scale: 0.99 }], opacity: 0.95 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  airlineRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  logo: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(39, 185, 135, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.2)' },
  selectedLogo: { backgroundColor: 'rgba(39, 185, 135, 0.2)', borderColor: 'rgba(39, 185, 135, 0.4)' },
  logoText: { color: '#27B987', fontFamily: fonts.displayBold, fontSize: 13, letterSpacing: 0.5 },
  selectedLogoText: { color: '#38DFA8' },
  airlineCopy: { flex: 1, minWidth: 0 },
  bestValue: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 9.5, letterSpacing: 1.1, marginBottom: 4 },
  airline: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 16.5 },
  priceBlock: { alignItems: 'flex-end' },
  price: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 19 },
  priceCaption: { color: '#84A395', fontFamily: fonts.body, fontSize: 10.5, marginTop: 2 },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 20 },
  endpoint: { width: 78 },
  arrivalEndpoint: { alignItems: 'flex-end' },
  code: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 19 },
  time: { color: '#84A395', fontFamily: fonts.body, fontSize: 11.5, marginTop: 4 },
  journey: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  duration: { color: '#7A9C8D', fontFamily: fonts.body, fontSize: 10.5, marginBottom: 6 },
  routeLine: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  routeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#27B987' },
  routeRule: { flex: 1, height: 1, backgroundColor: 'rgba(39, 185, 135, 0.3)' },
  planeIcon: { marginHorizontal: 6 },
  stops: { color: '#7A9C8D', fontFamily: fonts.body, fontSize: 10.5, marginTop: 6 },
  bottomRow: { minHeight: 36, borderTopWidth: 1, borderTopColor: 'rgba(39, 185, 135, 0.15)', paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookingButton: { paddingVertical: 6, paddingRight: 12, flexDirection: 'row', alignItems: 'center' },
  bookingText: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 12.5 },
  noLinkText: { color: '#5E776A', fontFamily: fonts.body, fontSize: 11.5 },
  selector: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: 'rgba(39, 185, 135, 0.4)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(39, 185, 135, 0.05)' },
  selectorSelected: { backgroundColor: '#27B987', borderColor: '#27B987', shadowColor: '#27B987', shadowOpacity: 0.6, shadowRadius: 4, elevation: 2 },
});
