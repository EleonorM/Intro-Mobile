import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { Ionicons } from '@expo/vector-icons';

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
  const [step, setStep] = useState(1);

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

  const formatDate = (date: Date) =>
    `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

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
        'Veld geboekt',
        `${selectedClub.name}\n${formatDate(selectedDate)} om ${selectedTime}\n\nBetaling gesimuleerd: €15,00`,
        [{
          text: 'OK', onPress: () => {
            setSelectedClub(null);
            setSelectedDate(null);
            setSelectedTime(null);
            setStep(1);
          },
        }]
      );
    } catch (error: any) {
      Alert.alert('Fout', error.message);
    }
    setLoading(false);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0f0f1e' }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, backgroundColor: '#12122a' }}>
        <Text style={{ color: 'white', fontSize: 26, fontWeight: '700', letterSpacing: 0.3 }}>
          Veld boeken
        </Text>
        <Text style={{ color: '#666', marginTop: 4, fontSize: 14 }}>Reserveer een veld</Text>
      </View>

      <View style={{ padding: 24 }}>
        {/* Stap indicators */}
        <View style={{ flexDirection: 'row', marginBottom: 28, gap: 6 }}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: step >= s ? '#00d4aa' : '#1e1e3a',
              }}
            />
          ))}
        </View>

        {/* STAP 1: Club */}
        {step === 1 && (
          <View>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
              Stap 1 — Kies een club
            </Text>
            {CLUBS.map((club) => (
              <TouchableOpacity
                key={club.id}
                onPress={() => { setSelectedClub(club); setStep(2); }}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#1a1a2e',
                  padding: 16,
                  borderRadius: 14,
                  marginBottom: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#1e1e3a',
                }}
              >
                <View>
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>{club.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Ionicons name="location-outline" size={12} color="#666" />
                    <Text style={{ color: '#666', fontSize: 13 }}>{club.address}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#00d4aa" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STAP 2: Datum */}
        {step === 2 && (
          <View>
            <TouchableOpacity onPress={() => setStep(1)} style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chevron-back" size={16} color="#00d4aa" />
              <Text style={{ color: '#00d4aa', fontSize: 14 }}>{selectedClub?.name}</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
              Stap 2 — Kies een datum
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {getDates().map((date, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => { setSelectedDate(date); setSelectedTime(null); setStep(3); }}
                  style={{
                    width: '13%',
                    aspectRatio: 0.8,
                    backgroundColor: '#1a1a2e',
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 6,
                    borderWidth: 1,
                    borderColor: '#1e1e3a',
                  }}
                >
                  <Text style={{ color: '#888', fontSize: 10 }}>{DAYS[date.getDay()]}</Text>
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{date.getDate()}</Text>
                  <Text style={{ color: '#888', fontSize: 10 }}>{MONTHS[date.getMonth()]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* STAP 3: Tijdslot */}
        {step === 3 && (
          <View>
            <TouchableOpacity onPress={() => setStep(2)} style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chevron-back" size={16} color="#00d4aa" />
              <Text style={{ color: '#00d4aa', fontSize: 14 }}>{formatDate(selectedDate!)}</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 6 }}>
              Stap 3 — Kies een tijdslot
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 }}>
              <Ionicons name="location-outline" size={13} color="#666" />
              <Text style={{ color: '#666', fontSize: 13 }}>{selectedClub?.name} · {formatDate(selectedDate!)}</Text>
            </View>

            {loadingSlots ? (
              <ActivityIndicator color="#00d4aa" />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                {TIME_SLOTS.map((time) => {
                  const isBooked = bookedSlots.includes(time);
                  const isSelected = selectedTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      onPress={() => !isBooked && setSelectedTime(time)}
                      disabled={isBooked}
                      style={{
                        paddingHorizontal: 18,
                        paddingVertical: 14,
                        borderRadius: 12,
                        backgroundColor: isBooked ? '#141420' : isSelected ? '#00d4aa' : '#1a1a2e',
                        minWidth: '28%',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isSelected ? '#00d4aa' : isBooked ? '#1a1a2e' : '#1e1e3a',
                      }}
                    >
                      <Text style={{ color: isBooked ? '#333' : 'white', fontWeight: '600' }}>{time}</Text>
                      {isBooked && <Text style={{ color: '#333', fontSize: 10, marginTop: 2 }}>Bezet</Text>}
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
                  backgroundColor: loading ? '#333' : '#00d4aa',
                  padding: 18,
                  borderRadius: 14,
                  alignItems: 'center',
                }}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                    Boeken om {selectedTime}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
