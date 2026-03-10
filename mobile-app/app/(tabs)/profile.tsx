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
import { signOut, onAuthStateChanged } from 'firebase/auth';  // onAuthStateChanged = luisteraar voor login-status
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const [myMatches, setMyMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // useRef om de huidige ingelogde gebruiker bij te houden.
  // We gebruiken hier geen useState voor de user, want we willen
  // de user-waarde ook kunnen lezen in cleanup-functies zonder
  // dat React opnieuw rendert.
  const [currentUser, setCurrentUser] = useState<any>(null);

  // unsubscribeRef = een verwijzing naar de "stop-functie" van onSnapshot.
  // We bewaren hem in een ref zodat we hem later (bij uitloggen) kunnen oproepen.
  // Als we hem niet stoppen, blijft Firebase data proberen op te halen
  // ook als de gebruiker al uitgelogd is → "permission-denied" error.
  const unsubscribeMatchesRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // onAuthStateChanged luistert naar veranderingen in de login-status.
    // - user != null → iemand is ingelogd
    // - user == null → niemand ingelogd (ook na uitloggen)
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (user) {
        // Gebruiker is ingelogd: start de Firestore luisteraar
        const q = query(
          collection(db, 'matches'),
          where('createdBy', '==', user.uid)
          // Geen orderBy om een Firestore composite index te vermijden.
          // We sorteren zelf hieronder (client-side).
        );

        // Sla de stop-functie op in de ref zodat we hem later kunnen oproepen
        unsubscribeMatchesRef.current = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a: any, b: any) => {
              // toMillis() zet een Firestore Timestamp om naar milliseconden (getal)
              // zodat we kunnen vergelijken welke groter (= nieuwer) is
              const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
              const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
              return bTime - aTime; // nieuwste eerst
            });
          setMyMatches(data);
          setLoading(false);
        });
      } else {
        // Gebruiker is uitgelogd: stop de Firestore luisteraar onmiddellijk
        // zodat Firebase geen "permission-denied" gooit
        if (unsubscribeMatchesRef.current) {
          unsubscribeMatchesRef.current(); // roept de stop-functie aan
          unsubscribeMatchesRef.current = null;
        }
        setMyMatches([]);
        setLoading(false);
      }
    });

    // Wanneer de component van het scherm verdwijnt, stoppen we BEIDE luisteraars:
    // 1. de auth-luisteraar
    // 2. de Firestore-luisteraar (als die nog actief is)
    return () => {
      unsubscribeAuth();
      if (unsubscribeMatchesRef.current) {
        unsubscribeMatchesRef.current();
        unsubscribeMatchesRef.current = null;
      }
    };
  }, []); // lege array [] = dit effect loopt alleen bij het eerste laden van de component

  const handleLogout = async () => {
    // Stop de Firestore luisteraar EERST, dan pas uitloggen.
    // Volgorde is belangrijk: als we eerst uitloggen, trekt Firebase
    // de rechten in terwijl onSnapshot nog actief is → permission-denied.
    if (unsubscribeMatchesRef.current) {
      unsubscribeMatchesRef.current();
      unsubscribeMatchesRef.current = null;
    }
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
              <Text style={{ color: '#00d4aa', fontSize: 13, fontWeight: '600' }}>Niveau 1.5</Text>
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
