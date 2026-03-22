import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface JobData {
  title: string;
  link: string;
  score: number;
  reason: string;
  budget?: string;
  timeline?: string;
  description?: string;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [pendingJob, setPendingJob] = useState<JobData | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        console.log('Expo Push Token:', token);
      }
    });

    //getDeviceTokenAsync();

    notificationListener.current = Notifications.addNotificationReceivedListener((notif) => {
      setNotification(notif);
      const jobData = notif.request.content.data as JobData;
      if (jobData?.title) {
        setPendingJob(jobData);
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const jobData = response.notification.request.content.data as JobData;
      if (jobData?.title) {
        setPendingJob(jobData);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken, notification, pendingJob };
}

async function getDeviceTokenAsync() {
  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    console.log('FCM DEVICE TOKEN:', deviceToken.data);
  } catch (e) {
    console.log('FCM device token error:', e);
  }
}

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00FF88',
    });
  }

  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical device');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied');
    return;
  }

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}