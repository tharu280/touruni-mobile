import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Callout, Marker, Polyline } from 'react-native-maps';
import Svg, { Polyline as SvgPolyline, Circle, Line, LinearGradient, Defs, Stop, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addEmotionCheckin,
  addEmotionCheckinImage,
  getContextualAlternatives,
  getEmotionTargets,
} from '../../api/client';
import { PrimaryButton } from '../../components/PrimaryButton';
import { hasNativeGoogleMapsKey } from '../../config/maps';
import { useRepeatingDemoTask } from '../../hooks/useRepeatingDemoTask';
import { predictNextMood, MoodPrediction } from '../../utils/predictionEngine';
import { colors, fonts } from '../../theme/colors';
import type {
  Coordinate,
  ContextualAlternative,
  ContextualAlternativeGroup,
  DashboardPayload,
  DailyAttraction,
  EmotionCheckinRecord,
  EmotionCheckinResponse,
  EmotionLabel,
  EmotionTarget,
  EmotionTargetsResponse,
  NearbyMoodTip,
  RoadIncident,
} from '../../types';
import { DashboardMap } from './DashboardMap';
import { CoordinateSchematic } from './CoordinateSchematic';
import {
  asList,
  asNumber,
  asRecord,
  asText,
  type DashboardViewModel,
} from './model';
import {
  formatDate,
  formatLkr,
  Metric,
  RiskBadge,
  SectionHeading,
  SurfaceCard,
  titleCase,
} from './DashboardUI';

type CommonProps = {
  dashboard: DashboardPayload;
  model: DashboardViewModel;
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds) return 'Timing unavailable';
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder ? `${remainder}m` : ''}`.trim() : `${minutes}m`;
};

const formatRouteDuration = (value?: string | number | null) => {
  if (typeof value === 'number') return formatDuration(value);
  if (!value) return 'Unavailable';
  const secondsMatch = value.trim().match(/^(\d+(?:\.\d+)?)s$/i);
  return secondsMatch ? formatDuration(Number(secondsMatch[1])) : value;
};

const ConditionLine = ({ label, value, risk }: { label: string; value: string; risk?: string | null }) => (
  <View style={styles.conditionLine}>
    <View style={[styles.conditionDot, { backgroundColor: riskColor(risk) }]} />
    <Text style={styles.conditionLabel}>{label}</Text>
    <Text style={styles.conditionValue} numberOfLines={2}>{value}</Text>
  </View>
);

const riskColor = (value?: string | null) => {
  const normalized = value?.toLowerCase() || '';
  if (normalized.includes('high') || normalized.includes('critical') || normalized.includes('severe') || normalized.includes('unpassable') || normalized.includes('breakage') || normalized.includes('landslide')) return '#FF6B6B'; // Red
  if (normalized.includes('medium') || normalized.includes('moderate') || normalized.includes('foot') || normalized.includes('warning') || normalized.includes('closure')) return '#F2B84B'; // Orange
  if (normalized.includes('unknown') || normalized.includes('unavailable') || normalized.includes('resolved')) return colors.textMuted;
  return colors.success;
};

const DayBriefingCard = ({ day, initiallyOpen = false }: {
  day: DashboardViewModel['days'][number];
  initiallyOpen?: boolean;
}) => {
  const [open, setOpen] = useState(initiallyOpen);
  const dayNumber = day.day || 1;
  const attractions = asList<DailyAttraction>(day.attractions);
  const recommendations = asList<string>(day.recommendations).filter(Boolean);

  return (
    <SurfaceCard style={styles.dayCard}>
      <Pressable style={styles.dayHeader} onPress={() => setOpen(value => !value)}>
        <View style={styles.dayNumber}>
          <Text style={styles.dayNumberLabel}>DAY</Text>
          <Text style={styles.dayNumberValue}>{dayNumber}</Text>
        </View>
        <View style={styles.dayHeaderCopy}>
          <Text style={styles.dayDate}>{formatDate(day.date) || `Day ${dayNumber}`}</Text>
          <Text style={styles.dayLocation}>{day.location_label || day.title || `Route day ${dayNumber}`}</Text>
          <Text style={styles.dayRouteMeta}>
            {day.route?.distance_km ? `${day.route.distance_km.toFixed(1)} km` : 'Distance unavailable'}
            {' · '}{formatDuration(day.route?.duration_seconds)}
          </Text>
        </View>
        <View style={styles.dayHeaderEnd}>
          <RiskBadge value={day.overall_status || day.crowd?.risk_level} compact />
          <Text style={styles.expandGlyph}>{open ? '−' : '+'}</Text>
        </View>
      </Pressable>

      {open && (
        <View style={styles.dayBody}>
          {!!day.summary && <Text style={styles.bodyText}>{day.summary}</Text>}
          <View style={styles.conditionList}>
            <ConditionLine
              label="Crowd"
              risk={day.crowd?.risk_level}
              value={`${titleCase(day.crowd?.risk_level)}${day.crowd?.score == null ? '' : ` · ${Math.round(day.crowd.score)}/100`}`}
            />
            <ConditionLine
              label="Weather"
              risk={day.weather?.risk_level}
              value={day.weather?.condition || titleCase(day.weather?.risk_level)}
            />
            <ConditionLine
              label="Roads"
              risk={day.roads?.risk_level}
              value={`${titleCase(day.roads?.risk_level)}${day.roads?.route_alert_count ? ` · ${day.roads.route_alert_count} alerts` : ''}`}
            />
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionLabel}>PLANNED STOPS</Text>
            {attractions.length ? attractions.map((attraction, index) => (
              <View key={attraction.place_id || `${dayNumber}-${index}`} style={styles.attractionRow}>
                <View style={styles.attractionIndex}><Text style={styles.attractionIndexText}>{index + 1}</Text></View>
                <View style={styles.attractionCopy}>
                  <Text style={styles.attractionName}>{attraction.name || 'Unnamed stop'}</Text>
                  <Text style={styles.attractionMeta}>
                    {attraction.recommended_time ? `Best ${titleCase(attraction.recommended_time)}` : 'Timing flexible'}
                    {attraction.crowd?.score == null ? '' : ` · Crowd ${Math.round(attraction.crowd.score)}/100`}
                  </Text>
                  {!!attraction.action && <Text style={styles.attractionAdvice}>{attraction.action}</Text>}
                </View>
                <RiskBadge value={attraction.crowd?.level} compact />
              </View>
            )) : (
              <Text style={styles.mutedText}>No attraction stops are assigned to this travel day.</Text>
            )}
          </View>

          {!!day.accommodation?.name && (
            <View style={styles.stayRow}>
              <View style={styles.stayCopy}>
                <Text style={styles.subsectionLabel}>OVERNIGHT STAY</Text>
                <Text style={styles.stayName}>{day.accommodation.name}</Text>
                <Text style={styles.mutedText}>
                  {[day.accommodation.location, day.accommodation.rating ? `${day.accommodation.rating}/10` : null]
                    .filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={styles.price}>{formatLkr(day.accommodation.price_lkr)}</Text>
            </View>
          )}

          {!!recommendations.length && (
            <View style={styles.adviceBox}>
              <Text style={styles.adviceLabel}>TODAY'S ADVICE</Text>
              {recommendations.slice(0, 3).map((recommendation, index) => (
                <Text key={`${recommendation}-${index}`} style={styles.adviceText}>• {recommendation}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </SurfaceCard>
  );
};

const BudgetCard = ({ model }: { model: DashboardViewModel }) => {
  if (!model.budgetRows.length && model.totalBudget === null) return null;
  const usedPercent = model.totalBudget && model.totalBudget > 0
    ? Math.min(100, Math.round((model.actualSpend / model.totalBudget) * 100))
    : null;
  return (
    <SurfaceCard>
      <SectionHeading title="Budget" detail="Actual selected costs, not the full available lodging allowance." />
      <View style={styles.budgetRows}>
        {model.budgetRows.map(row => (
          <View key={row.label} style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>{row.label}</Text>
            <Text style={styles.budgetValue}>{formatLkr(row.amount)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.budgetTotal}>
        <Text style={styles.budgetTotalLabel}>Tracked spend</Text>
        <Text style={styles.budgetTotalValue}>{formatLkr(model.actualSpend)}</Text>
      </View>
      {model.totalBudget !== null && (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${usedPercent || 0}%` }]} />
          </View>
          <View style={styles.progressMeta}>
            <Text style={styles.mutedText}>{usedPercent}% of {formatLkr(model.totalBudget)}</Text>
            <Text style={[styles.mutedText, model.remainingBudget !== null && model.remainingBudget < 0 ? styles.negative : null]}>
              {formatLkr(model.remainingBudget)} remaining
            </Text>
          </View>
        </>
      )}
    </SurfaceCard>
  );
};

const SelectedFlightCard = ({ dashboard, model }: CommonProps) => {
  const flightPlan = asRecord(dashboard.flight);
  const selectedResult = asRecord(flightPlan.selected_result);
  const cheapestResult = asRecord(flightPlan.cheapest_result);
  const flight = Object.keys(selectedResult).length
    ? selectedResult
    : Object.keys(cheapestResult).length
      ? cheapestResult
      : flightPlan;
  const budget = asRecord(dashboard.budget_summary);
  const budgetHandoff = asRecord(flightPlan.budget_handoff);
  const airline = asText(flight.airline, flight.airline_name, flight.carrier, flight.airline_code);
  const origin = asText(
    flight.origin,
    flight.from_airport,
    flight.origin_code,
    flight.from,
    flightPlan.origin,
  );
  const destination = asText(
    flight.destination,
    flight.to_airport,
    flight.destination_code,
    flight.to,
    flightPlan.destination,
  );
  const departure = asText(flight.departure_time, flight.departure_at, flight.departure_date);
  const arrival = asText(flight.arrival_time, flight.arrival_at);
  const sourcePrice = asNumber(flight.price);
  const currency = asText(flight.currency) || 'USD';
  const estimatedLkr = asNumber(
    budget.selected_flight_budget_lkr_estimated,
    budget.flight_cost_lkr,
    budget.flights_lkr,
    budgetHandoff.selected_flight_budget_lkr_estimated,
  );
  const bookingLink = asText(
    flight.booking_link,
    flight.ticket_link,
    flight.generated_booking_link,
    flight.link,
  );
  const hasFlight = !!(airline || origin || destination || sourcePrice !== null || estimatedLkr !== null);

  if (!hasFlight) return null;

  const openBookingLink = async () => {
    if (!bookingLink) return;
    const supported = await Linking.canOpenURL(bookingLink);
    if (supported) await Linking.openURL(bookingLink);
  };

  return (
    <SurfaceCard>
      <SectionHeading eyebrow="Selected flight" title={airline || 'Flight to Sri Lanka'} detail="The flight confirmed before tour planning." />
      <View style={styles.flightRouteRow}>
        <View style={styles.flightEndpoint}>
          <Text style={styles.flightCode}>{origin || '---'}</Text>
          {!!departure && <Text style={styles.flightTime}>{departure}</Text>}
        </View>
        <View style={styles.flightJourney}>
          <View style={styles.flightRule} />
          <Text style={styles.flightPlane}>✈</Text>
          <View style={styles.flightRule} />
        </View>
        <View style={[styles.flightEndpoint, styles.flightArrival]}>
          <Text style={styles.flightCode}>{destination || 'CMB'}</Text>
          {!!arrival && <Text style={styles.flightTime}>{arrival}</Text>}
        </View>
      </View>
      <View style={styles.flightFareRow}>
        <View>
          <Text style={styles.subsectionLabel}>CONFIRMED FARE</Text>
          <Text style={styles.flightFare}>
            {sourcePrice !== null
              ? `${currency} ${sourcePrice.toLocaleString()}`
              : estimatedLkr !== null
                ? formatLkr(estimatedLkr)
                : 'Fare unavailable'}
          </Text>
        </View>
        {!!bookingLink && (
          <Pressable accessibilityRole="link" onPress={openBookingLink} style={styles.ticketButton}>
            <Text style={styles.ticketButtonText}>View ticket ↗</Text>
          </Pressable>
        )}
      </View>
      {sourcePrice !== null && estimatedLkr !== null && (
        <Text style={styles.mutedText}>Budget allocation: {formatLkr(estimatedLkr)}</Text>
      )}
      {!bookingLink && <Text style={styles.mutedText}>A booking link was not saved for this fare.</Text>}
    </SurfaceCard>
  );
};

const SelectedStaysCard = ({ model }: { model: DashboardViewModel }) => {
  const stays = model.days.flatMap(day => day.accommodation?.name
    ? [{ day: day.day || 1, stay: day.accommodation }]
    : []);

  if (!stays.length) return null;

  return (
    <SurfaceCard>
      <SectionHeading eyebrow="Accommodation" title="Selected stays" detail="One confirmed stay for each planned overnight." />
      <View style={styles.selectedStayList}>
        {stays.map(({ day, stay }) => (
          <View key={`${day}-${stay.name}`} style={styles.selectedStayRow}>
            <View style={styles.selectedStayDay}>
              <Text style={styles.selectedStayDayLabel}>DAY</Text>
              <Text style={styles.selectedStayDayValue}>{day}</Text>
            </View>
            <View style={styles.selectedStayCopy}>
              <Text style={styles.stayName}>{stay.name}</Text>
              <Text style={styles.mutedText}>
                {[stay.location, stay.rating ? `${stay.rating}/10` : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={styles.price}>{formatLkr(stay.price_lkr)}</Text>
          </View>
        ))}
      </View>
    </SurfaceCard>
  );
};

export const RouteSection = ({ dashboard, model }: CommonProps) => {
  const route = dashboard.route?.recommended_route;
  return (
    <View style={styles.sectionStack}>
      <DashboardMap mode="route" model={model} />
      <SurfaceCard>
        <SectionHeading eyebrow="Selected route" title={`${model.originName} to ${model.destinationName}`} detail={model.dateLabel || model.durationLabel} />
        <View style={styles.metricsRow}>
          <Metric label="Distance" value={route?.distance_meters ? `${(route.distance_meters / 1000).toFixed(1)} km` : 'Unavailable'} />
          <Metric label="Duration" value={formatRouteDuration(route?.duration)} />
          <Metric label="Days" value={String(model.days.length)} />
        </View>
      </SurfaceCard>
      <SurfaceCard>
        <SectionHeading title="Travel conditions" detail="Current planning signals across the complete trip." />
        <View style={styles.conditionList}>
          <ConditionLine label="Crowd" risk={model.crowdRisk} value={`${titleCase(model.crowdRisk)}${model.crowdScore == null ? '' : ` · ${Math.round(model.crowdScore)}/100`}`} />
          <ConditionLine label="Weather" risk={model.days[0]?.weather?.risk_level} value={titleCase(model.days[0]?.weather?.risk_level, 'Not checked')} />
          <ConditionLine label="Roads" risk={model.days[0]?.roads?.risk_level} value={`${titleCase(model.days[0]?.roads?.risk_level, 'Not checked')} · ${model.roadIncidents.length} mapped alerts`} />
        </View>
      </SurfaceCard>
      <SectionHeading eyebrow="Itinerary" title="Your trip, day by day" detail="Open a day for its stops, conditions, stay and practical advice." />
      {model.days.map((day, index) => <DayBriefingCard key={day.day || index} day={day} initiallyOpen={index === 0} />)}
      <SelectedStaysCard model={model} />
      <SelectedFlightCard dashboard={dashboard} model={model} />
      <BudgetCard model={model} />
    </View>
  );
};

export const CrowdSection = ({ dashboard, model }: CommonProps) => {
  const crowd = asRecord(dashboard.crowd);
  const recommendations = asList<string>(crowd.recommendations).filter(Boolean);

  let maxDayScore = -1;
  let busiestDayIndex = 0;
  model.days.forEach((day, index) => {
    let dayPeak = day.crowd?.score || -1;
    (day.attractions || []).forEach(a => {
      if (a.crowd?.score != null && a.crowd.score > dayPeak) {
        dayPeak = a.crowd.score;
      }
    });
    
    if (dayPeak > maxDayScore) {
      maxDayScore = dayPeak;
      busiestDayIndex = index;
    }
  });
  const busiestDayText = maxDayScore > -1 ? `Day ${model.days[busiestDayIndex]?.day || busiestDayIndex + 1} · ${Math.round(maxDayScore)}/100` : 'Unavailable';

  const bestWindows = model.days.map(d => d.crowd?.preferred_visit_window).filter(Boolean);
  const bestWindowText = bestWindows.length > 0 ? titleCase(bestWindows[0] as string) : 'Unavailable';

  let maxAttractionScore = -1;
  let busiestAttractionName = '';
  model.days.forEach(day => {
    (day.attractions || []).forEach(a => {
      const s = a.crowd?.score || -1;
      if (s > maxAttractionScore) {
        maxAttractionScore = s;
        busiestAttractionName = a.name || 'Unknown';
      }
    });
  });
  const busiestAttractionText = maxAttractionScore > -1 ? busiestAttractionName : 'Unavailable';

  return (
    <View style={styles.sectionStack}>
      <SurfaceCard style={{ paddingTop: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 11, color: '#1B765C', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>Crowd intelligence</Text>
            <Text style={{ fontFamily: fonts.displaySemibold, fontSize: 24, color: '#FFFFFF', marginBottom: 8 }}>Expected visitor pressure</Text>
          </View>
          <View style={{ backgroundColor: riskColor(model.crowdRisk) + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontFamily: fonts.bodySemibold, color: riskColor(model.crowdRisk), fontSize: 12, textTransform: 'capitalize' }}>
              {model.crowdRisk || 'Unknown'}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: '#9CA3AF', lineHeight: 22, marginBottom: 20 }}>
          {model.crowdSummary || 'No crowd summary available.'}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#0B1A14', padding: 16, borderRadius: 16 }}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 11, color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>Estimated Intensity</Text>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 18, color: '#FFFFFF' }}>{titleCase(model.crowdRisk)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#0B1A14', padding: 16, borderRadius: 16 }}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 11, color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>Busiest Day</Text>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 18, color: '#FFFFFF' }}>{busiestDayText}</Text>
          </View>
          <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#0B1A14', padding: 16, borderRadius: 16 }}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 11, color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>Best Visit Window</Text>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 18, color: '#FFFFFF' }}>{bestWindowText}</Text>
          </View>
          <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#0B1A14', padding: 16, borderRadius: 16 }}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 11, color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>Busiest Attraction</Text>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: '#FFFFFF', lineHeight: 20 }}>{busiestAttractionText}</Text>
          </View>
        </View>
      </SurfaceCard>
      <CrowdTrendGraph days={model.days} />

      {model.days.map((day, index) => (
        <SurfaceCard key={`crowd-${day.day || index}`}>
          <View style={styles.cardTitleRow}>
            <View style={{ flex: 1 }}>
              <SectionHeading eyebrow={formatDate(day.date) || undefined} title={`Day ${day.day || index + 1} · ${day.location_label || 'Route area'}`} detail={day.crowd?.preferred_visit_window ? `Preferred window: ${titleCase(day.crowd.preferred_visit_window)}` : undefined} />
            </View>
            <RiskBadge value={day.crowd?.risk_level} />
          </View>
          <View style={styles.attractionList}>
            {asList<DailyAttraction>(day.attractions).length ? asList<DailyAttraction>(day.attractions).map((attraction, attractionIndex) => (
              <View key={attraction.place_id || `${index}-${attractionIndex}`} style={styles.pressureRow}>
                <View style={styles.pressureCopy}>
                  <Text style={styles.attractionName}>{attraction.name || 'Attraction'}</Text>
                  <Text style={styles.mutedText}>
                    {attraction.crowd?.best_visit_window ? `Best: ${titleCase(attraction.crowd.best_visit_window)}` : 'Visit window unavailable'}
                  </Text>
                  {!!attraction.crowd?.reasons?.length && <Text style={styles.attractionAdvice}>{attraction.crowd.reasons[0]}</Text>}
                </View>
                <View style={styles.pressureEnd}>
                  <RiskBadge value={attraction.crowd?.level} compact />
                  {attraction.crowd?.score != null && <Text style={styles.score}>{Math.round(attraction.crowd.score)}/100</Text>}
                </View>
              </View>
            )) : <Text style={styles.mutedText}>No attraction-level crowd estimate is available for this day.</Text>}
          </View>
        </SurfaceCard>
      ))}
      {!!recommendations.length && (
        <SurfaceCard>
          <SectionHeading title="What to adjust" />
          {recommendations.slice(0, 4).map((item, index) => <Text key={`${item}-${index}`} style={styles.adviceText}>• {item}</Text>)}
        </SurfaceCard>
      )}
    </View>
  );
};

const CrowdTrendGraph = ({ days }: { days: any[] }) => {
  if (days.length < 2) return null;

  const points = days.map((day, i) => {
    let maxScore = -1;
    let peakName = '';
    
    (day.attractions || []).forEach((a: any) => {
      const s = a.crowd?.score;
      if (s != null && s > maxScore) {
        maxScore = s;
        peakName = a.name || 'Attraction';
      }
    });

    if (maxScore === -1) {
      maxScore = day.crowd?.score ?? 50;
      peakName = 'Area Average';
    }
    return { score: maxScore, peakName, dateString: day.date };
  });

  const getDayName = (dateString: string, index: number) => {
    if (!dateString) return `D${index + 1}`;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } catch (e) {
      return `D${index + 1}`;
    }
  };

  const getColor = (score: number) => {
    if (score >= 75) return '#FF3B30';
    if (score >= 40) return '#FF9F43';
    return '#38DFA8';
  };

  const getLabel = (score: number) => {
    if (score >= 75) return 'Packed';
    if (score >= 40) return 'Busy';
    return 'Quiet';
  };

  const graphWidth = Math.max(days.length * 100, 320) + 60; // 60px padding
  const xStep = (graphWidth - 60) / days.length;
  const height = 210;
  
  const mapY = (score: number) => 170 - (score / 100) * 120;

  const graphPoints = points.map((p, i) => {
    // start at x=30 so points don't overlap with the left text labels
    const x = 30 + (i * xStep) + (xStep / 2);
    const y = mapY(p.score);
    return { ...p, x, y, color: getColor(p.score), status: getLabel(p.score), label: getDayName(p.dateString, i) };
  });

  const polylineStr = graphPoints.map(p => `${p.x},${p.y}`).join(' ');
  const polygonStr = `${graphPoints[0].x},180 ${polylineStr} ${graphPoints[graphPoints.length - 1].x},180`;

  const truncate = (str: string, max: number) => str.length > max ? str.substring(0, max - 1) + '…' : str;

  return (
    <SurfaceCard style={{ paddingHorizontal: 0, paddingBottom: 16, paddingTop: 20, overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <SectionHeading title="Daily Crowd Trend" detail="Expected peak density across your itinerary." />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' }}/><Text style={{ color: '#9CA3AF', fontSize: 11 }}>Packed</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF9F43' }}/><Text style={{ color: '#9CA3AF', fontSize: 11 }}>Busy</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#38DFA8' }}/><Text style={{ color: '#9CA3AF', fontSize: 11 }}>Quiet</Text></View>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
        <Svg width={graphWidth} height={height}>
          <Defs>
            <LinearGradient id="crowdGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#B11DDF" stopOpacity="0.3" />
              <Stop offset="1" stopColor="#B11DDF" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>
          
          <Line x1="0" y1={mapY(75)} x2={graphWidth} y2={mapY(75)} stroke="#3A4045" strokeWidth="1" strokeDasharray="4 4" />
          <Line x1="0" y1={mapY(25)} x2={graphWidth} y2={mapY(25)} stroke="#3A4045" strokeWidth="1" strokeDasharray="4 4" />
          <SvgText x={4} y={mapY(75) - 4} fill="#6B7280" fontSize="10">High Risk</SvgText>
          <SvgText x={4} y={mapY(25) - 4} fill="#6B7280" fontSize="10">Low Risk</SvgText>

          <Polygon points={polygonStr} fill="url(#crowdGrad)" />
          <SvgPolyline points={polylineStr} fill="none" stroke="#B11DDF" strokeWidth="2" />
          
          {graphPoints.map((p, i) => (
            <React.Fragment key={`p-${i}`}>
              <Circle cx={p.x} cy={p.y} r="6" fill="#111B18" stroke={p.color} strokeWidth="3" />
              <SvgText x={p.x} y={p.y - 12} fill={p.color} fontSize="12" fontWeight="bold" textAnchor="middle">
                {Math.round(p.score)}
              </SvgText>
              <SvgText x={p.x} y={p.y + 18} fill="#E8EAED" fontSize="10" textAnchor="middle">
                {truncate(p.peakName, 12)}
              </SvgText>
              <SvgText x={p.x} y="200" fill="#9CA3AF" fontSize="11" textAnchor="middle">
                {p.label}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>
      </ScrollView>
    </SurfaceCard>
  );
};

const WeatherGraph = ({ days }: { days: any[] }) => {
  const validDays = days.filter(d => d.weather != null);
  if (validDays.length < 2) return null;

  const maxTemp = Math.max(...validDays.map(d => d.weather.temperature_max_c ?? 0));
  const minTemp = Math.min(...validDays.map(d => d.weather.temperature_min_c ?? d.weather.temperature_max_c ?? 100));
  
  const tempMinY = Math.max(0, minTemp - 5);
  const tempMaxY = maxTemp + 5;
  
  // Make the graph wide enough to breathe, but center it if there are only a few days
  const graphWidth = Math.max(validDays.length * 85, 320);
  const xStep = graphWidth / validDays.length;
  const height = 210;

  const getWeatherEmoji = (condition: string) => {
    const c = (condition || '').toLowerCase();
    if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌧️';
    if (c.includes('storm') || c.includes('thunder')) return '⛈️';
    if (c.includes('cloud') || c.includes('overcast')) return '☁️';
    if (c.includes('clear') || c.includes('sun')) return '☀️';
    return '⛅';
  };

  const getDayName = (dateString: string, index: number) => {
    if (!dateString) return `D${index + 1}`;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } catch (e) {
      return `D${index + 1}`;
    }
  };

  const points = validDays.map((day, i) => {
    const maxT = day.weather.temperature_max_c ?? 0;
    const minT = day.weather.temperature_min_c ?? maxT;
    const rain = day.weather.rain_probability_pct ?? 0;
    const condition = day.weather.condition || '';
    
    const x = (i * xStep) + (xStep / 2);
    // Map temperatures between Y=70 and Y=150 (80px height)
    const yMax = 150 - ((maxT - tempMinY) / (tempMaxY - tempMinY)) * 80;
    const yMin = 150 - ((minT - tempMinY) / (tempMaxY - tempMinY)) * 80;
    
    return { x, yMax, yMin, maxT, minT, rain, emoji: getWeatherEmoji(condition), dayName: getDayName(day.date, i) };
  });

  const maxPolyline = points.map(p => `${p.x},${p.yMax}`).join(' ');
  const minPolyline = points.map(p => `${p.x},${p.yMin}`).join(' ');
  
  // Create a closed polygon (ribbon) between the max and min lines
  const ribbonPolygon = [
    ...points.map(p => `${p.x},${p.yMax}`),
    ...[...points].reverse().map(p => `${p.x},${p.yMin}`)
  ].join(' ');

  return (
    <SurfaceCard style={{ paddingHorizontal: 0, paddingBottom: 0, paddingTop: 16, overflow: 'hidden' }}>
      
      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 12, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF9F43' }} />
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>High</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#38DFA8' }} />
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>Low</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 10 }}>💧</Text>
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>Rain %</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 0, flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ width: graphWidth, height: height }}>
          <Svg width="100%" height={height}>
            <Defs>
              <LinearGradient id="ribbonGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FF9F43" stopOpacity="0.25" />
                <Stop offset="1" stopColor="#38DFA8" stopOpacity="0.15" />
              </LinearGradient>
            </Defs>

            {/* Subtle Grid lines */}
            <Line x1="0" y1="70" x2="100%" y2="70" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 4" />
            <Line x1="0" y1="110" x2="100%" y2="110" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 4" />
            <Line x1="0" y1="150" x2="100%" y2="150" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 4" />
            
            {/* Temperature Ribbon Fill */}
            <Polygon points={ribbonPolygon} fill="url(#ribbonGrad)" />
            
            {/* Min Temperature Line (Cool color) */}
            <SvgPolyline points={minPolyline} fill="none" stroke="#38DFA8" strokeWidth="2.5" />
            
            {/* Max Temperature Line (Warm color) */}
            <SvgPolyline points={maxPolyline} fill="none" stroke="#FF9F43" strokeWidth="2.5" />
            
            {points.map((p, i) => (
              <React.Fragment key={`data-${i}`}>
                {/* Day Header */}
                <SvgText x={p.x} y={24} fill="#E5E7EB" fontSize="13" textAnchor="middle" fontWeight="bold">
                  {p.dayName}
                </SvgText>
                
                {/* Weather Emoji */}
                <SvgText x={p.x} y={48} fontSize="18" textAnchor="middle">
                  {p.emoji}
                </SvgText>

                {/* Max Temp Nodes & Labels */}
                <Circle cx={p.x} cy={p.yMax} r="4" fill="#0B1C14" stroke="#FF9F43" strokeWidth="2" />
                <SvgText x={p.x} y={p.yMax - 10} fill="#FF9F43" fontSize="12" fontWeight="bold" textAnchor="middle">
                  {Math.round(p.maxT)}°
                </SvgText>

                {/* Min Temp Nodes & Labels */}
                <Circle cx={p.x} cy={p.yMin} r="4" fill="#0B1C14" stroke="#38DFA8" strokeWidth="2" />
                <SvgText x={p.x} y={p.yMin + 18} fill="#38DFA8" fontSize="11" fontWeight="bold" textAnchor="middle">
                  {Math.round(p.minT)}°
                </SvgText>

                {/* Rain Indicator at Bottom */}
                <SvgText x={p.x} y={190} fill={p.rain > 20 ? "#4099FF" : "#6B7280"} fontSize="11" textAnchor="middle" fontWeight="bold">
                  {p.rain > 0 ? `💧 ${Math.round(p.rain)}%` : '--'}
                </SvgText>
              </React.Fragment>
            ))}
          </Svg>
        </View>
      </ScrollView>
    </SurfaceCard>
  );
};

export const WeatherSection = ({ model }: CommonProps) => (
  <View style={styles.sectionStack}>
    <SectionHeading eyebrow="Forecast" title="Weather by travel day" detail="Rain probability is shown separately from overall disruption risk." />
    <WeatherGraph days={model.days} />
    {model.days.map((day, index) => (
      <SurfaceCard key={`weather-${day.day || index}`}>
        <View style={styles.cardTitleRow}>
          <View style={{ flex: 1 }}>
            <SectionHeading eyebrow={formatDate(day.date) || undefined} title={`Day ${day.day || index + 1} · ${day.location_label || 'Route area'}`} detail={day.weather?.condition || 'Forecast detail unavailable'} />
          </View>
          <RiskBadge value={day.weather?.risk_level || day.weather?.status} />
        </View>
        <View style={styles.metricsRow}>
          <Metric label="High / low" value={day.weather?.temperature_max_c == null ? 'Unavailable' : `${Math.round(day.weather.temperature_max_c)}° / ${Math.round(day.weather.temperature_min_c || day.weather.temperature_max_c)}°C`} />
          <Metric label="Rain chance" value={day.weather?.rain_probability_pct == null ? 'Unavailable' : `${Math.round(day.weather.rain_probability_pct)}%`} />
          <Metric label="Wind" value={day.weather?.wind_speed_kph == null ? 'Unavailable' : `${Math.round(day.weather.wind_speed_kph)} km/h`} />
        </View>
        {!!day.weather?.guidance && <View style={styles.adviceBox}><Text style={styles.adviceText}>{day.weather.guidance}</Text></View>}
        {!!day.weather?.reasons?.length && <Text style={styles.mutedText}>{day.weather.reasons.join(' · ')}</Text>}
      </SurfaceCard>
    ))}
  </View>
);

const incidentKey = (incident: RoadIncident, index: number) => incident.report_number || `${incident.location}-${incident.damage_type}-${index}`;

export const RoadsSection = ({ model }: CommonProps) => {
  const incidents = useMemo(() => {
    const all = model.days.flatMap(day => asList<RoadIncident>(day.roads?.incidents));
    const seen = new Set<string>();
    return all.filter((incident, index) => {
      const key = incidentKey(incident, index);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [model.days]);

  return (
    <View style={styles.sectionStack}>
      <DashboardMap mode="roads" model={model} />
      <SurfaceCard>
        <SectionHeading eyebrow="RoadLK" title="Road warnings" detail={`${incidents.length} alerts are associated with this trip. Only ${model.roadIncidents.length} have verified coordinates and appear on the map.`} />
        <View style={styles.incidentList}>
          {incidents.length ? incidents.map((incident, index) => {
            const isResolved = incident.status?.toLowerCase() === 'resolved';
            const riskStr = isResolved ? 'resolved' : (incident.passability || incident.status || incident.damage_type);
            const color = riskColor(riskStr);
            
            return (
            <View key={incidentKey(incident, index)} style={styles.incidentRow}>
              <View style={[styles.incidentDot, { backgroundColor: color }]} />
              <View style={styles.incidentCopy}>
                <Text style={[styles.attractionName, { color: isResolved ? colors.textMuted : colors.text }]}>
                  {titleCase((incident.damage_type || 'Road incident').replace(/_/g, ' '))}
                </Text>
                <Text style={styles.mutedText}>{incident.location || incident.district || 'Location not supplied by RoadLK'}</Text>
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {[titleCase(incident.status), titleCase(incident.passability)].filter(Boolean).map((tag, i) => (
                    <View key={i} style={{ backgroundColor: isResolved ? 'rgba(255,255,255,0.05)' : `${color}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: isResolved ? 'rgba(255,255,255,0.1)' : `${color}40` }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: isResolved ? colors.textMuted : color }}>{tag}</Text>
                    </View>
                  ))}
                  {incident.distance_to_route_meters != null && (
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textMuted }}>{Math.round(incident.distance_to_route_meters)} m from route</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}) : <Text style={styles.mutedText}>No RoadLK alerts are associated with this route.</Text>}
        </View>
      </SurfaceCard>
    </View>
  );
};

const MOODS = [
  { key: 'happy', label: 'Happy', symbol: '😊' },
  { key: 'surprise', label: 'Surprised', symbol: '😮' },
  { key: 'neutral', label: 'Neutral', symbol: '😐' },
  { key: 'sad', label: 'Sad', symbol: '😢' },
  { key: 'anger', label: 'Angry', symbol: '😠' },
] as const;

const INTERESTS = [
  { id: 'Nature', label: '🌲 Nature' },
  { id: 'Culture', label: '🏛️ Culture' },
  { id: 'Food', label: '🍲 Food' },
  { id: 'Photography', label: '📸 Photo' },
  { id: 'Sports', label: '🏃‍♂️ Sports' },
  { id: 'Wellness', label: '🧘‍♀️ Wellness' },
  { id: 'Arts', label: '🎨 Arts' },
  { id: 'Shopping', label: '🛍️ Shop' }
];

const responseTips = (response: EmotionCheckinResponse | null): NearbyMoodTip[] => {
  if (!response?.nearby_tips) return [];
  if (Array.isArray(response.nearby_tips)) return response.nearby_tips;
  return asList<NearbyMoodTip>(response.nearby_tips.recommendations);
};

const alternativesFromResponse = (response: Awaited<ReturnType<typeof getContextualAlternatives>> | null) => {
  if (!response) return [];
  const flat = [...asList<ContextualAlternative>(response.alternatives), ...asList<ContextualAlternative>(response.items)];
  const grouped = asList<ContextualAlternativeGroup>(response.recommendation_groups)
    .flatMap(group => asList<ContextualAlternative>(group.alternatives));
  return [...flat, ...grouped].filter((item, index, all) => all.findIndex(other => other.name === item.name) === index);
};

const MOOD_COLORS: Record<EmotionLabel, string> = {
  anger: '#EF6A6A',
  happy: '#5CE1B5',
  neutral: '#94A99F',
  sad: '#6EA8E8',
  surprise: '#F2B84B',
  uncertain: '#77877F',
};

const MOOD_SCORES: Record<EmotionLabel, number> = {
  anger: 1,
  sad: 2,
  uncertain: 3,
  neutral: 3,
  surprise: 4,
  happy: 5,
};

const normalizeMood = (value?: string | null): EmotionLabel => {
  const mood = (value || 'uncertain').toLowerCase() as EmotionLabel;
  return mood in MOOD_COLORS ? mood : 'uncertain';
};

const targetCoordinate = (target?: EmotionTarget | null): Coordinate | null => {
  if (!target || target.latitude == null || target.longitude == null) return null;
  if (!Number.isFinite(target.latitude) || !Number.isFinite(target.longitude)) return null;
  return { latitude: target.latitude, longitude: target.longitude };
};

const dedupeEmotionTargets = (targets: EmotionTarget[]) => {
  const seen = new Set<string>();
  return targets.filter(target => {
    const identity = target.attraction_id
      || [target.attraction_name, target.latitude, target.longitude].join('|').toLowerCase();
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

const buildFallbackTargets = (model: DashboardViewModel): EmotionTarget[] => dedupeEmotionTargets(model.days.flatMap(day => (
  asList<DailyAttraction>(day.attractions).map((attraction, index) => ({
    attraction_id: attraction.place_id || `day-${day.day || 1}-attraction-${index + 1}`,
    attraction_name: attraction.name || `Day ${day.day || 1} stop ${index + 1}`,
    day: day.day || 1,
    day_label: day.location_label || day.title || `Day ${day.day || 1}`,
    order: index + 1,
    district: attraction.district || undefined,
    latitude: attraction.latitude ?? attraction.location?.latitude ?? null,
    longitude: attraction.longitude ?? attraction.location?.longitude ?? null,
    source: 'mobile_dashboard',
  }))
)));

const MoodJourneyMap = ({
  model,
  targets,
  checkins,
  selectedTargetId,
  onSelect,
  isActive = true,
}: {
  model: DashboardViewModel;
  targets: EmotionTarget[];
  checkins: EmotionCheckinRecord[];
  selectedTargetId: string | null;
  onSelect: (targetId: string) => void;
  isActive?: boolean;
}) => {
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    if (!isActive) {
      setMapReady(false);
      return;
    }
    const timer = setTimeout(() => setMapReady(true), 150);
    return () => clearTimeout(timer);
  }, [isActive]);
  const mapRef = useRef<MapView | null>(null);
  const coordinates = useMemo(
    () => targets.map(targetCoordinate).filter((item): item is Coordinate => Boolean(item)),
    [targets],
  );
  const latestByTarget = useMemo(() => {
    const result = new Map<string, EmotionCheckinRecord>();
    checkins.forEach(checkin => {
      if (checkin.attraction_id) result.set(checkin.attraction_id, checkin);
    });
    return result;
  }, [checkins]);
  const mapTargets = useMemo(() => {
    const included = new Set<string>();
    const result: EmotionTarget[] = [];

    const selected = targets.find(t => t.attraction_id === selectedTargetId);
    if (selected) {
      result.push(selected);
      included.add(selected.attraction_id);
    }

    targets.forEach(t => {
      if (latestByTarget.has(t.attraction_id) && !included.has(t.attraction_id)) {
        result.push(t);
        included.add(t.attraction_id);
      }
    });

    const byDay = new Map<number, EmotionTarget[]>();
    targets.forEach(target => {
      const dayTargets = byDay.get(target.day) || [];
      dayTargets.push(target);
      byDay.set(target.day, dayTargets);
    });

    for (const [, dayTargets] of byDay.entries()) {
      const hasMarkerForDay = dayTargets.some(t => included.has(t.attraction_id));
      if (!hasMarkerForDay && dayTargets.length > 0) {
        result.push(dayTargets[0]);
        included.add(dayTargets[0].attraction_id);
      }
    }

    return result;
  }, [latestByTarget, selectedTargetId, targets]);

  useEffect(() => {
    const fit = coordinates.length ? coordinates : model.routeCoordinates;
    if (!fit.length) return;
    const timer = setTimeout(() => mapRef.current?.fitToCoordinates(fit, {
      animated: false,
      edgePadding: { top: 52, right: 44, bottom: 52, left: 44 },
    }), 200);
    return () => clearTimeout(timer);
  }, [coordinates, model.routeCoordinates]);

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
          border-radius: 50%; 
          text-align: center; 
          line-height: 24px; 
          font-size: 10px; 
          font-weight: bold; 
          border: 2px solid #05120D;
          box-shadow: 0 4px 6px rgba(0,0,0,0.4);
        }
        .emoji-marker {
          font-size: 13px;
          line-height: 25px;
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

        const routeData = ${JSON.stringify(model.routeCoordinates || [])};
        const markersData = ${JSON.stringify(mapTargets.map(target => {
          const coordinate = targetCoordinate(target);
          const checkin = latestByTarget.get(target.attraction_id);
          const mood = normalizeMood(checkin?.emotion_label);
          return coordinate ? {
            id: target.attraction_id,
            coordinate,
            label: checkin ? MOODS.find(item => item.key === mood)?.symbol || ('D' + target.day) : ('D' + target.day),
            color: checkin ? MOOD_COLORS[mood] : target.attraction_id === selectedTargetId ? '#38DFA8' : '#8BA398',
            isEmoji: !!checkin
          } : null;
        }).filter(Boolean))};
        
        const orphanCheckins = ${JSON.stringify(checkins.filter(c => !c.attraction_id || !mapTargets.some(t => t.attraction_id === c.attraction_id)).map((c, i) => {
          let lat = c.user_location?.latitude;
          let lng = c.user_location?.longitude;
          if (!lat || !lng) {
            const fallbackTarget = mapTargets.find(t => t.day === c.day);
            if (fallbackTarget && (fallbackTarget as any).attraction_location) {
              lat = (fallbackTarget as any).attraction_location.lat;
              lng = (fallbackTarget as any).attraction_location.lng;
            }
          }
          if (!lat || !lng) return null;
          const mood = normalizeMood(c.emotion_label);
          return {
            id: c.checkin_id || 'orphan-' + i,
            coordinate: { latitude: lat, longitude: lng },
            label: MOODS.find(item => item.key === mood)?.symbol || '•',
            color: MOOD_COLORS[mood] || '#8BA398',
            isEmoji: true
          };
        }).filter(Boolean))};
        
        const allMarkers = [...markersData, ...orphanCheckins];
        
        const uniqueMarkersMap = new Map();
        allMarkers.forEach(m => {
          const key = m.coordinate.latitude + ',' + m.coordinate.longitude;
          if (!uniqueMarkersMap.has(key)) {
            uniqueMarkersMap.set(key, m);
          } else {
            const existing = uniqueMarkersMap.get(key);
            if (m.isEmoji && !existing.isEmoji) {
              if (existing.color === '#38DFA8') m.isSelected = true;
              uniqueMarkersMap.set(key, m);
            }
          }
        });
        
        const finalMarkers = Array.from(uniqueMarkersMap.values());

        const routeLatLngs = routeData.map(c => [c.latitude, c.longitude]);
        if (routeLatLngs.length > 0) {
          L.polyline(routeLatLngs, { color: '#27B987', weight: 4, opacity: 0.9 }).addTo(map);
        }

        finalMarkers.forEach(m => {
          const borderStyle = m.isSelected ? 'border: 2px solid #38DFA8; box-shadow: 0 0 8px rgba(56, 223, 168, 0.6); box-sizing: border-box;' : '';
          const icon = L.divIcon({
            className: 'custom-marker ' + (m.isEmoji ? 'emoji-marker' : ''),
            html: '<div style="background-color: ' + m.color + '; width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; ' + borderStyle + '">' + m.label + '</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          L.marker([m.coordinate.latitude, m.coordinate.longitude], { icon, zIndexOffset: m.isEmoji || m.isSelected ? 1000 : 0 }).addTo(map);
        });

        const boundsData = [...routeData, ...allMarkers.map(m => m.coordinate)];
        const boundsLatLngs = boundsData.map(c => [c.latitude, c.longitude]);
        if (boundsLatLngs.length > 0) {
          map.fitBounds(L.polyline(boundsLatLngs).getBounds(), { padding: [35, 35] });
        } else {
          map.setView([7.8731, 80.7718], 7);
        }

        // Force a resize calculation to ensure tiles load on Android mount
        setTimeout(() => { map.invalidateSize(); }, 250);
        setTimeout(() => { map.invalidateSize(); }, 750);
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.moodMapShell} collapsable={false}>
      {mapReady ? (
        <WebView
          source={{ html }}
          style={[styles.moodMap, { opacity: 0.99 }]}
          containerStyle={{ backgroundColor: '#05120D' }}
          scrollEnabled={false}
          nestedScrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.moodMap} />
      )}
      {!coordinates.length && (
        <View style={styles.moodMapEmpty} pointerEvents="none">
          <Text style={styles.moodMapEmptyTitle}>Checkpoint map unavailable</Text>
          <Text style={styles.moodMapEmptyText}>No verified attraction coordinates were saved for this trip.</Text>
        </View>
      )}
    </View>
  );
};

const MoodHistory = ({ checkins, prediction }: { checkins: EmotionCheckinRecord[], prediction?: MoodPrediction | null }) => {
  const [showAll, setShowAll] = useState(false);
  if (!checkins.length) return null;
  const visibleCheckins = showAll ? checkins : checkins.slice(-7);
  const firstMood = normalizeMood(visibleCheckins[0].emotion_label);
  const lastMood = normalizeMood(visibleCheckins[visibleCheckins.length - 1].emotion_label);
  const recovery = MOOD_SCORES[lastMood] - MOOD_SCORES[firstMood];

  return (
    <SurfaceCard>
      <View style={styles.cardTitleRow}>
        <View style={styles.placeTitleCopy}>
          <Text style={styles.attractionName}>Mood journey</Text>
          <Text style={styles.mutedText}>
            {recovery > 0 ? `Recovery improved by ${recovery} level${recovery === 1 ? '' : 's'}.` : recovery < 0 ? 'Mood is trending lower. Keep the next stop gentle.' : 'Mood is steady across recent stops.'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={styles.historyCount}>{checkins.length} check-ins</Text>
          {recovery !== 0 && (
            <View style={[styles.recoveryBadge, { backgroundColor: recovery > 0 ? 'rgba(39, 185, 135, 0.15)' : 'rgba(255, 107, 107, 0.15)' }]}>
              <Text style={[styles.recoveryBadgeText, { color: recovery > 0 ? '#27B987' : '#FF6B6B' }]}>
                {recovery > 0 ? '+' : ''}{recovery} {Math.abs(recovery) === 1 ? 'Level' : 'Levels'}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.historyGraphOuter}>
        {!showAll ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, minWidth: '100%' }}>
            {visibleCheckins.map((checkin, index) => {
              const itemMood = normalizeMood(checkin.emotion_label);
              return (
                <View key={checkin.checkin_id || `${checkin.timestamp || 'checkin'}-${index}`} style={styles.historyBarColumn}>
                  <View style={styles.historyBarTrack}>
                    <View style={[styles.historyBar, { height: `${MOOD_SCORES[itemMood] * 18}%`, backgroundColor: MOOD_COLORS[itemMood] }]} />
                  </View>
                  <Text style={styles.historyEmoji}>{MOODS.find(item => item.key === itemMood)?.symbol || '•'}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {(() => {
              const graphWidth = Math.max(checkins.length * 52, 320);
              const xStep = graphWidth / Math.max(checkins.length, 1);
              
              const points = checkins.map((checkin, i) => {
                const mood = normalizeMood(checkin.emotion_label);
                const score = MOOD_SCORES[mood] || 3;
                const y = 90 - (score - 1) * 18; 
                const x = (i * xStep) + (xStep / 2);
                return { x, y, mood, score, symbol: MOODS.find(item => item.key === mood)?.symbol || '•' };
              });
              
              const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');
              const polygonPoints = points.length ? `${points[0].x},110 ${polylinePoints} ${points[points.length - 1].x},110` : '';
              
              return (
                <View style={{ width: graphWidth, height: 150, marginTop: 10 }}>
                  <Svg width="100%" height={110}>
                    <Defs>
                      <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#27B987" stopOpacity="0.4" />
                        <Stop offset="1" stopColor="#27B987" stopOpacity="0.0" />
                      </LinearGradient>
                    </Defs>
                    
                    {[18, 36, 54, 72, 90].map((y, i) => (
                      <Line key={`grid-${i}`} x1="0" y1={y} x2={graphWidth} y2={y} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" strokeDasharray="4, 4" />
                    ))}
                    
                    {points.length > 0 && <Polygon points={polygonPoints} fill="url(#grad)" />}
                    
                    <SvgPolyline points={polylinePoints} stroke="#27B987" strokeWidth="3" fill="none" strokeLinejoin="round" />
                    
                    {points.map((p, i) => (
                      <Circle key={`c-${i}`} cx={p.x} cy={p.y} r={5} fill={MOOD_COLORS[p.mood]} stroke="#05120D" strokeWidth="2.5" />
                    ))}
                  </Svg>
                  
                  <View style={{ flexDirection: 'row', width: '100%', height: 30, position: 'absolute', bottom: 0, left: 0 }}>
                    {points.map((p, i) => (
                      <View key={`t-${i}`} style={{ position: 'absolute', left: p.x - 15, width: 30, alignItems: 'center' }}>
                        <Text style={{ fontSize: 16 }}>{p.symbol}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}
          </ScrollView>
        )}
      </View>
      <View style={styles.historyFooter}>
        <Text style={styles.historyCaption}>Earlier check-ins → latest check-in</Text>
        {checkins.length > 7 && (
          <Pressable onPress={() => setShowAll(!showAll)} style={styles.seeAllButton}>
            <Text style={styles.seeAllButtonText}>{showAll ? 'Show less' : `See all ${checkins.length}`}</Text>
          </Pressable>
        )}
      </View>
      
      {prediction?.warning && (
        <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 22 }}>{MOODS.find(m => m.key === prediction.predictedMood)?.symbol}</Text>
              <Text style={{ color: '#E5E7EB', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                PREDICTED: {prediction.predictedMood}
              </Text>
            </View>
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}>
              <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: 'bold' }}>{prediction.probability}% CONFIDENCE</Text>
            </View>
          </View>
          
          <View style={{ marginTop: 4 }}>
            <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reasons for Prediction</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {prediction.factors.map((factor, i) => (
                <View key={i} style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                  <Text style={{ color: '#D1D5DB', fontSize: 13 }}>• {factor}</Text>
                </View>
              ))}
            </View>

            <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>What to do</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 14, lineHeight: 22 }}>{prediction.action}</Text>
          </View>
        </View>
      )}
    </SurfaceCard>
  );
};

export const TipsSection = ({ model, accessToken, moodDemoEnabled, setMoodDemoEnabled, moodPromptDue, setMoodPromptDue, moodDemo, isActive = true, onMoodCheckIn, conditionsDemoEnabled }: CommonProps & {
  accessToken?: string | null;
  moodDemoEnabled?: boolean;
  setMoodDemoEnabled?: (val: boolean) => void;
  moodPromptDue?: boolean;
  setMoodPromptDue?: (val: boolean) => void;
  moodDemo?: { running: boolean; secondsRemaining: number };
  isActive?: boolean;
  onMoodCheckIn?: () => void;
  /** True while the trip-conditions demo (PlanResultScreen) is running — the
   * two demos are mutually exclusive (both call live external services), so
   * this drives the explanatory copy/disabled state below instead of the
   * switch silently doing nothing. */
  conditionsDemoEnabled?: boolean;
}) => {
  const [day, setDay] = useState(model.days[0]?.day || 1);
  const [mood, setMood] = useState<(typeof MOODS)[number]['key']>('neutral');
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moodResult, setMoodResult] = useState<EmotionCheckinResponse | null>(null);
  const [alternativesResult, setAlternativesResult] = useState<Awaited<ReturnType<typeof getContextualAlternatives>> | null>(null);
  const [journey, setJourney] = useState<EmotionTargetsResponse | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  
  const CACHE_KEY = `tips_cache_${model.sessionId}`;
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then(data => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          setMoodResult(prev => prev || parsed.moodResult);
          setAlternativesResult(prev => prev || parsed.alternativesResult);
        } catch (e) {}
      }
    });
  }, [CACHE_KEY]);

  const selectedDay = model.days.find(item => item.day === day) || model.days[0];
  const fallbackTargets = useMemo(() => buildFallbackTargets(model), [model]);
  const targets = useMemo(
    () => dedupeEmotionTargets(journey?.targets?.length ? journey.targets : fallbackTargets),
    [fallbackTargets, journey?.targets],
  );
  const targetsByDay = useMemo(() => {
    const groups = new Map<number, typeof targets>();
    targets.forEach(t => {
      if (!groups.has(t.day)) groups.set(t.day, []);
      groups.get(t.day)!.push(t);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [targets]);

  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const toggleDay = (d: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };
  const checkins = journey?.emotion_checkins || [];
  const selectedTarget = targets.find(target => target.attraction_id === selectedTargetId)
    || targets[0];

  const lastMoodLabel = checkins[checkins.length - 1]?.emotion_label;
  const prediction = useMemo(() => {
    if (!lastMoodLabel || !selectedTarget || checkins.length < 2) return null;
    return predictNextMood(lastMoodLabel, selectedTarget, checkins);
  }, [lastMoodLabel, selectedTarget, checkins]);

  const firstAttraction = selectedTarget
    ? { place_id: selectedTarget.attraction_id, name: selectedTarget.attraction_name }
    : selectedDay?.attractions?.[0];
  const alternatives = alternativesFromResponse(alternativesResult);
  const persistedEmotionSummary = asRecord(journey?.emotion_summary);
  const liveRecommendation = asRecord(moodResult?.recommendation);
  const persistedRecommendation = asRecord(persistedEmotionSummary.latest_recommendation);
  const recommendation = Object.keys(liveRecommendation).length
    ? liveRecommendation
    : persistedRecommendation;
    
  const liveTips = responseTips(moodResult);
  const fallbackTips = (Array.isArray(recommendation.nearby_tips) ? recommendation.nearby_tips : Array.isArray(recommendation.recommendations) ? recommendation.recommendations : []) as NearbyMoodTip[];
  const tips = liveTips.length ? liveTips : fallbackTips;
  const liveCheckin = asRecord(moodResult?.checkin);
  const persistedLatestCheckin = asRecord(persistedEmotionSummary.latest);
  const latestCheckin = Object.keys(liveCheckin).length
    ? liveCheckin
    : Object.keys(persistedLatestCheckin).length
      ? persistedLatestCheckin
      : asRecord(checkins[checkins.length - 1]);
  const resultMood = normalizeMood(asText(latestCheckin.emotion_label));
  const resultConfidence = asNumber(latestCheckin.emotion_confidence);
  const resultMoodLabel = MOODS.find(item => item.key === resultMood)?.label || 'Uncertain';
  const resultMoodSymbol = MOODS.find(item => item.key === resultMood)?.symbol || '•';
  const resultRisk = asText(recommendation.risk_level, recommendation.overall_risk, 'unknown');
  const photoWasAnalyzed = asRecord(moodResult?.privacy).raw_image_received_by_backend === true;
  const recommendationTitle = asText(recommendation.headline, recommendation.title, recommendation.summary);
  const recommendationBody = asText(
    recommendation.recommended_plan,
    recommendation.recommendation,
    recommendation.day_ahead_prediction,
    recommendation.day_ahead,
    recommendation.message,
  );

  const loadJourney = useCallback(async (showSpinner = false) => {
    if (!model.sessionId) return;
    if (showSpinner) setJourneyLoading(true);
    try {
      const response = await getEmotionTargets(model.sessionId, accessToken);
      setJourney(response);
      setSelectedTargetId(current => {
        if (current && response.targets.some(target => target.attraction_id === current)) return current;
        const checkedIds = new Set((response.emotion_checkins || []).map(item => item.attraction_id));
        return response.targets.find(target => !checkedIds.has(target.attraction_id))?.attraction_id
          || response.targets[0]?.attraction_id
          || null;
      });
    } catch {
      // Fallback itinerary targets keep manual tips usable when history cannot load.
    } finally {
      if (showSpinner) setJourneyLoading(false);
    }
  }, [accessToken, model.sessionId]);

  useEffect(() => {
    void loadJourney(true);
  }, [loadJourney]);

  useEffect(() => {
    if (selectedTarget?.day && selectedTarget.day !== day) setDay(selectedTarget.day);
  }, [day, selectedTarget?.day]);

  const queueNextMoodPrompt = useCallback(() => {
    if (!targets.length || !checkins.length) return;
    setSelectedTargetId(current => {
      const currentIndex = Math.max(0, targets.findIndex(target => target.attraction_id === current));
      return targets[(currentIndex + 1) % targets.length]?.attraction_id || current;
    });
    if (setMoodPromptDue) setMoodPromptDue(true);
  }, [checkins.length, targets, setMoodPromptDue]);

  const toggleInterest = (interest: string) => {
    setInterests(current => current.includes(interest) ? current.filter(item => item !== interest) : [...current, interest]);
  };

  const selectPhoto = async (source: 'camera' | 'library') => {
    setError(null);
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(`TripMind needs ${source === 'camera' ? 'camera' : 'photo library'} access for a photo mood check.`);
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled && result.assets[0]) setSelectedPhoto(result.assets[0]);
  };

  const applyMoodResponse = async (
    emotion: EmotionCheckinResponse,
    alternativesResponse: Awaited<ReturnType<typeof getContextualAlternatives>> | null = null,
  ) => {
    setMoodResult(emotion);
    setAlternativesResult(alternativesResponse);
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ moodResult: emotion, alternativesResult: alternativesResponse })).catch(() => {});
    const detectedMood = normalizeMood(asText(emotion.checkin?.emotion_label));
    if (detectedMood !== 'uncertain') setMood(detectedMood);
    if (setMoodPromptDue) setMoodPromptDue(false);
    await loadJourney(false);
    if (onMoodCheckIn) onMoodCheckIn();
  };

  const analyzePhoto = async () => {
    if (!model.sessionId) {
      setError('This trip must be saved before personalized tips can be attached.');
      return;
    }
    if (!selectedPhoto) {
      setError('Take a photo or choose one from your library first.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const emotion = await addEmotionCheckinImage(model.sessionId, {
        image: {
          uri: selectedPhoto.uri,
          name: selectedPhoto.fileName,
          mimeType: selectedPhoto.mimeType,
        },
        day: selectedTarget?.day || day,
        hobbies: interests,
        attraction_id: firstAttraction?.place_id || undefined,
        attraction_name: firstAttraction?.name || undefined,
        checkin_type: selectedTarget ? 'attraction' : 'start_of_day',
        user_location: targetCoordinate(selectedTarget) || undefined,
      }, accessToken);
      await applyMoodResponse(emotion);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '';
      setError(message || 'I could not find a face clearly. Try a brighter, front-facing photo.');
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    if (!model.sessionId) {
      setError('This trip must be saved before personalized tips can be attached.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const emotion = await addEmotionCheckin(model.sessionId, {
        day: selectedTarget?.day || day,
        emotion_label: mood,
        emotion_confidence: 1,
        hobbies: interests,
        attraction_id: firstAttraction?.place_id || undefined,
        attraction_name: firstAttraction?.name || undefined,
        checkin_type: selectedTarget ? 'attraction' : 'start_of_day',
        user_location: targetCoordinate(selectedTarget) || undefined,
      }, accessToken);
      await applyMoodResponse(emotion);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Personalized tips could not be generated.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.sectionStack}>
      <SectionHeading
        eyebrow="TripMind wellbeing"
        title="Find your next reset"
        detail="Mood-aware places and guidance around today’s planned stop."
      />

      <MoodJourneyMap
        model={model}
        targets={targets}
        checkins={checkins}
        selectedTargetId={selectedTarget?.attraction_id || null}
        onSelect={targetId => { setSelectedTargetId(targetId); if (setMoodPromptDue) setMoodPromptDue(false); }}
        isActive={isActive}
      />

      <MoodHistory checkins={checkins} prediction={prediction} />

      <SurfaceCard>
        <View style={styles.demoSwitchRow}>
          <View style={styles.demoSwitchCopy}>
            <Text style={styles.subsectionLabel}>MOOD REMINDERS</Text>
            <Text style={styles.demoSwitchTitle}>Check in at the next stop</Text>
            <Text style={styles.mutedText}>
              {conditionsDemoEnabled
                ? "Off — the trip conditions demo is running. Turn that off first."
                : !checkins.length
                  ? 'Complete one mood check first to enable reminders.'
                  : moodDemoEnabled
                    ? `Next reminder in ${moodDemo?.secondsRemaining}s. Your current history stays saved.`
                    : 'Off. Turn on to receive a prompt at the next planned stop.'}
            </Text>
          </View>
          <Switch
            value={moodDemoEnabled}
            onValueChange={value => { if (setMoodDemoEnabled) setMoodDemoEnabled(value); if (!value && setMoodPromptDue) setMoodPromptDue(false); }}
            disabled={!checkins.length || conditionsDemoEnabled}
            trackColor={{ false: '#294239', true: '#1B765C' }}
            thumbColor={moodDemoEnabled ? colors.mint : '#A7B5AE'}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.subsectionLabel}>CURRENT CHECKPOINT</Text>
        {journeyLoading && <Text style={styles.mutedText}>Loading saved checkpoints...</Text>}
        <View style={{ gap: 8 }}>
          {targetsByDay.map(([dayNum, dayTargets]) => {
            const isExpanded = expandedDays.has(dayNum);
            return (
              <View key={dayNum} style={styles.dayGroup}>
                <Pressable onPress={() => toggleDay(dayNum)} style={styles.dayGroupHeader}>
                  <Text style={styles.dayGroupTitle}>DAY {dayNum}</Text>
                  <Text style={styles.expandGlyph}>{isExpanded ? '−' : '+'}</Text>
                </Pressable>
                {isExpanded && (
                  <View style={styles.choiceRow}>
                    {dayTargets.map(target => (
                      <Choice
                        key={target.attraction_id}
                        label={target.attraction_name}
                        selected={selectedTarget?.attraction_id === target.attraction_id}
                        onPress={() => { setSelectedTargetId(target.attraction_id); if (setMoodPromptDue) setMoodPromptDue(false); }}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <Text style={[styles.subsectionLabel, styles.choiceHeading]}>READ YOUR MOOD</Text>
        <View style={styles.photoMoodPanel}>
          <View style={styles.photoMoodHeader}>
            <View style={styles.demoSwitchCopy}>
              <Text style={styles.photoMoodTitle}>Use a photo</Text>
              <Text style={styles.mutedText}>TripMind analyzes your expression on-device. The photo is never stored.</Text>
            </View>
            {selectedPhoto && <Image source={{ uri: selectedPhoto.uri }} style={styles.photoPreview} />}
          </View>
          <View style={styles.photoActionRow}>
            <Pressable onPress={() => void selectPhoto('camera')} style={styles.photoAction} disabled={loading}>
              <Text style={styles.photoActionText}>Take photo</Text>
            </Pressable>
            <Pressable onPress={() => void selectPhoto('library')} style={styles.photoAction} disabled={loading}>
              <Text style={styles.photoActionText}>Choose photo</Text>
            </Pressable>
          </View>
          {selectedPhoto && (
            <PrimaryButton
              title={loading ? 'Analyzing expression...' : 'Analyze photo'}
              onPress={analyzePhoto}
              disabled={loading}
            />
          )}
          {photoWasAnalyzed && (
            <View style={styles.photoResultCard}>
              <View style={styles.photoResultHeader}>
                <View style={styles.photoResultIdentity}>
                  <Text style={styles.photoResultEmoji}>{resultMoodSymbol}</Text>
                  <View style={styles.photoResultCopy}>
                    <Text style={styles.photoResultLabel}>Detected mood</Text>
                    <Text style={styles.photoResultMood}>
                      {resultMoodLabel}
                      {resultConfidence == null ? '' : ` · ${Math.round(resultConfidence * 100)}%`}
                    </Text>
                  </View>
                </View>
                <RiskBadge value={resultRisk} compact />
              </View>
              <View style={styles.photoResultAdvice}>
                <Text style={styles.photoResultAdviceLabel}>DAY-AHEAD GUIDANCE</Text>
                {!!recommendationTitle && <Text style={styles.photoResultAdviceTitle}>{recommendationTitle}</Text>}
                <Text style={styles.photoResultAdviceBody}>
                  {recommendationBody || 'Your result was saved. Use the nearby recommendations below to shape the next stop.'}
                </Text>
              </View>
              <Text style={styles.photoPrivacyNote}>Saved to this trip · Photo discarded after analysis</Text>
            </View>
          )}
        </View>
        <Text style={styles.manualMoodDivider}>OR CHOOSE HOW YOU FEEL</Text>
        <View style={styles.moodRow}>
          {MOODS.map(item => (
            <Pressable key={item.key} onPress={() => setMood(item.key)} style={[styles.moodChoice, mood === item.key && styles.choiceSelected]}>
              <Text style={styles.moodSymbol}>{item.symbol}</Text>
              <Text style={[styles.moodChoiceText, mood === item.key && styles.moodChoiceTextSelected]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.subsectionLabel, styles.choiceHeading]}>WHAT WOULD HELP TODAY?</Text>
        <View style={styles.interestGrid}>
          {INTERESTS.map(interest => <Choice key={interest.id} label={interest.label} selected={interests.includes(interest.id)} onPress={() => toggleInterest(interest.id)} />)}
        </View>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        <PrimaryButton title={loading ? 'Finding the best fit...' : 'Find recommendations'} onPress={generate} disabled={loading} />
      </SurfaceCard>

      {(recommendationTitle || recommendationBody) && (
        <View style={styles.moodRecoveryHeader}>
          <Text style={styles.moodRecoveryEmoji}>{resultMoodSymbol}</Text>
          <View style={styles.moodRecoveryCopy}>
            <Text style={styles.moodRecoveryTitle}>Mood Recovery Activities</Text>
            <Text style={styles.moodRecoveryDetail}>
              Based on your {resultMoodLabel.toLowerCase()} mood{interests.length ? ` and ${interests[0]}` : ''}
            </Text>
            <View style={{ alignSelf: 'flex-start', marginTop: 8 }}>
              <RiskBadge value={resultRisk} compact />
            </View>
          </View>
        </View>
      )}

      {!!tips.length && (
        <View style={styles.sectionStackCompact}>
          {tips.slice(0, 5).map((tip, index) => (
            <PlaceCard
              key={`${tip.name}-${index}`}
              name={tip.name || 'Nearby activity'}
              category={tip.category}
              distance={tip.distance_km}
              reason={tip.reason}
              description={(tip as any).description || (tip as any).summary || (tip as any).advice}
              matches={tip.hobby_matches}
              mapUrl={tip.map_url}
              topPick={tip.top_pick || index === 0}
            />
          ))}
        </View>
      )}

      {!!alternatives.length && (
        <View style={styles.sectionStackCompact}>
          <SectionHeading title="Backup options" detail="Nearby alternatives for the current weather and crowd conditions. Your itinerary stays unchanged." />
          {alternatives.slice(0, 5).map((item, index) => (
            <PlaceCard
              key={`${item.name}-${index}`}
              name={item.name || 'Nearby alternative'}
              category={item.category_label || item.category}
              distance={item.distance_km}
              reason={item.why_recommended || item.reason}
              description={(item as any).description || (item as any).summary || (item as any).advice}
              matches={item.interest_matches}
              mapUrl={item.map_url}
              topPick={false}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const Choice = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
    <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
  </Pressable>
);

const PlaceCard = ({ name, category, distance, reason, matches, mapUrl, topPick, description }: {
  name: string;
  category?: string;
  distance?: number | null;
  reason?: string;
  description?: string;
  matches?: string[];
  mapUrl?: string;
  topPick: boolean;
}) => {
  const cat = (category || '').toLowerCase();
  const isFood = cat.includes('food') || cat.includes('restaurant') || cat.includes('cafe') || cat.includes('bakery') || cat.includes('coffee');
  const isNature = cat.includes('nature') || cat.includes('park') || cat.includes('beach');
  const isCulture = cat.includes('museum') || cat.includes('temple') || cat.includes('history');
  
  const icon = isFood ? '☕️' : isNature ? '🍃' : isCulture ? '🏛️' : '✨';
  const tag = isFood ? 'Slow break' : isNature ? 'Outdoors' : isCulture ? 'Culture' : 'Activity';
  const duration = isFood ? '45–90 min' : isNature ? '1–2 hrs' : '1 hr';
  
  const desc = description || `Spend a little time at ${name} for a comfortable place to pause and recharge.`;

  return (
    <SurfaceCard style={[styles.tipsCard, topPick && styles.topPickCardActive] as any}>
      <View style={styles.tipsCardHeader}>
        <View style={styles.moodBoosterPill}>
          <Text style={styles.moodBoosterText}>💚 Mood Booster</Text>
        </View>
        {topPick && (
          <View style={styles.topPickBadge}>
            <Text style={styles.topPickBadgeText}>🏆 Top Pick</Text>
          </View>
        )}
      </View>

      <View style={styles.tipsCardBody}>
        <View style={styles.tipsCardImagePlaceholder}>
          <Text style={styles.tipsCardImageEmoji}>{icon}</Text>
        </View>
        <View style={styles.tipsCardInfo}>
          <Text style={styles.tipsCardName}>{name}</Text>
          <View style={styles.tipsCardMetaRow}>
            <View style={styles.tipsCardMetaPill}>
              <Text style={styles.tipsCardMetaText}>{tag}</Text>
            </View>
            <Text style={styles.tipsCardMetaLabel}>⏱ {duration}</Text>
            {distance != null && <Text style={styles.tipsCardMetaLabel}>⌖ {distance.toFixed(1)} km</Text>}
          </View>
          {!!matches?.length && (
            <View style={styles.tipsCardMatchesRow}>
              <Text style={styles.tipsCardMatchesText}>Matches {matches[0]}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.tipsCardDescription}>{desc}</Text>

      {!!reason && (
        <View style={styles.tipsCardWhyBox}>
          <View style={styles.tipsCardWhyBorder} />
          <View style={styles.tipsCardWhyContent}>
            <Text style={styles.tipsCardWhyLabel}>WHY THIS IS FOR YOU</Text>
            <Text style={styles.tipsCardWhyText}>{reason}</Text>
          </View>
        </View>
      )}

      <View style={styles.tipsCardFooter}>
        <Text style={styles.tipsCardFooterMeta}>🕒 Best time: Flexible   ⍋ Solo friendly</Text>
        {!!mapUrl && (
          <Pressable onPress={() => Linking.openURL(mapUrl)}>
            <Text style={styles.tipsCardMapLink}>Open map ↗</Text>
          </Pressable>
        )}
      </View>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  sectionStack: { gap: 16 },
  sectionStackCompact: { gap: 12 },
  dayCard: { padding: 0, overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 },
  dayNumber: { width: 58, height: 66, borderRadius: 18, backgroundColor: '#103D30', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#28634D' },
  dayNumberLabel: { color: '#8EB8A5', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  dayNumberValue: { color: colors.warmWhite, fontFamily: fonts.displayBold, fontSize: 27 },
  dayHeaderCopy: { flex: 1, gap: 2 },
  dayDate: { color: colors.mint, fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase' },
  dayLocation: { color: colors.warmWhite, fontFamily: fonts.displaySemibold, fontSize: 19 },
  dayRouteMeta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  dayHeaderEnd: { alignItems: 'flex-end', gap: 8 },
  expandGlyph: { color: '#89A396', fontSize: 21, fontWeight: '400' },
  dayBody: { borderTopWidth: 1, borderTopColor: '#214737', padding: 18, gap: 18 },
  bodyText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  conditionList: { gap: 8 },
  conditionLine: { minHeight: 44, borderRadius: 14, backgroundColor: '#0B1C14', paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  conditionDot: { width: 8, height: 8, borderRadius: 4 },
  conditionLabel: { color: colors.textMuted, fontFamily: fonts.bodySemibold, fontSize: 12 },
  conditionValue: { color: colors.warmWhite, fontFamily: fonts.bodySemibold, fontSize: 12, textAlign: 'right', flex: 1 },
  subsection: { gap: 10 },
  subsectionLabel: { color: colors.textMuted, fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 1.3 },
  attractionList: { gap: 2, marginTop: 14 },
  attractionRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1C3B2D' },
  attractionIndex: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#123E31', alignItems: 'center', justifyContent: 'center' },
  attractionIndexText: { color: colors.mint, fontSize: 12, fontWeight: '800' },
  attractionCopy: { flex: 1, gap: 4 },
  attractionName: { color: colors.warmWhite, fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20 },
  attractionMeta: { color: colors.mint, fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 16 },
  attractionAdvice: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  mutedText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  stayRow: { borderTopWidth: 1, borderTopColor: '#214737', paddingTop: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  stayCopy: { flex: 1, gap: 5 },
  stayName: { color: colors.warmWhite, fontFamily: fonts.bodySemibold, fontSize: 16 },
  price: { color: colors.mint, fontFamily: fonts.bodySemibold, fontSize: 14 },
  selectedStayList: { marginTop: 14 },
  selectedStayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#214737' },
  selectedStayDay: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#123E31', alignItems: 'center', justifyContent: 'center' },
  selectedStayDayLabel: { color: '#8EB8A5', fontSize: 7, fontWeight: '900', letterSpacing: 0.9 },
  selectedStayDayValue: { color: colors.warmWhite, fontSize: 17, fontWeight: '800' },
  selectedStayCopy: { flex: 1, gap: 3 },
  flightRouteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  flightEndpoint: { width: 96, gap: 4 },
  flightArrival: { alignItems: 'flex-end' },
  flightCode: { color: colors.warmWhite, fontSize: 21, fontWeight: '800' },
  flightTime: { color: '#89A396', fontSize: 10, lineHeight: 14 },
  flightJourney: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  flightRule: { flex: 1, height: 1, backgroundColor: '#3B5A4B' },
  flightPlane: { color: colors.mint, fontSize: 14, paddingHorizontal: 7 },
  flightFareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#214737' },
  flightFare: { color: colors.warmWhite, fontSize: 17, fontWeight: '800', marginTop: 5 },
  ticketButton: { minHeight: 40, borderRadius: 14, backgroundColor: colors.mint, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  ticketButtonText: { color: colors.forest, fontSize: 12, fontWeight: '900' },
  adviceBox: { backgroundColor: colors.forestElevated, borderRadius: 16, borderLeftWidth: 3, borderLeftColor: colors.mint, padding: 14, gap: 5 },
  adviceLabel: { color: colors.mint, fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 1.2 },
  adviceText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  metricsRow: { flexDirection: 'row', gap: 14, marginTop: 20 },
  summaryLine: { flexDirection: 'row', gap: 24, marginTop: 20 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  pressureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1C3B2D' },
  pressureCopy: { flex: 1, gap: 5 },
  pressureEnd: { alignItems: 'flex-end', gap: 7 },
  score: { color: '#89A396', fontSize: 11, fontWeight: '700' },
  budgetRows: { gap: 0, marginTop: 18 },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#214737' },
  budgetLabel: { color: '#9CB5A8', fontSize: 14 },
  budgetValue: { color: colors.warmWhite, fontSize: 14, fontWeight: '700' },
  budgetTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16 },
  budgetTotalLabel: { color: colors.warmWhite, fontSize: 16, fontWeight: '700' },
  budgetTotalValue: { color: colors.mint, fontSize: 17, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#18382A', marginTop: 16, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.mint },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  negative: { color: colors.error },
  incidentList: { gap: 0, marginTop: 16 },
  incidentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#214737' },
  incidentDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  incidentCopy: { flex: 1, gap: 4 },
  dayGroup: { marginBottom: 2 },
  dayGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, backgroundColor: '#0A1C14', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.2)' },
  dayGroupTitle: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 13, letterSpacing: 1.1 },
  choiceHeading: { marginTop: 24, letterSpacing: 1.5 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 14, paddingBottom: 6 },
  choice: { minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.4)', paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(39, 185, 135, 0.12)', shadowColor: 'rgba(39, 185, 135, 0)', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0 },
  choiceSelected: { borderColor: '#27B987', backgroundColor: '#27B987', shadowColor: '#27B987', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
  choiceText: { color: '#8BA398', fontFamily: fonts.bodySemibold, fontSize: 13, letterSpacing: 0.3 },
  choiceTextSelected: { color: '#05120D', fontWeight: '900' },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, paddingTop: 14, paddingBottom: 6 },
  moodChoice: { flex: 1, minHeight: 78, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.3)', backgroundColor: 'rgba(39, 185, 135, 0.1)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  moodSymbol: { fontSize: 26 },
  moodChoiceText: { color: '#8BA398', fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 0 },
  moodChoiceTextSelected: { color: '#05120D', fontWeight: '900' },
  photoMoodPanel: {
    marginTop: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.25)',
    backgroundColor: '#05120D',
    padding: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  photoMoodHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoMoodTitle: { color: colors.warmWhite, fontFamily: fonts.displaySemibold, fontSize: 15 },
  photoPreview: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#17382A' },
  photoActionRow: { flexDirection: 'row', gap: 10 },
  photoAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27B987',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#112F24',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  photoActionText: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  photoResultCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mint,
    backgroundColor: '#113E30',
    padding: 14,
    gap: 13,
  },
  photoResultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  photoResultIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoResultEmoji: { fontSize: 28 },
  photoResultCopy: { flex: 1, gap: 2 },
  photoResultLabel: { color: '#8EB8A5', fontSize: 9, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  photoResultMood: { color: colors.warmWhite, fontFamily: fonts.displaySemibold, fontSize: 16 },
  photoResultAdvice: { borderRadius: 14, backgroundColor: colors.forestElevated, padding: 13, gap: 5 },
  photoResultAdviceLabel: { color: colors.mint, fontFamily: fonts.bodySemibold, fontSize: 9, letterSpacing: 1.1 },
  photoResultAdviceTitle: { color: colors.warmWhite, fontFamily: fonts.displaySemibold, fontSize: 14, lineHeight: 19 },
  photoResultAdviceBody: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  photoPrivacyNote: { color: '#8EB8A5', fontSize: 10, lineHeight: 14 },
  manualMoodDivider: { color: '#789487', fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginTop: 18 },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 24 },
  errorText: { color: '#FF7A7A', fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  featuredCard: { borderColor: 'rgba(39, 185, 135, 0.5)', backgroundColor: 'rgba(39, 185, 135, 0.08)', shadowColor: '#27B987', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 15 },
  placeTitleCopy: { flex: 1, gap: 6 },
  topPickCard: { borderColor: '#38DFA8', backgroundColor: 'rgba(56, 223, 168, 0.08)', shadowColor: '#38DFA8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 12 },

  topPickText: { color: '#05120D', fontFamily: fonts.bodySemibold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  placeMatchesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  placeMatchChip: { backgroundColor: 'rgba(39, 185, 135, 0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  placeMatchChipText: { color: '#38DFA8', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  placeAdviceBox: { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  placeAdviceText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  placeMapButton: { backgroundColor: '#112F24', borderRadius: 20, paddingVertical: 10, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: '#27B987' },
  placeMapButtonText: { color: '#38DFA8', fontFamily: fonts.bodySemibold, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  moodMapShell: {
    height: 260,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#28513F',
    backgroundColor: '#0B1C14',
  },
  moodMap: { flex: 1 },
  moodMapEmpty: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    backgroundColor: 'rgba(11, 28, 20, 0.92)',
  },
  moodMapEmptyTitle: { color: colors.warmWhite, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  moodMapEmptyText: { color: '#89A396', fontSize: 12, lineHeight: 18, marginTop: 7, textAlign: 'center' },
  moodCallout: { width: 190, paddingVertical: 4, gap: 4 },
  moodCalloutTitle: { color: '#122B21', fontSize: 13, fontWeight: '800' },
  moodCalloutText: { color: '#527064', fontSize: 11, lineHeight: 15 },
  historyCount: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 12, letterSpacing: 0.5 },
  historyGraphOuter: {
    marginTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(39, 185, 135, 0.15)',
    paddingBottom: 20,
  },
  historyGraphContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    minWidth: '100%',
    paddingHorizontal: 4,
  },
  historyBarColumn: { width: 36, height: 100, alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  historyBarTrack: {
    width: '100%',
    flex: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(39, 185, 135, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.1)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  historyBar: { 
    width: '100%', 
    minHeight: 8, 
    borderRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  historyEmoji: { fontSize: 20 },
  historyCaption: { color: '#8BA398', fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 0.5 },
  historyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  seeAllButton: { backgroundColor: 'rgba(39, 185, 135, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  seeAllButtonText: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 11, fontWeight: '800' },
  demoSwitchRow: {
    minHeight: 74,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#28513F',
    backgroundColor: '#0B1C14',
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  demoSwitchCopy: { flex: 1, gap: 4 },
  demoSwitchTitle: { color: colors.warmWhite, fontSize: 14, fontWeight: '800' },
  moodPromptBanner: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mint,
    backgroundColor: '#123E31',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 5,
  },
  moodPromptTitle: { color: colors.warmWhite, fontSize: 14, fontWeight: '800' },
  moodPromptText: { color: '#B7CCC2', fontSize: 12, lineHeight: 18 },
  recoveryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  recoveryBadgeText: { fontSize: 11, fontWeight: '800' },
  moodRecoveryHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, paddingHorizontal: 4 },
  moodRecoveryEmoji: { fontSize: 36 },
  moodRecoveryCopy: { flex: 1, gap: 4 },
  moodRecoveryTitle: { color: colors.warmWhite, fontFamily: fonts.displaySemibold, fontSize: 19 },
  moodRecoveryDetail: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  tipsCard: { padding: 18 },
  topPickCardActive: { borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.25)' },
  tipsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  moodBoosterPill: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.3)', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'transparent' },
  moodBoosterText: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  topPickBadge: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(242, 184, 75, 0.4)', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'transparent' },
  topPickBadgeText: { color: '#F2B84B', fontFamily: fonts.bodySemibold, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  tipsCardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  tipsCardImagePlaceholder: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#103D30', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#28634D' },
  tipsCardImageEmoji: { fontSize: 22 },
  tipsCardInfo: { flex: 1, gap: 6 },
  tipsCardName: { color: colors.warmWhite, fontFamily: fonts.displaySemibold, fontSize: 17 },
  tipsCardMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  tipsCardMetaPill: { borderRadius: 12, borderWidth: 1, borderColor: '#1C3B2D', paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'transparent' },
  tipsCardMetaText: { color: '#89A396', fontFamily: fonts.bodySemibold, fontSize: 10, fontWeight: '700' },
  tipsCardMetaLabel: { color: '#89A396', fontFamily: fonts.bodySemibold, fontSize: 11, fontWeight: '600' },
  tipsCardMatchesRow: { flexDirection: 'row', marginTop: 2 },
  tipsCardMatchesText: { color: '#F2B84B', fontFamily: fonts.bodySemibold, fontSize: 10, fontWeight: '800', backgroundColor: 'rgba(242, 184, 75, 0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  tipsCardDescription: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginTop: 16 },
  tipsCardWhyBox: { backgroundColor: '#0B1C14', borderRadius: 14, marginTop: 16, flexDirection: 'row', overflow: 'hidden' },
  tipsCardWhyBorder: { width: 4, backgroundColor: '#27B987' },
  tipsCardWhyContent: { flex: 1, padding: 16, gap: 8 },
  tipsCardWhyLabel: { color: colors.textMuted, fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 1.3 },
  tipsCardWhyText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  tipsCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1C3B2D' },
  tipsCardFooterMeta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  tipsCardMapLink: { color: '#38DFA8', fontFamily: fonts.bodySemibold, fontSize: 13, fontWeight: '800' },
});
