// ============================================================
// profile.tsx — Profiel pagina
// ============================================================
// Dit scherm toont de profielinfo van de ingelogde gebruiker
// en een lijst van wedstrijden die hij/zij zelf heeft aangemaakt.
//
// BELANGRIJK — waarom onAuthStateChanged?
// -----------------------------------------
// auth.currentUser is een "momentopname": het geeft de gebruiker
// op het moment dat de component laadt. Maar als de gebruiker
// uitlogt, weet auth.currentUser dat NIET automatisch.
// onAuthStateChanged is een luisteraar die Firebase zelf roept
// elke keer dat de login-status verandert (in → uit of uit → in).
// Zo kunnen we de Firestore-luisteraar correct stoppen vóórdat
// Firebase de rechten intrekt → geen "permission-denied" error.
// ============================================================

import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userLevel, setUserLevel] = useState<number>(1.5);
  const [myMatches, setMyMatches] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stop-functies voor de Firestore luisteraars bewaren we in refs,
  // zodat we ze kunnen aanroepen bij uitloggen (anders: permission-denied).
  const unsubscribeMatchesRef = useRef<(() => void) | null>(null);
  const unsubscribeBookingsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Haal het niveau op. Als het document niet bestaat, maak het aan met 1.5.
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserLevel(userSnap.data().level ?? 1.5);
        } else {
          await setDoc(userRef, { level: 1.5 }, { merge: true });
          setUserLevel(1.5);
        }

        // Luister naar wedstrijden van deze gebruiker
        const matchQuery = query(
          collection(db, 'matches'),
          where('createdBy', '==', user.uid)
        );
        unsubscribeMatchesRef.current = onSnapshot(matchQuery, (snapshot) => {
          const data = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a: any, b: any) => {
              const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
              const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
              return bTime - aTime;
            });
          setMyMatches(data);
          setLoading(false);
        });

        // Luister naar veld-boekingen van deze gebruiker
        const bookingQuery = query(
          collection(db, 'bookings'),
          where('userId', '==', user.uid)
        );
        unsubscribeBookingsRef.current = onSnapshot(bookingQuery, (snapshot) => {
          const data = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a: any, b: any) => {
              const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
              const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
              return bTime - aTime;
            });
          setMyBookings(data);
        });
      } else {
        // Uitgelogd: stop beide luisteraars
        unsubscribeMatchesRef.current?.();
        unsubscribeMatchesRef.current = null;
        unsubscribeBookingsRef.current?.();
        unsubscribeBookingsRef.current = null;
        setMyMatches([]);
        setMyBookings([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMatchesRef.current?.();
      unsubscribeBookingsRef.current?.();
    };
  }, []);

  const handleLogout = async () => {
    // Stop luisteraars EERST, dan uitloggen (anders: permission-denied)
    unsubscribeMatchesRef.current?.();
    unsubscribeMatchesRef.current = null;
    unsubscribeBookingsRef.current?.();
    unsubscribeBookingsRef.current = null;
    await signOut(auth);
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f1e' }}>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24, backgroundColor: '#12122a' }}>
        <Text style={{ color: 'white', fontSize: 26, fontWeight: '700', letterSpacing: 0.3 }}>
          Profiel
        </Text>

        {/* Avatar + gebruikersinfo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 16 }}>
          <View style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: '#1a1a2e',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#00d4aa',
          }}>
            <Ionicons name="person" size={28} color="#00d4aa" />
          </View>
          <View>
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
              {currentUser?.email ?? 'Onbekend'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Ionicons name="bar-chart-outline" size={13} color="#00d4aa" />
              <Text style={{ color: '#00d4aa', fontSize: 13, fontWeight: '600' }}>Niveau {userLevel.toFixed(1)}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {/* ── MIJN WEDSTRIJDEN ───────────────────────────────────── */}
        <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
          Mijn wedstrijden
        </Text>

        {loading ? (
          <ActivityIndicator color="#00d4aa" style={{ marginTop: 20 }} />
        ) : myMatches.length === 0 ? (
          <View style={{
            backgroundColor: '#1a1a2e',
            borderRadius: 14,
            padding: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#1e1e3a',
          }}>
            <Ionicons name="tennisball-outline" size={36} color="#333" />
            <Text style={{ color: '#555', marginTop: 12, fontSize: 14 }}>
              Je hebt nog geen wedstrijden aangemaakt
            </Text>
          </View>
        ) : (
          // Map = loop over elk wedstrijdobject en maak er een kaartje van
          myMatches.map((match) => (
            <TouchableOpacity
              key={match.id}  // key = unieke sleutel zodat React weet welke kaart welke is
              onPress={() => router.push(`/match/${match.id}`)}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#1a1a2e',
                borderRadius: 14,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#1e1e3a',
              }}
            >
              {/* Datum + status badge */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calendar-outline" size={13} color="#00d4aa" />
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                    {match.date}  {match.time}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: match.status === 'open' ? '#003d30' : '#3d1010',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: match.status === 'open' ? '#00d4aa' : '#e74c3c',
                }}>
                  <Text style={{ color: match.status === 'open' ? '#00d4aa' : '#e74c3c', fontSize: 11, fontWeight: '700' }}>
                    {match.status === 'open' ? 'Open' : 'Vol'}
                  </Text>
                </View>
              </View>

              {/* Club */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <Ionicons name="location-outline" size={12} color="#666" />
                <Text style={{ color: '#888', fontSize: 13 }}>{match.club}</Text>
              </View>

              {/* Formaat + spelers */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ backgroundColor: '#0d2b25', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ color: '#00d4aa', fontSize: 11, fontWeight: '600' }}>{match.format}</Text>
                </View>
                <View style={{ backgroundColor: '#1e1e3a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="people-outline" size={11} color="#888" />
                  <Text style={{ color: '#888', fontSize: 11 }}>
                    {match.players?.length}/{match.maxPlayers}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* ── MIJN BOEKINGEN ─────────────────────────────────────── */}
        <View style={{ marginTop: 32 }}>
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
            Mijn veld-boekingen
          </Text>

          {myBookings.length === 0 ? (
            <View style={{
              backgroundColor: '#1a1a2e',
              borderRadius: 14,
              padding: 24,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#1e1e3a',
            }}>
              <Ionicons name="calendar-outline" size={36} color="#333" />
              <Text style={{ color: '#555', marginTop: 12, fontSize: 14 }}>
                Je hebt nog geen velden geboekt
              </Text>
            </View>
          ) : (
            myBookings.map((booking) => (
              <View
                key={booking.id}
                style={{
                  backgroundColor: '#1a1a2e',
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#1e1e3a',
                }}
              >
                {/* Datum + tijd */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name="calendar-outline" size={13} color="#00d4aa" />
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                    {booking.date}  {booking.time}
                  </Text>
                </View>

                {/* Club */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <Ionicons name="location-outline" size={12} color="#666" />
                  <Text style={{ color: '#888', fontSize: 13 }}>{booking.clubName}</Text>
                </View>

                {/* Bedrag */}
                <View style={{ backgroundColor: '#0d2b25', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' }}>
                  <Text style={{ color: '#00d4aa', fontSize: 11, fontWeight: '600' }}>€15,00 betaald</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── ACCOUNT / UITLOGGEN ────────────────────────────────── */}
        <View style={{ marginTop: 32 }}>
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
            Account
          </Text>
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              backgroundColor: '#1a1a2e',
              padding: 16,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 1,
              borderColor: '#2d1010',
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#e74c3c" />
            <Text style={{ color: '#e74c3c', fontWeight: '600', fontSize: 15 }}>Uitloggen</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
