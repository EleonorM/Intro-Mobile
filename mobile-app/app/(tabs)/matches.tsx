import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useState, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
// onAuthStateChanged = luisteraar die reageert op inloggen én uitloggen
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../config/firebase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type SortKey = 'datum' | 'spelers';
type FilterStatus = 'alle' | 'open' | 'vol';
type FilterFormat = 'alle' | '5v5' | '7v7' | '11v11';
type FilterType = 'alle' | 'competitief' | 'vriendelijk';
type FilterLevel = 'alle' | 'beginner' | 'gemiddeld' | 'gevorderd';

// Geeft true als de wedstrijddatum + tijdstip al voorbij zijn
function isMatchExpired(date: string, time: string): boolean {
  const [day, month, year] = date.split('/').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes) < new Date();
}

// Geeft true als de wedstrijddatum én het uur al voorbij zijn.
// Datumformaat in Firestore: "DD/MM/YYYY", tijdformaat: "HH:MM"
function isExpired(date: string, time: string): boolean {
  const [day, month, year] = date.split('/').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const matchDate = new Date(year, month - 1, day, hours, minutes);
  return matchDate < new Date();
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: active ? '#00d4aa' : '#1a1a2e',
        borderWidth: 1,
        borderColor: active ? '#00d4aa' : '#1e1e3a',
        marginRight: 8,
      }}
    >
      <Text style={{ color: active ? 'white' : '#666', fontSize: 13, fontWeight: active ? '700' : '400' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function MatchesScreen() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filter & sorteer state
  const [sortKey, setSortKey] = useState<SortKey>('datum');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('alle');
  const [filterFormat, setFilterFormat] = useState<FilterFormat>('alle');
  const [filterType, setFilterType] = useState<FilterType>('alle');
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('alle');

  // Bewaar de stop-functie van onSnapshot in een ref.
  // Zo kunnen we de luisteraar stoppen vóórdat de gebruiker uitlogt,
  // anders krijgen we een "permission-denied" error van Firebase.
  const unsubscribeMatchesRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Luister naar login/logout events
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Gebruiker is ingelogd: start de Firestore luisteraar voor alle wedstrijden
        const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
        unsubscribeMatchesRef.current = onSnapshot(q, (snapshot) => {
          const active: any[] = [];

          snapshot.docs.forEach((d) => {
            const match = { id: d.id, ...d.data() } as any;
            if (isMatchExpired(match.date, match.time)) {
              // Verwijder verlopen wedstrijden uit Firebase
              deleteDoc(doc(db, 'matches', d.id));
            } else {
              active.push(match);
            }
          });

          setMatches(active);
          setLoading(false);
        });
      } else {
        // Gebruiker is uitgelogd: stop de luisteraar direct
        if (unsubscribeMatchesRef.current) {
          unsubscribeMatchesRef.current();
          unsubscribeMatchesRef.current = null;
        }
        setMatches([]);
        setLoading(false);
      }
    });

    // Cleanup: stop beide luisteraars als dit scherm van het scherm verdwijnt
    return () => {
      unsubscribeAuth();
      if (unsubscribeMatchesRef.current) {
        unsubscribeMatchesRef.current();
        unsubscribeMatchesRef.current = null;
      }
    };
  }, []);

  // Bereken gefilterde + gesorteerde lijst
  const filteredMatches = useMemo(() => {
    let result = [...matches];

    if (filterStatus !== 'alle') {
      result = result.filter((m) => m.status === filterStatus);
    }
    if (filterFormat !== 'alle') {
      result = result.filter((m) => m.format === filterFormat);
    }
    if (filterType === 'competitief') {
      result = result.filter((m) => m.isCompetitive === true);
    } else if (filterType === 'vriendelijk') {
      result = result.filter((m) => !m.isCompetitive);
    }

    // Niveau filter: op basis van het minimum niveau van de wedstrijd
    if (filterLevel === 'beginner') {
      result = result.filter((m) => m.minLevel < 2.5);
    } else if (filterLevel === 'gemiddeld') {
      result = result.filter((m) => m.minLevel >= 2.5 && m.minLevel < 4.5);
    } else if (filterLevel === 'gevorderd') {
      result = result.filter((m) => m.minLevel >= 4.5);
    }

    if (sortKey === 'spelers') {
      result.sort((a, b) => {
        const aFree = (a.maxPlayers ?? 0) - (a.players?.length ?? 0);
        const bFree = (b.maxPlayers ?? 0) - (b.players?.length ?? 0);
        return bFree - aFree; // meeste vrije plekken eerst
      });
    }
    // 'datum' gebruikt de standaard Firestore volgorde (createdAt desc)

    return result;
  }, [matches, sortKey, filterStatus, filterFormat, filterType]);

  const activeFilterCount = [
    filterStatus !== 'alle',
    filterFormat !== 'alle',
    filterType !== 'alle',
    filterLevel !== 'alle',
    sortKey !== 'datum',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFilterStatus('alle');
    setFilterFormat('alle');
    setFilterType('alle');
    setFilterLevel('alle');
    setSortKey('datum');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f1e' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16, backgroundColor: '#12122a' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: 'white', fontSize: 26, fontWeight: '700', letterSpacing: 0.3 }}>
              Wedstrijden
            </Text>
            <Text style={{ color: '#666', marginTop: 2, fontSize: 14 }}>
              {loading ? '...' : `${filteredMatches.length} match${filteredMatches.length !== 1 ? 'es' : ''} gevonden`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: showFilters ? '#00d4aa' : '#1a1a2e',
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: showFilters ? '#00d4aa' : '#1e1e3a',
            }}
          >
            <Ionicons name="options-outline" size={16} color={showFilters ? 'white' : '#888'} />
            <Text style={{ color: showFilters ? 'white' : '#888', fontSize: 13, fontWeight: '600' }}>
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter paneel */}
      {showFilters && (
        <View style={{ backgroundColor: '#12122a', borderBottomWidth: 1, borderBottomColor: '#1e1e3a', paddingBottom: 16 }}>
          {/* Sorteren */}
          <View style={{ paddingHorizontal: 24, paddingTop: 12, marginBottom: 12 }}>
            <Text style={{ color: '#555', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
              Sorteren
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <FilterChip label="Nieuwste eerst" active={sortKey === 'datum'} onPress={() => setSortKey('datum')} />
              <FilterChip label="Vrije plekken" active={sortKey === 'spelers'} onPress={() => setSortKey('spelers')} />
            </ScrollView>
          </View>

          {/* Status */}
          <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
            <Text style={{ color: '#555', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
              Status
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <FilterChip label="Alle" active={filterStatus === 'alle'} onPress={() => setFilterStatus('alle')} />
              <FilterChip label="Open" active={filterStatus === 'open'} onPress={() => setFilterStatus('open')} />
              <FilterChip label="Vol" active={filterStatus === 'vol'} onPress={() => setFilterStatus('vol')} />
            </ScrollView>
          </View>

          {/* Formaat */}
          <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
            <Text style={{ color: '#555', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
              Formaat
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <FilterChip label="Alle" active={filterFormat === 'alle'} onPress={() => setFilterFormat('alle')} />
              <FilterChip label="5v5" active={filterFormat === '5v5'} onPress={() => setFilterFormat('5v5')} />
              <FilterChip label="7v7" active={filterFormat === '7v7'} onPress={() => setFilterFormat('7v7')} />
              <FilterChip label="11v11" active={filterFormat === '11v11'} onPress={() => setFilterFormat('11v11')} />
            </ScrollView>
          </View>

          {/* Type */}
          <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
            <Text style={{ color: '#555', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
              Type
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <FilterChip label="Alle" active={filterType === 'alle'} onPress={() => setFilterType('alle')} />
              <FilterChip label="Competitief" active={filterType === 'competitief'} onPress={() => setFilterType('competitief')} />
              <FilterChip label="Vriendelijk" active={filterType === 'vriendelijk'} onPress={() => setFilterType('vriendelijk')} />
            </ScrollView>
          </View>

          {/* Niveau */}
          <View style={{ paddingHorizontal: 24, marginBottom: 4 }}>
            <Text style={{ color: '#555', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
              Niveau
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <FilterChip label="Alle" active={filterLevel === 'alle'} onPress={() => setFilterLevel('alle')} />
              <FilterChip label="Beginner (0.5–2.5)" active={filterLevel === 'beginner'} onPress={() => setFilterLevel('beginner')} />
              <FilterChip label="Gemiddeld (2.5–4.5)" active={filterLevel === 'gemiddeld'} onPress={() => setFilterLevel('gemiddeld')} />
              <FilterChip label="Gevorderd (4.5–7.0)" active={filterLevel === 'gevorderd'} onPress={() => setFilterLevel('gevorderd')} />
            </ScrollView>
          </View>

          {/* Reset */}
          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={resetFilters} style={{ paddingHorizontal: 24, paddingTop: 10 }}>
              <Text style={{ color: '#e74c3c', fontSize: 13, fontWeight: '600' }}>Filters resetten</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Wedstrijdlijst */}
      {loading ? (
        <ActivityIndicator color="#00d4aa" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {filteredMatches.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Ionicons name="search-outline" size={48} color="#333" />
              <Text style={{ color: '#555', marginTop: 16, fontSize: 15 }}>
                Geen wedstrijden gevonden
              </Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={resetFilters} style={{ marginTop: 12 }}>
                  <Text style={{ color: '#00d4aa', fontSize: 14 }}>Filters wissen</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredMatches.map((match) => {
              const freePlaces = (match.maxPlayers ?? 0) - (match.players?.length ?? 0);
              const isFull = freePlaces <= 0;
              return (
                <TouchableOpacity
                  key={match.id}
                  onPress={() => router.push(`/match/${match.id}`)}
                  activeOpacity={isFull ? 1 : 0.85}
                  disabled={isFull}
                  style={{
                    backgroundColor: '#1a1a2e',
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: '#1e1e3a',
                    opacity: isFull ? 0.45 : 1,
                  }}
                >
                  {/* Bovenste rij: datum + status badge */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="calendar-outline" size={14} color="#00d4aa" />
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
                        {match.date}  {match.time}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: match.status === 'open' ? '#003d30' : '#3d1010',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: match.status === 'open' ? '#00d4aa' : '#e74c3c',
                    }}>
                      <Text style={{
                        color: match.status === 'open' ? '#00d4aa' : '#e74c3c',
                        fontSize: 11,
                        fontWeight: '700',
                      }}>
                        {match.status === 'open' ? 'Open' : 'Vol'}
                      </Text>
                    </View>
                  </View>

                  {/* Locatie */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons name="location-outline" size={13} color="#888" />
                    <Text style={{ color: '#aaa', fontSize: 13 }}>{match.club}</Text>
                  </View>

                  {/* Niveau */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <Ionicons name="bar-chart-outline" size={13} color="#888" />
                    <Text style={{ color: '#aaa', fontSize: 13 }}>
                      Niveau {match.minLevel} - {match.maxLevel}
                    </Text>
                  </View>

                  {/* Tags onderaan */}
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <View style={{ backgroundColor: '#0d2b25', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                      <Text style={{ color: '#00d4aa', fontSize: 12, fontWeight: '600' }}>{match.format}</Text>
                    </View>
                    <View style={{
                      backgroundColor: freePlaces > 0 ? '#1e1e3a' : '#3d1010',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 20,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <Ionicons name="people-outline" size={12} color={freePlaces > 0 ? '#888' : '#e74c3c'} />
                      <Text style={{ color: freePlaces > 0 ? '#888' : '#e74c3c', fontSize: 12 }}>
                        {match.players?.length}/{match.maxPlayers}
                        {freePlaces > 0 ? `  ·  ${freePlaces} vrij` : '  ·  Vol'}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: match.isCompetitive ? '#2d2000' : '#1e1e3a',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 20,
                    }}>
                      <Text style={{ color: match.isCompetitive ? '#f39c12' : '#666', fontSize: 12, fontWeight: '600' }}>
                        {match.isCompetitive ? 'Competitief' : 'Vriendelijk'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}
