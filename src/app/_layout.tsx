import { useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { TasksProvider } from '@/contexts/tasks-context';
import { AddActionModal } from '@/components/add-action-modal';

SplashScreen.preventAutoHideAsync();

function MainAppContent() {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <AppTabs />
      <Pressable
        onPress={() => setModalVisible(true)}
        style={styles.fab}
        accessibilityLabel="Add Task or Event"
        accessibilityRole="button">
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
      <AddActionModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <TasksProvider>
            <MainAppContent />
          </TasksProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  container: { flex: 1 },
  fab: {
    position: 'absolute',
    bottom: 84,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#A7A0FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 9999,
  },
  fabIcon: {
    color: '#0B0D10',
    fontSize: 32,
    fontWeight: '400',
    marginTop: -2,
  },
});
