import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, Platform, StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { TasksProvider } from '@/contexts/tasks-context';
import { MessengerProvider } from '@/contexts/messenger-context';
import { handleNotificationResponse, initNotificationsAsync } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    initNotificationsAsync();

    if (Platform.OS !== 'web') {
      // 1. Cold-start check: app launched by tapping a notification
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) {
            const res = handleNotificationResponse(response);
            if (res.handled) {
              router.replace('/(tabs)');
            }
          }
        })
        .catch((err) => {
          if (__DEV__) {
            console.warn('[Notifications] Cold-start check error:', err);
          }
        });

      // 2. Foreground & background notification tap response listener
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        if (__DEV__) {
          console.log('[NotificationResponse]', response.notification.request.identifier);
        }
        const res = handleNotificationResponse(response);
        if (res.handled) {
          router.replace('/(tabs)');
        }
      });
      return () => {
        sub.remove();
      };
    }
  }, []);
  
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <TasksProvider>
            <MessengerProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="calendar" options={{ headerShown: false }} />
              </Stack>
            </MessengerProvider>
          </TasksProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
});
