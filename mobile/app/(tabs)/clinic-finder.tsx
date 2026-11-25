import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors as Colors } from '@/theme';
import { CLINIC_INFO } from '../index';

export default function ClinicFinderScreen() {
  const router = useRouter();
  const [showMap, setShowMap] = useState(false);

  const openDirections = () => {
    const url = `https://maps.google.com/?q=${CLINIC_INFO.coordinates.lat},${CLINIC_INFO.coordinates.lng}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      router.push({ pathname: '/(modal)/webview', params: { url } });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Find Our Clinic</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.mapButton}
        onPress={() => setShowMap(!showMap)}
      >
        <Ionicons name="map-outline" size={20} color={Colors.primary} />
        <Text style={styles.mapText}>{showMap ? 'Hide Map' : 'Show Map'}</Text>
      </TouchableOpacity>

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
            coordinate={CLINIC_INFO.coordinates}
            title={CLINIC_INFO.name}
            description={CLINIC_INFO.address}
          />
        </MapView>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.clinicName}>{CLINIC_INFO.name}</Text>
        <Text style={styles.address}>{CLINIC_INFO.address}</Text>
        <View style={styles.contactRow}>
          <Ionicons name="call-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.contactText}>{CLINIC_INFO.phone}</Text>
        </View>
        <View style={styles.contactRow}>
          <Ionicons name="mail-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.contactText}>{CLINIC_INFO.email}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.directionsButton}
        onPress={openDirections}
      >
        <Ionicons name="navigate-outline" size={20} color={Colors.background} />
        <Text style={styles.directionsText}>Get Directions</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: 8,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.brandSoft,
    margin: 16,
    borderRadius: 8,
  },
  mapText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text,
  },
  map: {
    height: 200,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  infoCard: {
    backgroundColor: Colors.background,
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
  },
  clinicName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: Colors.text,
  },
  address: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  directionsText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.background,
  },
});