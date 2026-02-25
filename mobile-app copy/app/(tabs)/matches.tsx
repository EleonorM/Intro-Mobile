import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { router } from 'expo-router';

export default function MatchesScreen() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMatches(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      <View style={{ padding: 24, paddingTop: 60 }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>⚽ Wedstrijden</Text>
        <Text style={{ color: '#888', marginTop: 4 }}>Vind een wedstrijd</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#00d4aa" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={{ padding: 24 }}>
          {matches.length === 0 ? (
            <Text style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>
              Nog geen wedstrijden beschikbaar
            </Text>
          ) : (
            matches.map((match) => (
              <TouchableOpacity
                key={match.id}
                onPress={() => router.push(`/match/${match.id}`)}
                style={{ backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 16 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                    {match.date} | {match.time}
                  </Text>
                  <View style={{ backgroundColor: match.status === 'open' ? '#00d4aa' : '#e74c3c', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ color: 'white', fontSize: 12 }}>{match.status === 'open' ? 'Open' : 'Vol'}</Text>
                  </View>
                </View>

                <Text style={{ color: '#888', marginBottom: 4 }}>📍 {match.club}</Text>
                <Text style={{ color: '#888', marginBottom: 4 }}>
                  📊 Niveau: {match.minLevel} - {match.maxLevel}
                </Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ color: '#00d4aa' }}>⚽ {match.format}</Text>
                  <Text style={{ color: '#888' }}>
                    👥 {match.players?.length}/{match.maxPlayers} spelers
                  </Text>
                  <Text style={{ color: match.isCompetitive ? '#f39c12' : '#888' }}>
                    {match.isCompetitive ? '🏆 Competitief' : '🤝 Vriendelijk'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}