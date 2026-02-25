import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { router, useFocusEffect } from 'expo-router';


const CLUBS = [
  { id: '1', name: 'Sporthal Antwerpen', address: 'Antwerpen Centrum' },
  { id: '2', name: 'Voetbalclub Berchem', address: 'Berchem, Antwerpen' },
  { id: '3', name: 'FC Deurne', address: 'Deurne, Antwerpen' },
  { id: '4', name: 'Sportcomplex Wilrijk', address: 'Wilrijk, Antwerpen' },
];

const TIME_SLOTS = ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
const DAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

export default function CreateScreen() {
  const [step, setStep] = useState(1);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [minLevel, setMinLevel] = useState('');
  const [maxLevel, setMaxLevel] = useState('');
  const [format, setFormat] = useState('5v5');
  const [isMixed, setIsMixed] = useState(false);
  const [isCompetitive, setIsCompetitive] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
  useCallback(() => {
    setStep(1);
    setSelectedClub(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setMinLevel('');
    setMaxLevel('');
    setFormat('5v5');
    setIsMixed(false);
    setIsCompetitive(false);
  }, [])
);
  

  const maxPlayers = format === '5v5' ? 10 : format === '7v7' ? 14 : 22;

  const getDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const formatDate = (date: Date) => {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  useEffect(() => {
    if (!selectedClub || !selectedDate) return;
    const fetchBookedSlots = async () => {
      setLoadingSlots(true);
      const q = query(
        collection(db, 'bookings'),
        where('clubId', '==', selectedClub.id),
        where('date', '==', formatDate(selectedDate))
      );
      const snapshot = await getDocs(q);
      const slots = snapshot.docs.map((doc) => doc.data().time);

      // Ook wedstrijden op hetzelfde tijdstip blokkeren
      const q2 = query(
        collection(db, 'matches'),
        where('clubId', '==', selectedClub.id),
        where('date', '==', formatDate(selectedDate))
      );
      const snapshot2 = await getDocs(q2);
      const slots2 = snapshot2.docs.map((doc) => doc.data().time);

      setBookedSlots([...slots, ...slots2]);
      setLoadingSlots(false);
    };
    fetchBookedSlots();
  }, [selectedClub, selectedDate]);

const handleCreate = async () => {
    if (!minLevel || !maxLevel) {
      Alert.alert('Fout', 'Vul het niveau in!');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;

      // Controleer of er al een wedstrijd bestaat op dit tijdstip
      const q1 = query(
        collection(db, 'matches'),
        where('clubId', '==', selectedClub.id),
        where('date', '==', formatDate(selectedDate!)),
        where('time', '==', selectedTime)
      );
      const q2 = query(
        collection(db, 'bookings'),
        where('clubId', '==', selectedClub.id),
        where('date', '==', formatDate(selectedDate!)),
        where('time', '==', selectedTime)
      );

      const [matchSnap, bookingSnap] = await Promise.all([getDocs(q1), getDocs(q2)]);

      if (!matchSnap.empty || !bookingSnap.empty) {
        Alert.alert('Niet beschikbaar', 'Dit tijdslot is al bezet! Kies een ander tijdstip.');
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'matches'), {
        date: formatDate(selectedDate!),
        time: selectedTime,
        club: selectedClub.name,
        clubId: selectedClub.id,
        minLevel: parseFloat(minLevel),
        maxLevel: parseFloat(maxLevel),
        format,
        maxPlayers,
        isMixed,
        isCompetitive,
        players: [user?.uid],
        createdBy: user?.uid,
        createdAt: new Date(),
        status: 'open',
      });

      Alert.alert('Succes! 🎉', 'Wedstrijd aangemaakt!', [
        { text: 'OK', onPress: () => router.push('/(tabs)/matches') }
      ]);
    } catch (error: any) {
      Alert.alert('Fout', error.message);
    }
    setLoading(false);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      <View style={{ padding: 24, paddingTop: 60 }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>
          ⚽ Wedstrijd aanmaken
        </Text>
        <Text style={{ color: '#888', marginBottom: 24 }}>Maak een nieuwe match aan</Text>

        {/* Stap indicators */}
        <View style={{ flexDirection: 'row', marginBottom: 32, gap: 8 }}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: step >= s ? '#00d4aa' : '#16213e' }} />
          ))}
        </View>

        {/* STAP 1: Club kiezen */}
        {step === 1 && (
          <View>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              Stap 1: Kies een club
            </Text>
            {CLUBS.map((club) => (
              <TouchableOpacity
                key={club.id}
                onPress={() => { setSelectedClub(club); setStep(2); }}
                style={{
                  backgroundColor: '#16213e',
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 12,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>{club.name}</Text>
                  <Text style={{ color: '#888', marginTop: 2 }}>📍 {club.address}</Text>
                </View>
                <Text style={{ color: '#00d4aa', fontSize: 20 }}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STAP 2: Datum kiezen */}
        {step === 2 && (
          <View>
            <TouchableOpacity onPress={() => setStep(1)} style={{ marginBottom: 16 }}>
              <Text style={{ color: '#00d4aa' }}>← {selectedClub?.name}</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              Stap 2: Kies een datum
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {getDates().map((date, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => { setSelectedDate(date); setSelectedTime(null); setStep(3); }}
                  style={{
                    width: '13%',
                    aspectRatio: 0.8,
                    backgroundColor: '#16213e',
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                  }}
                >
                  <Text style={{ color: '#888', fontSize: 11 }}>{DAYS[date.getDay()]}</Text>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{date.getDate()}</Text>
                  <Text style={{ color: '#888', fontSize: 11 }}>{MONTHS[date.getMonth()]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* STAP 3: Tijdslot kiezen */}
        {step === 3 && (
          <View>
            <TouchableOpacity onPress={() => setStep(2)} style={{ marginBottom: 16 }}>
              <Text style={{ color: '#00d4aa' }}>← {formatDate(selectedDate!)}</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
              Stap 3: Kies een tijdslot
            </Text>
            <Text style={{ color: '#888', marginBottom: 16 }}>
              📍 {selectedClub?.name} · {formatDate(selectedDate!)}
            </Text>

            {loadingSlots ? (
              <ActivityIndicator color="#00d4aa" />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                {TIME_SLOTS.map((time) => {
                  const isBooked = bookedSlots.includes(time);
                  const isSelected = selectedTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      onPress={() => !isBooked && setSelectedTime(time)}
                      disabled={isBooked}
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        borderRadius: 12,
                        backgroundColor: isBooked ? '#2a2a2a' : isSelected ? '#00d4aa' : '#16213e',
                        minWidth: '28%',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: isBooked ? '#444' : 'white', fontWeight: 'bold' }}>{time}</Text>
                      {isBooked && <Text style={{ color: '#444', fontSize: 10, marginTop: 2 }}>Bezet</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {selectedTime && (
              <TouchableOpacity
                onPress={() => setStep(4)}
                style={{ backgroundColor: '#00d4aa', padding: 16, borderRadius: 12, alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                  Volgende →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* STAP 4: Wedstrijd details */}
        {step === 4 && (
          <View>
            <TouchableOpacity onPress={() => setStep(3)} style={{ marginBottom: 16 }}>
              <Text style={{ color: '#00d4aa' }}>← {selectedTime}</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              Stap 4: Wedstrijd details
            </Text>

            {/* Samenvatting */}
            <View style={{ backgroundColor: '#16213e', padding: 16, borderRadius: 12, marginBottom: 24 }}>
              <Text style={{ color: '#888' }}>📍 {selectedClub?.name}</Text>
              <Text style={{ color: '#888', marginTop: 4 }}>📅 {formatDate(selectedDate!)} om {selectedTime}</Text>
            </View>

            <Text style={{ color: '#888', marginBottom: 6 }}>Niveau range (0.5 - 7)</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <TextInput
                placeholder="Min (bv. 1.5)"
                placeholderTextColor="#666"
                value={minLevel}
                onChangeText={setMinLevel}
                keyboardType="numeric"
                style={{ flex: 1, backgroundColor: '#16213e', color: 'white', padding: 16, borderRadius: 12 }}
              />
              <TextInput
                placeholder="Max (bv. 3.0)"
                placeholderTextColor="#666"
                value={maxLevel}
                onChangeText={setMaxLevel}
                keyboardType="numeric"
                style={{ flex: 1, backgroundColor: '#16213e', color: 'white', padding: 16, borderRadius: 12 }}
              />
            </View>

            <Text style={{ color: '#888', marginBottom: 6 }}>Formaat</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {['5v5', '7v7', '11v11'].map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFormat(f)}
                  style={{
                    flex: 1, padding: 12, borderRadius: 12, alignItems: 'center',
                    backgroundColor: format === f ? '#00d4aa' : '#16213e',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setIsMixed(!isMixed)}
                style={{
                  flex: 1, padding: 12, borderRadius: 12, alignItems: 'center',
                  backgroundColor: isMixed ? '#00d4aa' : '#16213e',
                }}
              >
                <Text style={{ color: 'white' }}>👥 Gemengd</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsCompetitive(!isCompetitive)}
                style={{
                  flex: 1, padding: 12, borderRadius: 12, alignItems: 'center',
                  backgroundColor: isCompetitive ? '#00d4aa' : '#16213e',
                }}
              >
                <Text style={{ color: 'white' }}>🏆 Competitief</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#16213e', padding: 16, borderRadius: 12, marginBottom: 24 }}>
              <Text style={{ color: '#888' }}>Formaat: <Text style={{ color: '#00d4aa' }}>{format}</Text></Text>
              <Text style={{ color: '#888', marginTop: 4 }}>Spelers nodig: <Text style={{ color: '#00d4aa' }}>{maxPlayers}</Text></Text>
            </View>

            <TouchableOpacity
              onPress={handleCreate}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#666' : '#00d4aa',
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                {loading ? 'Bezig...' : 'Wedstrijd aanmaken ✓'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}