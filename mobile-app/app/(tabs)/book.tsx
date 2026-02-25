import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';

const CLUBS = [
  { id: '1', name: 'Sporthal Antwerpen', address: 'Antwerpen Centrum' },
  { id: '2', name: 'Voetbalclub Berchem', address: 'Berchem, Antwerpen' },
  { id: '3', name: 'FC Deurne', address: 'Deurne, Antwerpen' },
  { id: '4', name: 'Sportcomplex Wilrijk', address: 'Wilrijk, Antwerpen' },
];

const TIME_SLOTS = ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

const DAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

export default function BookScreen() {
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=club, 2=datum, 3=tijdslot

  // Genereer de komende 14 dagen
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

  // Haal geboekte slots op voor gekozen club + datum
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
      setBookedSlots(slots);
      setLoadingSlots(false);
    };

    fetchBookedSlots();
  }, [selectedClub, selectedDate]);

  const handleBook = async () => {
    if (!selectedClub || !selectedDate || !selectedTime) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, 'bookings'), {
        clubId: selectedClub.id,
        clubName: selectedClub.name,
        date: formatDate(selectedDate),
        time: selectedTime,
        userId: user?.uid,
        userEmail: user?.email,
        createdAt: new Date(),
      });

      Alert.alert(
        'Geboekt! ✅',
        `${selectedClub.name}\n📅 ${formatDate(selectedDate)} om ${selectedTime}\n\n💳 Betaling gesimuleerd: €15,00`,
        [{
          text: 'OK', onPress: () => {
            setSelectedClub(null);
            setSelectedDate(null);
            setSelectedTime(null);
            setStep(1);
          }
        }]
      );
    } catch (error: any) {
      Alert.alert('Fout', error.message);
    }
    setLoading(false);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      <View style={{ padding: 24, paddingTop: 60 }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>
          🏟️ Veld boeken
        </Text>
        <Text style={{ color: '#888', marginBottom: 24 }}>
          Reserveer een veld
        </Text>

        {/* Stap indicators */}
        <View style={{ flexDirection: 'row', marginBottom: 32, gap: 8 }}>
          {[1, 2, 3].map((s) => (
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
                      <Text style={{
                        color: isBooked ? '#444' : isSelected ? 'white' : 'white',
                        fontWeight: 'bold',
                      }}>
                        {time}
                      </Text>
                      {isBooked && (
                        <Text style={{ color: '#444', fontSize: 10, marginTop: 2 }}>Bezet</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {selectedTime && (
              <TouchableOpacity
                onPress={handleBook}
                disabled={loading}
                style={{
                  backgroundColor: loading ? '#666' : '#00d4aa',
                  padding: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                  {loading ? 'Bezig...' : `Boeken om ${selectedTime} →`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}