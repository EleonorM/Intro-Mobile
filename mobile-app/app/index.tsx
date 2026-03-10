import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
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
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0f0f1e' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / branding */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: '#0d2b25',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#00d4aa',
          }}>
            <Ionicons name="tennisball" size={36} color="#00d4aa" />
          </View>
          <Text style={{ color: 'white', fontSize: 28, fontWeight: '800', letterSpacing: 0.5 }}>
            Football Masters
          </Text>
          <Text style={{ color: '#555', marginTop: 6, fontSize: 14 }}>
            {isLogin ? 'Log in op je account' : 'Maak een nieuw account aan'}
          </Text>
        </View>

        {/* Formulier */}
        <View style={{ gap: 12 }}>
          {!isLogin && (
            <View>
              <Text style={{ color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>Naam</Text>
              <TextInput
                placeholder="Voornaam Achternaam"
                placeholderTextColor="#444"
                value={name}
                onChangeText={setName}
                style={{
                  backgroundColor: '#1a1a2e',
                  color: 'white',
                  padding: 16,
                  borderRadius: 12,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: '#1e1e3a',
                }}
              />
            </View>
          )}

          <View>
            <Text style={{ color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>E-mailadres</Text>
            <TextInput
              placeholder="naam@voorbeeld.be"
              placeholderTextColor="#444"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: '#1a1a2e',
                color: 'white',
                padding: 16,
                borderRadius: 12,
                fontSize: 15,
                borderWidth: 1,
                borderColor: '#1e1e3a',
              }}
            />
          </View>

          <View>
            <Text style={{ color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>Wachtwoord</Text>
            <TextInput
              placeholder="Minimaal 6 tekens"
              placeholderTextColor="#444"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{
                backgroundColor: '#1a1a2e',
                color: 'white',
                padding: 16,
                borderRadius: 12,
                fontSize: 15,
                borderWidth: 1,
                borderColor: '#1e1e3a',
              }}
            />
          </View>
        </View>

        {/* Knop */}
        <TouchableOpacity
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.85}
          style={{
            backgroundColor: loading ? '#1a3d32' : '#00d4aa',
            padding: 18,
            borderRadius: 14,
            alignItems: 'center',
            marginTop: 28,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? (
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Bezig...</Text>
          ) : (
            <>
              <Ionicons name={isLogin ? 'log-in-outline' : 'person-add-outline'} size={18} color="white" />
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                {isLogin ? 'Inloggen' : 'Account aanmaken'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Wissel login/register */}
        <TouchableOpacity
          onPress={() => setIsLogin(!isLogin)}
          style={{ marginTop: 20, alignItems: 'center', padding: 8 }}
        >
          <Text style={{ color: '#555', fontSize: 14 }}>
            {isLogin ? 'Nog geen account? ' : 'Al een account? '}
            <Text style={{ color: '#00d4aa', fontWeight: '600' }}>
              {isLogin ? 'Registreer hier' : 'Log in'}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
