import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors as Colors, spacing, typography, radius } from '@/theme';
import { CLINIC_INFO } from '../index';

export default function ClinicFinderScreen() {
  const router = useRouter();
  const [showMap, setShowMap] = useState(true);

  const openDirections = () => {
    const url = `https://maps.google.com/?q=${CLINIC_INFO.coordinates.lat},${CLINIC_INFO.coordinates.lng}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      router.push({ pathname: '/(tabs)/home', params: { url } });
    }
  };

  return (
    <SafeAreaView style={styles.safeAreaContainer} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Find Our Clinic</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {showMap && (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: CLINIC_INFO.coordinates.lat,
              longitude: CLINIC_INFO.coordinates.lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01
            }}
          >
            <Marker
              coordinate={{ latitude: CLINIC_INFO.coordinates.lat, longitude: CLINIC_INFO.coordinates.lng }}
              title={CLINIC_INFO.name}
              description={CLINIC_INFO.address}
            />
          </MapView>
        )}

        <TouchableOpacity
          style={styles.mapButton}
          onPress={() => setShowMap(!showMap)}
        >
          <Ionicons
            name={showMap ? 'eye-off-outline' : 'map-outline'}
            size={20}
            color={Colors.primary}
          />
          <Text style={styles.mapText}>{showMap ? 'Hide Map' : 'Show Map'}</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconBadge}>
              <Ionicons name="location-sharp" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.clinicName}>{CLINIC_INFO.name}</Text>
          </View>
          <Text style={styles.address}>{CLINIC_INFO.address}</Text>
          <View style={styles.divider} />
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.contactText}>{CLINIC_INFO.phone}</Text>
          </View>
          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.contactText}>{CLINIC_INFO.email}</Text>
          </View>
        </View>

        <View style={styles.hoursCard}>
          <View style={styles.hoursRow}>
            <Ionicons name="time-outline" size={16} color={Colors.primary} />
            <Text style={styles.hoursLabel}>Consultation hours</Text>
          </View>
          <Text style={styles.hoursValue}>Monday to Friday, by appointment</Text>
        </View>

        <TouchableOpacity
          style={styles.directionsButton}
          onPress={openDirections}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate-outline" size={20} color={Colors.textOnPrimary} />
          <Text style={styles.directionsText}>Get Directions</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  map: {
    height: 250,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: spacing.sm,
    backgroundColor: Colors.brandSoft,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
  },
  mapText: {
    marginLeft: spacing.sm,
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    color: Colors.primary,
  },
  infoCard: {
    backgroundColor: Colors.background,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoIconBadge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: Colors.brandWash,
    marginRight: spacing.sm,
  },
  clinicName: {
    flex: 1,
    fontSize: typography.subhead.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  address: {
    fontSize: typography.small.fontSize,
    lineHeight: typography.small.fontSize * 1.45,
    color: Colors.textSecondary,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginBottom: spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
    marginBottom: spacing.sm,
  },
  contactText: {
    marginLeft: spacing.sm,
    fontSize: typography.small.fontSize,
    color: Colors.text,
  },
  hoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.brandWash,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hoursLabel: {
    marginLeft: spacing.sm,
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    color: Colors.text,
  },
  hoursValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: Colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
  },
  directionsText: {
    marginLeft: spacing.sm,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: Colors.textOnPrimary,
  },
});
