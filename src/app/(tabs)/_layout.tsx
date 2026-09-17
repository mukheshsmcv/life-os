import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { AddActionModal } from '@/components/add-action-modal';

export default function TabsLayout() {
  const [modalVisible, setModalVisible] = useState(false);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0B0D10',
            borderTopColor: '#1A1D24',
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 60 + insets.bottom : 70,
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 10,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#A7A0FF',
          tabBarInactiveTintColor: '#737983',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 4,
          }
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color, focused }) => (
              <SymbolView name="house" size={24} tintColor={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
            tabBarIcon: ({ color, focused }) => (
              <SymbolView name="checklist" size={24} tintColor={color} fallback={
                <SymbolView name="checkmark.square" size={24} tintColor={color} />
              }/>
            ),
          }}
        />

        <Tabs.Screen
          name="messenger"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => (
              <SymbolView name="message" size={24} tintColor={color} fallback={
                <SymbolView name="bubble.left.and.bubble.right" size={24} tintColor={color} />
              }/>
            ),
          }}
        />

        <Tabs.Screen
          name="chat"
          options={{
            title: 'AI',
            tabBarIcon: ({ color, focused }) => (
              <SymbolView name="sparkles" size={24} tintColor={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="add"
          listeners={{
            tabPress: (e) => {
              // Prevent default navigation
              e.preventDefault();
              setModalVisible(true);
            },
          }}
          options={{
            title: 'Add',
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.addTabContainer}>
                <View style={styles.addTabCircle}>
                  <SymbolView name="plus" size={20} tintColor="#0B0D10" weight="bold" />
                </View>
              </View>
            ),
          }}
        />

        {/* Hidden Calendar Tab (if it exists) */}
        <Tabs.Screen
          name="calendar"
          options={{
            href: null,
          }}
        />
      </Tabs>

      <AddActionModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  addTabContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -8, // slight lift
  },
  addTabCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#A7A0FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#A7A0FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
