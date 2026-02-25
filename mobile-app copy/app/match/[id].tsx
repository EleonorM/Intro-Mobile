import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, arrayUnion, collection, addDoc, orderBy, query } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';

export default function MatchDetail() {
  const { id } = useLocalSearchParams();
  const [match, setMatch] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const user = auth.currentUser;

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'matches', id as string), (doc) => {
      setMatch({ id: doc.id, ...doc.data() });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    const q = query(
      collection(db, 'matches', id as string, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [id]);

  const handleJoin = async () => {
    if (!match || !user) return;

    if (match.players?.includes(user.uid)) {
      Alert.alert('Info', 'Je bent al ingeschreven!');
      return;
    }

    if (match.players?.length >= match.maxPlayers) {
      Alert.alert('Fout', 'Deze wedstrijd is al vol!');
      return;
    }

    Alert.alert(
      'Inschrijven',
      `Wil je deelnemen aan deze wedstrijd?\n\n💳 Betaling gesimuleerd: €5,00`,
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Betalen & Inschrijven',
          onPress: async () => {
            await updateDoc(doc(db, 'matches', id as string), {
              players: arrayUnion(user.uid),
            });
            await addDoc(collection(db, 'matches', id as string, 'messages'), {
              text: `${user.email} heeft zich ingeschreven! 🎉`,
              system: true,
              createdAt: new Date(),
            });
            Alert.alert('Succes!', 'Je bent ingeschreven!');
          },
        },
      ]
    );
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    await addDoc(collection(db, 'matches', id as string, 'messages'), {
      text: newMessage.trim(),
      userId: user.uid,
      userEmail: user.email,
      system: false,
      createdAt: new Date(),
    });
    setNewMessage('');
  };

  if (loading) return <ActivityIndicator color="#00d4aa" style={{ flex: 1, backgroundColor: '#1a1a2e' }} />;

  const isJoined = match?.players?.includes(user?.uid);

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      {/* Header */}
      <View style={{ padding: 24, paddingTop: 60, backgroundColor: '#16213e' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Text style={{ color: '#00d4aa' }}>← Terug</Text>
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold' }}>
          ⚽ {match?.date} | {match?.time}
        </Text>
        <Text style={{ color: '#888', marginTop: 4 }}>📍 {match?.club}</Text>

        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
          <Text style={{ color: '#888' }}>📊 {match?.minLevel} - {match?.maxLevel}</Text>
          <Text style={{ color: '#00d4aa' }}>⚽ {match?.format}</Text>
          <Text style={{ color: match?.isCompetitive ? '#f39c12' : '#888' }}>
            {match?.isCompetitive ? '🏆 Competitief' : '🤝 Vriendelijk'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <Text style={{ color: '#888' }}>
            👥 {match?.players?.length}/{match?.maxPlayers} spelers
          </Text>
          {!isJoined ? (
            <TouchableOpacity
              onPress={handleJoin}
              style={{ backgroundColor: '#00d4aa', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Inschrijven €5</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ backgroundColor: '#27ae60', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}>
              <Text style={{ color: 'white', fontWeight: 'bold' }}>✓ Ingeschreven</Text>
            </View>
          )}
        </View>
      </View>

      {/* Chat */}
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={{ color: '#888', textAlign: 'center', marginBottom: 16 }}>💬 Match chat</Text>
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={{
              marginBottom: 12,
              alignItems: msg.system ? 'center' : msg.userId === user?.uid ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.system ? (
              <Text style={{ color: '#666', fontSize: 12, fontStyle: 'italic' }}>{msg.text}</Text>
            ) : (
              <View>
                {msg.userId !== user?.uid && (
                  <Text style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>{msg.userEmail}</Text>
                )}
                <View style={{
                  backgroundColor: msg.userId === user?.uid ? '#00d4aa' : '#16213e',
                  padding: 12,
                  borderRadius: 16,
                  maxWidth: '80%',
                }}>
                  <Text style={{ color: 'white' }}>{msg.text}</Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bericht sturen - alleen als ingeschreven */}
      {isJoined ? (
        <View style={{ flexDirection: 'row', padding: 16, gap: 8, backgroundColor: '#16213e' }}>
          <TextInput
            placeholder="Stuur een bericht..."
            placeholderTextColor="#666"
            value={newMessage}
            onChangeText={setNewMessage}
            style={{ flex: 1, backgroundColor: '#1a1a2e', color: 'white', padding: 12, borderRadius: 12 }}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            style={{ backgroundColor: '#00d4aa', padding: 12, borderRadius: 12, justifyContent: 'center' }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>→</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ padding: 16, backgroundColor: '#16213e' }}>
          <Text style={{ color: '#666', textAlign: 'center' }}>Schrijf je in om te chatten</Text>
        </View>
      )}
    </View>
  );
}