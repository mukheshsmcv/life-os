import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { AddActionModal } from '@/components/add-action-modal';

export default function TabsLayout() {
  const [modalVisible, setModalVisible] = useState(false);
  const pathname = usePathname();
  const isChat = pathname ? pathname === '/chat' || pathname.startsWith('/chat') : false;

  return (
    <View style={styles.container}>
      <AppTabs />
      {!isChat && (
        <Pressable
          onPress={() => setModalVisible(true)}
          style={styles.fab}
          accessibilityLabel="Add Task or Event"
          accessibilityRole="button">
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      )}
      <AddActionModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
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
