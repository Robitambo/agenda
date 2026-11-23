import 'react-native-url-polyfill/auto';

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Calendar } from 'react-native-calendars';
import { createClient, type Session } from '@supabase/supabase-js';

// Inserisci qui i tuoi valori Supabase già usati nell'app.
const SUPABASE_URL = 'https://zhgfsvsihuukmvpufnjh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ynzgm4OKyVsAUstWu-MtYw__EzJE-x4';

const configured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('INCOLLA_QUI') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes('INCOLLA_QUI');

const storage = {
  getItem: async (key: string): Promise<string | null> =>
    Platform.OS === 'web'
      ? localStorage.getItem(key)
      : SecureStore.getItemAsync(key),

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

type Task = {
  id: string;
  user_id: string;
  title: string;
  starts_at: string;
  is_done: boolean;
  completed_at: string | null;
  created_at: string;
};

type TabName = 'Calendar' | 'To Do' | 'History';

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function taskDateKey(iso: string) {
  return dateKey(new Date(iso));
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeOptions() {
  return Array.from({ length: 48 }, (_, index) => {
    const hour = String(Math.floor(index / 2)).padStart(2, '0');
    const minute = index % 2 === 0 ? '00' : '30';
    return `${hour}:${minute}`;
  });
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (active) {
        setSession(newSession);
        setCheckingSession(false);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error(error.message);
      setSession(data.session);
      setCheckingSession(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!configured || !supabase) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>Configura Supabase</Text>
          <Text style={styles.muted}>
            Inserisci l’URL e la chiave anon/public del tuo progetto nelle due
            costanti all’inizio di App.tsx.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#A78BFA" />
      </SafeAreaView>
    );
  }

  if (!session) return <AuthScreen />;

  return <TasksApp session={session} />;
}

function AuthScreen() {
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!supabase) return;

    if (!email.trim() || !password) {
      Alert.alert('Dati mancanti', 'Inserisci email e password.');
      return;
    }

    setLoading(true);

    try {
      const result = registering
        ? await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
          })
        : await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });

      if (result.error) {
        Alert.alert('Errore', result.error.message);
      } else if (registering && !result.data.session) {
        Alert.alert(
          'Conferma email',
          'Controlla la tua email e conferma l’account prima di accedere.'
        );
      }
    } catch (error) {
      Alert.alert('Errore', String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.authCard}>
        <Text style={styles.eyebrow}>IL TUO SPAZIO</Text>
        <Text style={styles.title}>{registering ? 'Registrati' : 'Accedi'}</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9298B0"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9298B0"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Pressable
          style={styles.primaryButton}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {registering ? 'Crea account' : 'Accedi'}
            </Text>
          )}
        </Pressable>
        <Pressable onPress={() => setRegistering(!registering)}>
          <Text style={styles.link}>
            {registering
              ? 'Hai già un account? Accedi'
              : 'Non hai un account? Registrati'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TasksApp({ session }: { session: Session }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<TabName>('Calendar');
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadTasks() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', session.user.id)
      .order('starts_at', { ascending: true });

    if (error) {
      Alert.alert('Errore caricamento', error.message);
    } else {
      setTasks((data ?? []) as Task[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!supabase) return;

    loadTasks();

    const channel = supabase
      .channel(`tasks-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          loadTasks();
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [session.user.id]);

  const tasksForSelectedDate = useMemo(
    () => tasks.filter((task) => taskDateKey(task.starts_at) === selectedDate),
    [tasks, selectedDate]
  );

  const todoTasks = tasks.filter((task) => !task.is_done);
  const historyTasks = tasks;

  async function createTask() {
    if (!supabase) return;

    const title = newTitle.trim();
    if (!title) {
      Alert.alert('Titolo mancante', 'Scrivi il titolo dell’evento.');
      return;
    }

    const [year, month, day] = selectedDate.split('-').map(Number);
    const [hour, minute] = newTime.split(':').map(Number);
    const startsAt = new Date(year, month - 1, day, hour, minute).toISOString();

    setSaving(true);

    const { error } = await supabase.from('tasks').insert({
      user_id: session.user.id,
      title,
      starts_at: startsAt,
      is_done: false,
      completed_at: null,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Errore', error.message);
      return;
    }

    setNewTitle('');
    setNewTime('09:00');
    setShowCreate(false);
    await loadTasks();

    // Facoltativo: deve corrispondere al nome della tua Edge Function.
    // Per attivare WhatsApp, verifica il nome della funzione e sostituiscilo qui.
    try {
      await supabase.functions.invoke('whatsapp-notification', {
        body: {
          title,
          starts_at: startsAt,
          user_id: session.user.id,
        },
      });
    } catch (error) {
      console.warn('Notifica WhatsApp non inviata:', error);
    }
  }

  async function toggleTask(task: Task) {
    if (!supabase) return;

    const isDone = !task.is_done;
    const { error } = await supabase
      .from('tasks')
      .update({
        is_done: isDone,
        completed_at: isDone ? new Date().toISOString() : null,
      })
      .eq('id', task.id)
      .eq('user_id', session.user.id);

    if (error) {
      Alert.alert('Errore', error.message);
    } else {
      await loadTasks();
    }
  }

  async function deleteTask(task: Task) {
    if (!supabase) return;

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Vuoi eliminare "${task.title}"?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Elimina evento', `Eliminare "${task.title}"?`, [
              { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
              {
                text: 'Elimina',
                style: 'destructive',
                onPress: () => resolve(true),
              },
            ]);
          });

    if (!confirmed) return;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id)
      .eq('user_id', session.user.id);

    if (error) {
      Alert.alert('Errore', error.message);
    } else {
      await loadTasks();
    }
  }

  const calendarTasksByDate = useMemo(() => {
    const result: Record<string, Task[]> = {};
    for (const task of tasks) {
      const key = taskDateKey(task.starts_at);
      result[key] = result[key] ?? [];
      result[key].push(task);
    }
    return result;
  }, [tasks]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.eyebrow}>IL TUO SPAZIO</Text>
          <Text style={styles.headerTitle}>Pianifica</Text>
        </View>
        <Pressable
          style={styles.signOutButton}
          onPress={async () => {
            const { error } = await supabase!.auth.signOut();
            if (error) Alert.alert('Errore', error.message);
          }}
        >
          <Text style={styles.signOutText}>Esci</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['Calendar', 'To Do', 'History'] as TabName[]).map((name) => (
          <Pressable
            key={name}
            onPress={() => setTab(name)}
            style={[styles.tab, tab === name && styles.activeTab]}
          >
            <Text style={[styles.tabText, tab === name && styles.activeTabText]}>
              {name}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#A78BFA" />
        </View>
      ) : tab === 'Calendar' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Calendar
            onDayPress={(day) => setSelectedDate(day.dateString)}
            dayComponent={({ date }: any) => {
              if (!date) return <View style={styles.dayCell} />;

              const dayTasks = calendarTasksByDate[date.dateString] ?? [];
              const selected = selectedDate === date.dateString;

              return (
                <Pressable
                  style={[styles.dayCell, selected && styles.selectedDay]}
                  onPress={() => setSelectedDate(date.dateString)}
                >
                  <Text style={[styles.dayNumber, selected && styles.selectedDayNumber]}>
                    {date.day}
                  </Text>
                  {dayTasks.slice(0, 2).map((task) => (
                    <Text
                      key={task.id}
                      numberOfLines={1}
                      style={styles.calendarEventTitle}
                    >
                      {task.title}
                    </Text>
                  ))}
                  {dayTasks.length > 2 && (
                    <Text style={styles.moreEvents}>+{dayTasks.length - 2}</Text>
                  )}
                </Pressable>
              );
            }}
            theme={{
              calendarBackground: '#171B31',
              monthTextColor: '#FFFFFF',
              dayTextColor: '#FFFFFF',
              textDisabledColor: '#555B72',
              arrowColor: '#A78BFA',
              textMonthFontWeight: '700',
              textDayHeaderFontWeight: '700',
              textSectionTitleColor: '#AEB3C7',
            }}
            style={styles.calendar}
          />

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Eventi del giorno</Text>
              <Text style={styles.muted}>{selectedDate}</Text>
            </View>
            <Pressable
              style={styles.smallPrimaryButton}
              onPress={() => setShowCreate(true)}
            >
              <Text style={styles.buttonText}>+ Aggiungi</Text>
            </Pressable>
          </View>

          {tasksForSelectedDate.length === 0 ? (
            <Text style={styles.emptyText}>Nessun evento per questa data.</Text>
          ) : (
            tasksForSelectedDate.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task)}
                onDelete={() => deleteTask(task)}
              />
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>
            {tab === 'To Do' ? 'Attività da completare' : 'Tutte le attività'}
          </Text>
          <Text style={styles.muted}>
            {tab === 'To Do'
              ? `${todoTasks.length} incomplete`
              : `${historyTasks.length} totali`}
          </Text>

          {(tab === 'To Do' ? todoTasks : historyTasks).length === 0 ? (
            <Text style={styles.emptyText}>Nessuna attività da mostrare.</Text>
          ) : (
            (tab === 'To Do' ? todoTasks : historyTasks).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task)}
                onDelete={() => deleteTask(task)}
              />
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Nuovo evento</Text>
            <Text style={styles.muted}>Data: {selectedDate}</Text>

            <TextInput
              style={styles.input}
              placeholder="Titolo dell’evento"
              placeholderTextColor="#9298B0"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Pressable
              style={styles.timeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.text}>Orario: {newTime}</Text>
              <Text style={styles.link}>Scegli orario ▾</Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setShowCreate(false)}
              >
                <Text style={styles.text}>Annulla</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={createTask}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Salva evento</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTimePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.timePickerCard}>
            <Text style={styles.sectionTitle}>Seleziona l’orario</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {timeOptions().map((time) => (
                <Pressable
                  key={time}
                  style={[
                    styles.timeOption,
                    newTime === time && styles.timeOptionSelected,
                  ]}
                  onPress={() => {
                    setNewTime(time);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.text}>{time}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={styles.cancelButton}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.text}>Chiudi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.taskRow}>
      <Pressable style={styles.taskMain} onPress={onToggle}>
        <View style={[styles.check, task.is_done && styles.checked]}>
          {task.is_done && <Text style={styles.checkMark}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.taskTitle, task.is_done && styles.doneTitle]}>
            {task.title}
          </Text>
          <Text style={styles.muted}>
            {taskDateKey(task.starts_at)} · {formatTime(task.starts_at)}
            {task.is_done ? ' · Completata' : ''}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onDelete} style={styles.deleteButton}>
        <Text style={styles.deleteText}>Elimina</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#101326',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101326',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  authCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 24,
  },
  eyebrow: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 18,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  muted: {
    color: '#AEB3C7',
    fontSize: 13,
    marginBottom: 12,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  input: {
    color: '#FFFFFF',
    backgroundColor: '#20243D',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginVertical: 8,
  },
  primaryButton: {
    minHeight: 50,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7857FF',
    borderRadius: 12,
  },
  smallPrimaryButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7857FF',
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  link: {
    color: '#C4B5FD',
    textAlign: 'center',
    marginTop: 16,
  },
  appHeader: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#555B78',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  signOutText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 4,
    backgroundColor: '#20243D',
    borderRadius: 13,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#7857FF',
  },
  tabText: {
    color: '#B9BDD0',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  calendar: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#171B31',
    paddingBottom: 8,
  },
  dayCell: {
    width: 44,
    minHeight: 68,
    alignItems: 'center',
    paddingTop: 5,
    borderRadius: 8,
  },
  selectedDay: {
    backgroundColor: '#7857FF',
  },
  dayNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  selectedDayNumber: {
    fontWeight: '800',
  },
  calendarEventTitle: {
    width: 42,
    color: '#D8CCFF',
    fontSize: 7,
    textAlign: 'center',
  },
  moreEvents: {
    color: '#FFFFFF',
    fontSize: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    color: '#AEB3C7',
    textAlign: 'center',
    paddingVertical: 28,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20243D',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  taskMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  check: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#858BA5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: '#7857FF',
    borderColor: '#7857FF',
  },
  checkMark: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  taskTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 5,
  },
  doneTitle: {
    textDecorationLine: 'line-through',
    color: '#AEB3C7',
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  deleteText: {
    color: '#FF8B9A',
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#171B31',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#555B78',
    marginTop: 10,
  },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#20243D',
    borderRadius: 12,
    padding: 15,
    marginTop: 8,
  },
  timePickerCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#171B31',
  },
  timeOption: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#303550',
  },
  timeOptionSelected: {
    backgroundColor: '#34305B',
    borderRadius: 8,
  },
});
