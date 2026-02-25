import { View, Text, TouchableOpacity } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>👤 Profiel</Text>
      <Text style={{ color: '#888', marginTop: 8 }}>Level: 1.5</Text>

      <TouchableOpacity
        onPress={handleLogout}
        style={{ marginTop: 40, backgroundColor: '#e74c3c', padding: 16, borderRadius: 12, width: '100%', alignItems: 'center' }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Uitloggen</Text>
      </TouchableOpacity>
    </View>
  );
}