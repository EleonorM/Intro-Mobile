import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, addDoc, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const DAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

// Geeft true als het tijdslot vandaag al voorbij is.
// Als de gekozen datum in de toekomst ligt, is het altijd false.
function isSlotPast(date: Date, time: string): boolean {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (!isToday) return false;
  const [hours, minutes] = time.split(':').map(Number);
  const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  return slotTime <= now;
}

const HANDLE_SIZE = 28;

function snap(val: number, levelMin: number, levelMax: number, levelStep: number) {
  const steps = Math.round((val - levelMin) / levelStep);
  return Math.min(levelMax, Math.max(levelMin, levelMin + steps * levelStep));
}

function RangeSlider({
  minVal,
  maxVal,
  levelMin,
  levelMax,
  levelStep,
  onChange,
}: {
  minVal: number;
  maxVal: number;
  levelMin: number;
  levelMax: number;
  levelStep: number;
  onChange: (min: number, max: number) => void;
}) {
  const sliderWidth = useRef(0);

  const toPercent = (v: number) => (v - levelMin) / (levelMax - levelMin);
  const fromPercent = (p: number) => snap(levelMin + p * (levelMax - levelMin), levelMin, levelMax, levelStep);

  const minPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (sliderWidth.current === 0) return;
        const pct = (gs.moveX - HANDLE_SIZE / 2) / sliderWidth.current;
        const clamped = Math.max(0, Math.min(toPercent(maxVal) - levelStep / (levelMax - levelMin), pct));
        onChange(fromPercent(clamped), maxVal);
      },
    })
  ).current;

  const maxPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (sliderWidth.current === 0) return;
        const pct = (gs.moveX - HANDLE_SIZE / 2) / sliderWidth.current;
        const clamped = Math.min(1, Math.max(toPercent(minVal) + levelStep / (levelMax - levelMin), pct));
        onChange(minVal, fromPercent(clamped));
      },
    })
  ).current;

  const minPct = toPercent(minVal);
  const maxPct = toPercent(maxVal);

  return (
    <View style={{ paddingHorizontal: HANDLE_SIZE / 2 }}>
      {/* Labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>Min niveau</Text>
          <Text style={{ color: '#00d4aa', fontSize: 22, fontWeight: '700' }}>{minVal.toFixed(1)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>Max niveau</Text>
          <Text style={{ color: '#00d4aa', fontSize: 22, fontWeight: '700' }}>{maxVal.toFixed(1)}</Text>
        </View>
      </View>

      {/* Track */}
      <View
        style={{ height: 6, borderRadius: 3, backgroundColor: '#1e1e3a', position: 'relative', justifyContent: 'center' }}
        onLayout={(e: LayoutChangeEvent) => {
          sliderWidth.current = e.nativeEvent.layout.width;
        }}
      >
        {/* Active range */}
        <View
          style={{
            position: 'absolute',
            left: `${minPct * 100}%`,
            right: `${(1 - maxPct) * 100}%`,
            height: 6,
            backgroundColor: '#00d4aa',
            borderRadius: 3,
          }}
        />

        {/* Min handle */}
        <View
          {...minPanResponder.panHandlers}
          style={{
            position: 'absolute',
            left: `${minPct * 100}%`,
            marginLeft: -(HANDLE_SIZE / 2),
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            borderRadius: HANDLE_SIZE / 2,
            backgroundColor: '#00d4aa',
            borderWidth: 3,
            borderColor: '#0f0f1e',
            elevation: 4,
            shadowColor: '#00d4aa',
            shadowOpacity: 0.4,
            shadowRadius: 4,
          }}
        />

        {/* Max handle */}
        <View
          {...maxPanResponder.panHandlers}
          style={{
            position: 'absolute',
            left: `${maxPct * 100}%`,
            marginLeft: -(HANDLE_SIZE / 2),
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            borderRadius: HANDLE_SIZE / 2,
            backgroundColor: '#00d4aa',
            borderWidth: 3,
            borderColor: '#0f0f1e',
            elevation: 4,
            shadowColor: '#00d4aa',
            shadowOpacity: 0.4,
            shadowRadius: 4,
          }}
        />
      </View>

      {/* Min/max labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={{ color: '#444', fontSize: 11 }}>{levelMin.toFixed(1)}</Text>
        <Text style={{ color: '#444', fontSize: 11 }}>{levelMax.toFixed(1)}</Text>
      </View>
    </View>
  );
}

export default function CreateScreen() {
  const [step, setStep] = useState(1);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [minLevel, setMinLevel] = useState(1.5);
  const [maxLevel, setMaxLevel] = useState(3.0);
  const [format, setFormat] = useState('5v5');
  const [isMixed, setIsMixed] = useState(false);
  const [isCompetitive, setIsCompetitive] = useState(false);
  const [loading, setLoading] = useState(false);

  // Data uit Firebase
  const [clubs, setClubs] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [levelMin, setLevelMin] = useState(0.5);
  const [levelMax, setLevelMax] = useState(7.0);
  const [levelStep, setLevelStep] = useState(0.5);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const clubsSnapshot = await getDocs(collection(db, 'clubs'));
        const clubsList = clubsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        clubsList.sort((a: any, b: any) => a.id.localeCompare(b.id));
        setClubs(clubsList);

        const configSnap = await getDoc(doc(db, 'appConfig', 'settings'));
        if (configSnap.exists()) {
          const cfg = configSnap.data();
          setTimeSlots(cfg.timeSlots ?? []);
          setFormats(cfg.formats ?? []);
          setLevelMin(cfg.levelMin ?? 0.5);
          setLevelMax(cfg.levelMax ?? 7.0);
          setLevelStep(cfg.levelStep ?? 0.5);
          setFormat(cfg.formats?.[0] ?? '5v5');
        }
      } catch (err: any) {
        Alert.alert('Fout', 'Kon configuratie niet laden: ' + err.message);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setStep(1);
      setSelectedClub(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setMinLevel(1.5);
      setMaxLevel(3.0);
      setFormat(formats[0] ?? '5v5');
      setIsMixed(false);
      setIsCompetitive(false);
    }, [formats])
  );

  const formatMaxPlayers: Record<string, number> = { '5v5': 10, '7v7': 14, '11v11': 22 };
  const maxPlayers = formatMaxPlayers[format] ?? 10;

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
    setLoading(true);
    try {
      const user = auth.currentUser;

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
        Alert.alert('Niet beschikbaar', 'Dit tijdslot is al bezet. Kies een ander tijdstip.');
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'matches'), {
        date: formatDate(selectedDate!),
        time: selectedTime,
        club: selectedClub.name,
        clubId: selectedClub.id,
        minLevel,
        maxLevel,
        format,
        maxPlayers,
        isMixed,
        isCompetitive,
        players: [user?.uid],
        createdBy: user?.uid,
        createdAt: new Date(),
        status: 'open',
      });

      Alert.alert('Wedstrijd aangemaakt', 'De match is zichtbaar voor andere spelers.', [
        { text: 'OK', onPress: () => router.push('/(tabs)/matches') },
      ]);
    } catch (error: any) {
      Alert.alert('Fout', error.message);
    }
    setLoading(false);
  };

  if (loadingConfig) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f1e', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#00d4aa" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0f0f1e' }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, backgroundColor: '#12122a' }}>
        <Text style={{ color: 'white', fontSize: 26, fontWeight: '700', letterSpacing: 0.3 }}>
          Wedstrijd aanmaken
        </Text>
        <Text style={{ color: '#666', marginTop: 4, fontSize: 14 }}>Maak een nieuwe match aan</Text>
      </View>

      <View style={{ padding: 24 }}>
        {/* Stap indicators */}
        <View style={{ flexDirection: 'row', marginBottom: 28, gap: 6 }}>
          {[1, 2, 3, 4].map((s) => (
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
            {clubs.map((club) => (
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
                {timeSlots.map((time) => {
                  const isBooked = bookedSlots.includes(time);
                  const isPast = isSlotPast(selectedDate!, time);
                  const isDisabled = isBooked || isPast;
                  const isSelected = selectedTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      onPress={() => !isDisabled && setSelectedTime(time)}
                      disabled={isDisabled}
                      style={{
                        paddingHorizontal: 18,
                        paddingVertical: 14,
                        borderRadius: 12,
                        backgroundColor: isDisabled ? '#141420' : isSelected ? '#00d4aa' : '#1a1a2e',
                        minWidth: '28%',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isSelected ? '#00d4aa' : isDisabled ? '#1a1a2e' : '#1e1e3a',
                      }}
                    >
                      <Text style={{ color: isDisabled ? '#333' : 'white', fontWeight: '600' }}>{time}</Text>
                      {isBooked && <Text style={{ color: '#333', fontSize: 10, marginTop: 2 }}>Bezet</Text>}
                      {isPast && !isBooked && <Text style={{ color: '#333', fontSize: 10, marginTop: 2 }}>Voorbij</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {selectedTime && (
              <TouchableOpacity
                onPress={() => setStep(4)}
                style={{ backgroundColor: '#00d4aa', padding: 16, borderRadius: 14, alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Volgende</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* STAP 4: Details */}
        {step === 4 && (
          <View>
            <TouchableOpacity onPress={() => setStep(3)} style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chevron-back" size={16} color="#00d4aa" />
              <Text style={{ color: '#00d4aa', fontSize: 14 }}>{selectedTime}</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
              Stap 4 — Wedstrijd details
            </Text>

            {/* Samenvatting */}
            <View style={{ backgroundColor: '#1a1a2e', padding: 14, borderRadius: 14, marginBottom: 24, borderWidth: 1, borderColor: '#1e1e3a' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="location-outline" size={13} color="#00d4aa" />
                <Text style={{ color: '#aaa', fontSize: 13 }}>{selectedClub?.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <Ionicons name="calendar-outline" size={13} color="#00d4aa" />
                <Text style={{ color: '#aaa', fontSize: 13 }}>{formatDate(selectedDate!)} om {selectedTime}</Text>
              </View>
            </View>

            {/* Niveau range slider */}
            <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Niveau range
            </Text>
            <View style={{ backgroundColor: '#1a1a2e', padding: 20, borderRadius: 14, marginBottom: 24, borderWidth: 1, borderColor: '#1e1e3a' }}>
              <RangeSlider
                minVal={minLevel}
                maxVal={maxLevel}
                levelMin={levelMin}
                levelMax={levelMax}
                levelStep={levelStep}
                onChange={(min, max) => { setMinLevel(min); setMaxLevel(max); }}
              />
            </View>

            {/* Formaat */}
            <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Formaat
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              {formats.map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFormat(f)}
                  style={{
                    flex: 1,
                    padding: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: format === f ? '#00d4aa' : '#1a1a2e',
                    borderWidth: 1,
                    borderColor: format === f ? '#00d4aa' : '#1e1e3a',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Opties */}
            <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Opties
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setIsMixed(!isMixed)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: isMixed ? '#00d4aa' : '#1a1a2e',
                  borderWidth: 1,
                  borderColor: isMixed ? '#00d4aa' : '#1e1e3a',
                }}
              >
                <Ionicons name="people-outline" size={16} color="white" style={{ marginBottom: 4 }} />
                <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Gemengd</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsCompetitive(!isCompetitive)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: isCompetitive ? '#00d4aa' : '#1a1a2e',
                  borderWidth: 1,
                  borderColor: isCompetitive ? '#00d4aa' : '#1e1e3a',
                }}
              >
                <Ionicons name="trophy-outline" size={16} color="white" style={{ marginBottom: 4 }} />
                <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Competitief</Text>
              </TouchableOpacity>
            </View>

            {/* Overzicht */}
            <View style={{ backgroundColor: '#1a1a2e', padding: 14, borderRadius: 14, marginBottom: 24, borderWidth: 1, borderColor: '#1e1e3a' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#666', fontSize: 13 }}>Formaat</Text>
                <Text style={{ color: '#00d4aa', fontSize: 13, fontWeight: '600' }}>{format}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: '#666', fontSize: 13 }}>Spelers nodig</Text>
                <Text style={{ color: '#00d4aa', fontSize: 13, fontWeight: '600' }}>{maxPlayers}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleCreate}
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
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Wedstrijd aanmaken</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
