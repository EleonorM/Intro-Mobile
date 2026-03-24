// ============================================================
// match/[id].tsx — Wedstrijd detail pagina
// ============================================================
// Dit scherm toont de details van één specifieke wedstrijd.
// De gebruiker kan:
//   - De wedstrijd bekijken (datum, locatie, niveau, ...)
//   - Inschrijven als hij/zij nog niet ingeschreven is
//   - Uitschrijven als hij/zij al ingeschreven is (maar niet de maker)
//   - De wedstrijd verwijderen als hij/zij de maker is
//   - Chatten met andere ingeschreven spelers
// ============================================================

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  // KeyboardAvoidingView zorgt ervoor dat de inhoud omhoog schuift
  // wanneer het toetsenbord opent, zodat de chat zichtbaar blijft.
  KeyboardAvoidingView,
  Platform,    // Platform = weten of het iOS of Android is (gedrag verschilt)
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  collection,
  addDoc,
  orderBy,
  query,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../config/firebase';

// Geeft true als de wedstrijddatum én het uur al voorbij zijn
function isExpired(date: string, time: string): boolean {
  const [day, month, year] = date.split('/').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const matchDate = new Date(year, month - 1, day, hours, minutes);
  return matchDate < new Date();
}
import { Ionicons } from '@expo/vector-icons';

export default function MatchDetail() {
  // useLocalSearchParams haalt de [id] op uit de URL (bv. /match/abc123 → id = "abc123")
  const { id } = useLocalSearchParams();

  // State-variabelen: dit zijn "geheugenplaatsen" in de component.
  // Als ze veranderen, herlaadt React het scherm automatisch.
  const [match, setMatch] = useState<any>(null);       // de wedstrijd data
  const [messages, setMessages] = useState<any[]>([]);  // alle chatberichten
  const [newMessage, setNewMessage] = useState('');     // het bericht dat de gebruiker typt
  const [loading, setLoading] = useState(true);         // is de data al geladen?

  // useRef geeft een "verwijzing" naar een echt DOM-element.
  // Hier gebruiken we het om de ScrollView te kunnen besturen (scrollen).
  const scrollViewRef = useRef<ScrollView>(null);

  // auth.currentUser = de ingelogde gebruiker (of null als niemand ingelogd is)
  const user = auth.currentUser;

  // ── EFFECT: Start luisteraars alleen als de gebruiker ingelogd is ─────────
  // Zo vermijden we "permission-denied" fouten van Firebase wanneer
  // de gebruiker niet (meer) ingelogd is.
  useEffect(() => {
    let unsubscribeMatch: (() => void) | null = null;
    let unsubscribeMessages: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Luister naar de wedstrijd in realtime
        unsubscribeMatch = onSnapshot(doc(db, 'matches', id as string), (docSnap) => {
          if (docSnap.exists()) {
            setMatch({ id: docSnap.id, ...docSnap.data() });
          }
          setLoading(false);
        });

        // Luister naar chatberichten in realtime
        const q = query(
          collection(db, 'matches', id as string, 'messages'),
          orderBy('createdAt', 'asc')
        );
        unsubscribeMessages = onSnapshot(q, (snapshot) => {
          setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        });
      } else {
        // Niet ingelogd: stop luisteraars en ga terug
        unsubscribeMatch?.();
        unsubscribeMessages?.();
        router.replace('/(tabs)/matches');
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMatch?.();
      unsubscribeMessages?.();
    };
  }, [id]);

  // ── FUNCTIE: Inschrijven ─────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!match || !user) return;

    // Controleer of de gebruiker al ingeschreven is
    if (match.players?.includes(user.uid)) {
      Alert.alert('Info', 'Je bent al ingeschreven.');
      return;
    }

    // Controleer of de wedstrijd al vol is
    if (match.players?.length >= match.maxPlayers) {
      Alert.alert('Niet mogelijk', 'Deze wedstrijd is al vol.');
      return;
    }

    // Toon een bevestigingsdialoog voordat de gebruiker betaalt
    Alert.alert(
      'Inschrijven',
      `Wil je deelnemen aan deze wedstrijd?\n\nBetaling gesimuleerd: €5,00`,
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Betalen & Inschrijven',
          onPress: async () => {
            // arrayUnion voegt de uid van de gebruiker toe aan de players-array
            // zonder de andere spelers te verwijderen
            await updateDoc(doc(db, 'matches', id as string), {
              players: arrayUnion(user.uid),
            });
            // Voeg een systeem-bericht toe in de chat zodat anderen weten wie er bijkomt
            await addDoc(collection(db, 'matches', id as string, 'messages'), {
              text: `${user.email} heeft zich ingeschreven.`,
              system: true,
              createdAt: new Date(),
            });
            Alert.alert('Ingeschreven', 'Je bent toegevoegd aan de wedstrijd.');
          },
        },
      ]
    );
  };

  // ── FUNCTIE: Uitschrijven ────────────────────────────────────────────────
  const handleLeave = async () => {
    if (!match || !user) return;

    // De maker van de wedstrijd kan zichzelf niet uitschrijven
    // (hij kan de wedstrijd wel verwijderen met de rode knop)
    if (match.createdBy === user.uid) {
      Alert.alert(
        'Niet mogelijk',
        'Je bent de maker van deze wedstrijd. Je kan uitschrijven door de wedstrijd te verwijderen.'
      );
      return;
    }

    Alert.alert(
      'Uitschrijven',
      'Ben je zeker dat je je wilt uitschrijven? Je verliest je plek.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Uitschrijven',
          style: 'destructive', // op iOS wordt dit rood getoond
          onPress: async () => {
            // arrayRemove verwijdert de uid van de gebruiker uit de players-array
            await updateDoc(doc(db, 'matches', id as string), {
              players: arrayRemove(user.uid),
            });
            // Voeg een systeem-bericht toe in de chat
            await addDoc(collection(db, 'matches', id as string, 'messages'), {
              text: `${user.email} heeft zich uitgeschreven.`,
              system: true,
              createdAt: new Date(),
            });
          },
        },
      ]
    );
  };

  // ── FUNCTIE: Wedstrijd verwijderen (alleen voor de maker) ───────────────
  const handleDelete = async () => {
    if (!match || !user) return;

    Alert.alert(
      'Wedstrijd verwijderen',
      'Ben je zeker? Dit kan niet ongedaan gemaakt worden. Alle inschrijvingen gaan verloren.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            // deleteDoc verwijdert het hele wedstrijddocument uit Firestore
            await deleteDoc(doc(db, 'matches', id as string));
            // Stuur de gebruiker terug naar de wedstrijdenlijst
            router.replace('/(tabs)/matches');
          },
        },
      ]
    );
  };

  // ── FUNCTIE: Bericht versturen ────────────────────────────────────────────
  const handleSendMessage = async () => {
    // trim() verwijdert spaties aan het begin en einde van het bericht
    if (!newMessage.trim() || !user) return;

    await addDoc(collection(db, 'matches', id as string, 'messages'), {
      text: newMessage.trim(),
      userId: user.uid,
      userEmail: user.email,
      system: false,
      createdAt: new Date(),
    });

    // Leeg het invoerveld na het versturen
    setNewMessage('');

    // Scroll naar het nieuwste bericht
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Laadscherm terwijl Firebase de data ophaalt
  if (loading) {
    return <ActivityIndicator color="#00d4aa" style={{ flex: 1, backgroundColor: '#0f0f1e' }} />;
  }

  // Handige variabelen zodat we ze niet steeds opnieuw moeten berekenen
  const isJoined = match?.players?.includes(user?.uid);           // is de gebruiker ingeschreven?
  const isCreator = match?.createdBy === user?.uid;               // is de gebruiker de maker?
  const freePlaces = (match?.maxPlayers ?? 0) - (match?.players?.length ?? 0); // hoeveel vrije plekken?
  const isFull = freePlaces <= 0;                                 // is de wedstrijd vol?
  const isPast = match ? isExpired(match.date, match.time) : false; // is het uur al voorbij?
  const canJoin = !isJoined && !isFull && !isPast;                // mag de gebruiker inschrijven?

  return (
    // KeyboardAvoidingView: wanneer het toetsenbord opent, schuift alles hierboven omhoog.
    // behavior="padding" voegt extra ruimte toe onderaan (werkt het best op iOS).
    // Op Android gebruiken we "height".
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0f0f1e' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // keyboardVerticalOffset: de hoogte van de header die NIET mee mag bewegen.
      // 0 werkt goed omdat onze header deel is van dezelfde View.
      keyboardVerticalOffset={0}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={{
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 20,
        backgroundColor: '#12122a',
        borderBottomWidth: 1,
        borderBottomColor: '#1e1e3a',
      }}>
        {/* Bovenste rij: Terug-knop + evt. verwijder-knop */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={18} color="#00d4aa" />
            <Text style={{ color: '#00d4aa', fontSize: 14 }}>Terug</Text>
          </TouchableOpacity>

          {/* Verwijder-knop: alleen zichtbaar voor de maker van de wedstrijd */}
          {isCreator && (
            <TouchableOpacity
              onPress={handleDelete}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#2d1010',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#e74c3c',
              }}
            >
              <Ionicons name="trash-outline" size={14} color="#e74c3c" />
              <Text style={{ color: '#e74c3c', fontSize: 13, fontWeight: '600' }}>Verwijderen</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Datum & tijd */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Ionicons name="calendar-outline" size={16} color="#00d4aa" />
          <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>
            {match?.date}  {match?.time}
          </Text>
        </View>

        {/* Locatie */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Ionicons name="location-outline" size={14} color="#888" />
          <Text style={{ color: '#aaa', fontSize: 14 }}>{match?.club}</Text>
        </View>

        {/* Info-tags: niveau, formaat, type */}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <View style={{
            backgroundColor: '#1e1e3a',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
            <Ionicons name="bar-chart-outline" size={12} color="#888" />
            <Text style={{ color: '#888', fontSize: 12 }}>{match?.minLevel} - {match?.maxLevel}</Text>
          </View>

          <View style={{ backgroundColor: '#0d2b25', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
            <Text style={{ color: '#00d4aa', fontSize: 12, fontWeight: '600' }}>{match?.format}</Text>
          </View>

          <View style={{
            backgroundColor: match?.isCompetitive ? '#2d2000' : '#1e1e3a',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 20,
          }}>
            <Text style={{ color: match?.isCompetitive ? '#f39c12' : '#666', fontSize: 12, fontWeight: '600' }}>
              {match?.isCompetitive ? 'Competitief' : 'Vriendelijk'}
            </Text>
          </View>
        </View>

        {/* Spelersaantal + actieknoppen */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Aantal spelers */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="people-outline" size={15} color="#888" />
            <Text style={{ color: '#aaa', fontSize: 14 }}>
              {match?.players?.length}/{match?.maxPlayers}
              {freePlaces > 0 ? `  ·  ${freePlaces} vrij` : '  ·  Vol'}
            </Text>
          </View>

          {/* Actieknop: afhankelijk van de situatie tonen we een andere knop */}
          {isPast ? (
            // Wedstrijd is al voorbij
            <View style={{ backgroundColor: '#1e1e3a', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 }}>
              <Text style={{ color: '#555', fontWeight: '700', fontSize: 13 }}>Verlopen</Text>
            </View>
          ) : !isJoined ? (
            // GEVAL 1: Nog niet ingeschreven → toon "Inschrijven" knop (grijs als vol)
            <TouchableOpacity
              onPress={canJoin ? handleJoin : undefined}
              disabled={!canJoin}
              style={{
                backgroundColor: canJoin ? '#00d4aa' : '#1e1e3a',
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: canJoin ? 'white' : '#555', fontWeight: '700', fontSize: 14 }}>
                {isFull ? 'Vol' : 'Inschrijven  €5'}
              </Text>
            </TouchableOpacity>
          ) : isCreator ? (
            // GEVAL 2: Ingeschreven én maker → toon "Jouw wedstrijd" badge
            <View style={{
              backgroundColor: '#003d30',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderWidth: 1,
              borderColor: '#00d4aa',
            }}>
              <Ionicons name="star" size={13} color="#00d4aa" />
              <Text style={{ color: '#00d4aa', fontWeight: '700', fontSize: 13 }}>Jouw wedstrijd</Text>
            </View>
          ) : (
            // GEVAL 3: Ingeschreven maar niet de maker → toon "Uitschrijven" knop
            <TouchableOpacity
              onPress={handleLeave}
              style={{
                backgroundColor: '#2d1010',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderWidth: 1,
                borderColor: '#e74c3c',
              }}
            >
              <Ionicons name="exit-outline" size={14} color="#e74c3c" />
              <Text style={{ color: '#e74c3c', fontWeight: '700', fontSize: 13 }}>Uitschrijven</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── CHAT ─────────────────────────────────────────────────────────── */}
      {/* ScrollView met ref zodat we er programmatisch naartoe kunnen scrollen */}
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
        // onContentSizeChange wordt aangeroepen wanneer de inhoud verandert (nieuw bericht).
        // We scrollen dan automatisch naar het einde.
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {/* Scheidingslijn boven de chat */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#1e1e3a' }} />
          <Text style={{ color: '#444', fontSize: 12 }}>Chat</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#1e1e3a' }} />
        </View>

        {/* Geen berichten? Toon lege staat */}
        {messages.length === 0 && (
          <Text style={{ color: '#333', textAlign: 'center', fontSize: 13, marginTop: 20 }}>
            Nog geen berichten. Schrijf je in om te chatten!
          </Text>
        )}

        {/* Loop over alle berichten en toon ze */}
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={{
              marginBottom: 10,
              // Systeem-berichten staan gecentreerd, eigen berichten rechts, anderen links
              alignItems: msg.system ? 'center' : msg.userId === user?.uid ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.system ? (
              // Systeem-bericht (bv. "X heeft zich ingeschreven")
              <Text style={{ color: '#444', fontSize: 12, fontStyle: 'italic' }}>{msg.text}</Text>
            ) : (
              <View>
                {/* E-mail van de afzender, alleen zichtbaar voor andermans berichten */}
                {msg.userId !== user?.uid && (
                  <Text style={{ color: '#666', fontSize: 11, marginBottom: 3, marginLeft: 4 }}>
                    {msg.userEmail}
                  </Text>
                )}
                {/* De berichtballon zelf */}
                <View style={{
                  backgroundColor: msg.userId === user?.uid ? '#00d4aa' : '#1a1a2e',
                  padding: 12,
                  borderRadius: 14,
                  maxWidth: '80%',
                  borderWidth: msg.userId === user?.uid ? 0 : 1,
                  borderColor: '#1e1e3a',
                }}>
                  <Text style={{ color: 'white', fontSize: 14 }}>{msg.text}</Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* ── BERICHTINVOER ────────────────────────────────────────────────── */}
      {isJoined ? (
        // Alleen zichtbaar als de gebruiker ingeschreven is
        <View style={{
          flexDirection: 'row',
          padding: 12,
          gap: 10,
          backgroundColor: '#12122a',
          borderTopWidth: 1,
          borderTopColor: '#1e1e3a',
        }}>
          <TextInput
            placeholder="Stuur een bericht..."
            placeholderTextColor="#444"
            value={newMessage}
            onChangeText={setNewMessage}
            style={{
              flex: 1,
              backgroundColor: '#1a1a2e',
              color: 'white',
              padding: 12,
              borderRadius: 12,
              fontSize: 14,
              borderWidth: 1,
              borderColor: '#1e1e3a',
            }}
            onSubmitEditing={handleSendMessage} // verstuur bij "Enter" op toetsenbord
            returnKeyType="send"                 // toont "Verstuur" op het toetsenbord
            blurOnSubmit={false}                 // toetsenbord blijft open na versturen
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            style={{
              backgroundColor: '#00d4aa',
              width: 44,
              height: 44,
              borderRadius: 12,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      ) : (
        // Niet ingeschreven → toon een melding
        <View style={{
          padding: 14,
          backgroundColor: '#12122a',
          borderTopWidth: 1,
          borderTopColor: '#1e1e3a',
          alignItems: 'center',
        }}>
          <Text style={{ color: '#444', fontSize: 13 }}>Schrijf je in om te chatten</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
