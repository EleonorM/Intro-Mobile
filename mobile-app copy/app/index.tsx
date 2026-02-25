import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');

  const handleAuth = async () => {
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', result.user.uid), {
          name,
          email,
          level: 1.5,
          uid: result.user.uid,
        });
      }
      router.replace('/(tabs)/matches');
    } catch (error: any) {
      Alert.alert('Fout', error.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#00d4aa', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
        ⚽ VoetbalApp
      </Text>
      <Text style={{ color: '#888', textAlign: 'center', marginBottom: 40 }}>
        {isLogin ? 'Welkom terug!' : 'Maak een account aan'}
      </Text>

      {!isLogin && (
        <TextInput
          placeholder="Naam"
          placeholderTextColor="#666"
          value={name}
          onChangeText={setName}
          style={{ backgroundColor: '#16213e', color: 'white', padding: 16, borderRadius: 12, marginBottom: 12 }}
        />
      )}

      <TextInput
        placeholder="Email"
        placeholderTextColor="#666"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ backgroundColor: '#16213e', color: 'white', padding: 16, borderRadius: 12, marginBottom: 12 }}
      />

      <TextInput
        placeholder="Wachtwoord"
        placeholderTextColor="#666"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ backgroundColor: '#16213e', color: 'white', padding: 16, borderRadius: 12, marginBottom: 24 }}
      />

      <TouchableOpacity
        onPress={handleAuth}
        style={{ backgroundColor: '#00d4aa', padding: 16, borderRadius: 12, alignItems: 'center' }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
          {isLogin ? 'Inloggen' : 'Registreren'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={{ marginTop: 16, alignItems: 'center' }}>
        <Text style={{ color: '#00d4aa' }}>
          {isLogin ? 'Nog geen account? Registreer hier' : 'Al een account? Log in'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}