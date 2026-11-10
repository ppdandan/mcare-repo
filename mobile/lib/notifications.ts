import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure foreground notification presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registers device for Expo Push Notifications and saves token in Supabase
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  let token: string | null = null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied by user.');
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    token = tokenData.data;

    if (token) {
      // Upsert token in push_tokens table
      const { error } = await supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          expo_push_token: token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'expo_push_token' }
      );

      if (error) {
        console.warn('Could not store push token in DB:', error.message);
      }
    }

    // Android channel configuration
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'M-Care Clinic Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E91E8C',
      });
    }
  } catch (err) {
    console.warn('Push notification setup skipped (e.g. running on web preview/simulator):', err);
  }

  return token;
}

