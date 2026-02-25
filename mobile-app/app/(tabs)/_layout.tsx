import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#16213e' },
        tabBarActiveTintColor: '#00d4aa',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tabs.Screen name="matches" options={{ title: 'Wedstrijden', tabBarIcon: () => null }} />
      <Tabs.Screen name="create" options={{ title: 'Aanmaken', tabBarIcon: () => null }} />
      <Tabs.Screen name="book" options={{ title: 'Veld boeken', tabBarIcon: () => null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profiel', tabBarIcon: () => null }} />
    </Tabs>
  );
}