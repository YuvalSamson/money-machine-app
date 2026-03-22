import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Linking, useColorScheme, FlatList, Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePushNotifications, JobData } from '../hooks/usePushNotifications';
import { createClient } from '@supabase/supabase-js';

// ─── Supabase ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://ykfyfryditqxginwwhwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wqXEhvk22tZLDT-e5ryJBA_pL4jPd0N';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Server ───────────────────────────────────────────────────────────────────

const FLASK_SERVER = 'https://evan-uncaramelised-paulina.ngrok-free.dev';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BidRecord {
  id: string;
  title: string;
  link: string;
  score: number;
  reason: string;
  budget: string;
  timeline: string;
  description: string;
  bid_text: string;
  status: string;
  created_at: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending:     '⏳ Bid Pending',
  negotiating: '💬 Negotiating',
  working:     '🔨 In Progress',
  rejected:    '❌ Not Selected',
  expired:     '⌛ Bid Expired',
  closed:      '🚫 Project Closed',
  delivered:   '✅ Delivered',
};

const STATUS_COLORS: Record<string, string> = {
  pending:     '#FFD700',
  negotiating: '#00BFFF',
  working:     '#00FF88',
  rejected:    '#FF4444',
  expired:     '#888888',
  closed:      '#888888',
  delivered:   '#00FF88',
};

// ─── Theme ────────────────────────────────────────────────────────────────────

const DARK = {
  bg: '#0A0A0A', card: '#111111', border: '#1E1E1E', text: '#F5F5F5',
  subtext: '#CCCCCC', muted: '#666666', placeholder: '#555555',
  inputBg: '#111111', chipBorder: '#2A2A2A', chipText: '#777777',
  rejectBg: '#1A0A0A', rejectBorder: '#3A1A1A', rejectText: '#CC3333',
  headerText: '#888888', reasonLabel: '#444444',
  userBubble: '#1A2A1A', userBubbleBorder: '#2A3A2A',
};

const LIGHT = {
  bg: '#F8F8F6', card: '#FFFFFF', border: '#E5E5E5', text: '#111111',
  subtext: '#333333', muted: '#999999', placeholder: '#AAAAAA',
  inputBg: '#FFFFFF', chipBorder: '#DDDDDD', chipText: '#888888',
  rejectBg: '#FFF5F5', rejectBorder: '#FFCCCC', rejectText: '#CC3333',
  headerText: '#999999', reasonLabel: '#AAAAAA',
  userBubble: '#E8F5EE', userBubbleBorder: '#C8E6D4',
};

const GREEN = '#00C96B';

// ─── Claude API ───────────────────────────────────────────────────────────────

async function askClaude(messages: ChatMessage[], job: JobData): Promise<string> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.EXPO_PUBLIC_ANTHROPIC_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: `You are a freelance advisor helping evaluate this job:\n\nTitle: ${job.title}\nDescription: ${job.description}\nBudget: ${job.budget}\nScore: ${job.score}/10\nReason: ${job.reason}\n\nAnswer concisely and practically.`,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || 'No response.';
  } catch {
    return 'Error reaching Claude.';
  }
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const ringColor = score >= 8 ? GREEN : score >= 6 ? '#FFD700' : '#FF4444';
  return (
    <View style={[styles.scoreRing, { borderColor: ringColor, shadowColor: ringColor }]}>
      <Text style={[styles.scoreNumber, { color: ringColor }]}>{score}</Text>
      <Text style={styles.scoreLabel}>/10</Text>
    </View>
  );
}

// ─── Job Screen ───────────────────────────────────────────────────────────────

function JobScreen({ job, theme, onApprove, onReject }: {
  job: JobData;
  theme: typeof DARK;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    const reply = await askClaude(newMessages, job);
    setMessages([...newMessages, { role: 'assistant', content: reply }]);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.flex}>
        {/* Header */}
        <View style={[styles.jobHeader, { borderBottomColor: theme.border }]}>
          <View style={styles.headerBadgeRow}>
            <View style={[styles.headerBadge, { backgroundColor: GREEN }]}>
              <Text style={styles.headerBadgeText}>NEW JOB</Text>
            </View>
            <Text style={[styles.headerLabel, { color: theme.headerText }]}>💰 MONEYMACHINE</Text>
          </View>
          <Text style={[styles.jobTitle, { color: theme.text }]} numberOfLines={2}>{job.title}</Text>
          <View style={styles.jobMeta}>
            <ScoreRing score={job.score} />
            <View style={styles.flex}>
              <Text style={[styles.reasonLabel, { color: theme.reasonLabel }]}>AI VERDICT</Text>
              <Text style={[styles.reasonText, { color: theme.subtext }]}>{job.reason}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailKey, { color: theme.muted }]}>💵 {job.budget || 'N/A'}</Text>
            <Text style={[styles.detailKey, { color: theme.muted }]}>⏱ {job.timeline || 'N/A'}</Text>
            <TouchableOpacity onPress={() => Linking.openURL(job.link)}>
              <Text style={[styles.jobLink, { color: GREEN }]}>View →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Chat */}
        <ScrollView style={styles.flex} contentContainerStyle={styles.chatContainer} keyboardShouldPersistTaps="handled">
          {messages.length === 0 && (
            <View style={[styles.chatPrompts, { marginTop: 'auto' }]}>
              {['What should I bid?', 'Any red flags?', 'How long will this take?'].map((q) => (
                <TouchableOpacity key={q} style={[styles.promptChip, { borderColor: theme.chipBorder }]} onPress={() => setInput(q)}>
                  <Text style={[styles.promptChipText, { color: theme.chipText }]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {messages.map((msg, i) => (
            <View key={i} style={[
              styles.bubble,
              msg.role === 'user'
                ? { backgroundColor: theme.userBubble, borderColor: theme.userBubbleBorder, alignSelf: 'flex-end' }
                : { backgroundColor: theme.card, borderColor: theme.border, alignSelf: 'flex-start' }
            ]}>
              <Text style={[styles.bubbleText, { color: msg.role === 'user' ? GREEN : theme.subtext }]}>{msg.content}</Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.bubble, { backgroundColor: theme.card, borderColor: theme.border, alignSelf: 'flex-start' }]}>
              <ActivityIndicator size="small" color={GREEN} />
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputRow, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything about this job..."
            placeholderTextColor={theme.placeholder}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: GREEN }]} onPress={sendMessage} disabled={loading}>
            <Text style={styles.sendBtnText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={[styles.actionRow, { backgroundColor: theme.bg, paddingBottom: 20 }]}>
          <TouchableOpacity style={[styles.rejectBtn, { backgroundColor: theme.rejectBg, borderColor: theme.rejectBorder }]} onPress={onReject}>
            <Text style={[styles.rejectBtnText, { color: theme.rejectText }]}>✕  SKIP</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove}>
            <Text style={styles.approveBtnText}>✓  BID NOW</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

function HomeScreen({ theme, onJobSelect }: { theme: typeof DARK; onJobSelect: (bid: BidRecord) => void }) {
  const [bids, setBids] = useState<BidRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBids = useCallback(async () => {
    const { data } = await supabase.from('moneymachine.bids').select('*').order('created_at', { ascending: false });
    if (data) setBids(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBids(); }, []);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]}>
      <View style={[styles.homeHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.homeTitle, { color: theme.text }]}>💰 moneyMachine</Text>
        <TouchableOpacity onPress={fetchBids}>
          <Text style={{ color: GREEN, fontSize: 13 }}>Refresh</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} />
      ) : bids.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.muted }]}>אין פרויקטים עדיין</Text>
          <Text style={[styles.emptySubtext, { color: theme.muted }]}>n8n ישלח נוטיפיקציה כשיימצא ג'וב מתאים</Text>
        </View>
      ) : (
        <FlatList
          data={bids}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.bidCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => onJobSelect(item)}
            >
              <View style={styles.bidCardHeader}>
                <Text style={[styles.bidCardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.bidCardScore, { color: GREEN }]}>{item.score}/10</Text>
              </View>
              <View style={styles.bidCardFooter}>
                <Text style={[styles.bidCardBudget, { color: theme.muted }]}>{item.budget}</Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '22', borderColor: STATUS_COLORS[item.status] }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{STATUS_LABELS[item.status] || item.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Bid Detail Modal ─────────────────────────────────────────────────────────

function BidDetailModal({ bid, theme, onClose }: { bid: BidRecord; theme: typeof DARK; onClose: () => void }) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={{ color: GREEN, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>{bid.title}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[bid.status] + '22', borderColor: STATUS_COLORS[bid.status], alignSelf: 'flex-start', marginBottom: 16 }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[bid.status] }]}>{STATUS_LABELS[bid.status] || bid.status}</Text>
          </View>
          <View style={[styles.detailSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionLabel, { color: theme.muted }]}>DETAILS</Text>
            <Text style={[styles.sectionValue, { color: theme.subtext }]}>💵 {bid.budget}</Text>
            <Text style={[styles.sectionValue, { color: theme.subtext }]}>⏱ {bid.timeline}</Text>
            <Text style={[styles.sectionValue, { color: GREEN }]}>Score: {bid.score}/10</Text>
          </View>
          <View style={[styles.detailSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionLabel, { color: theme.muted }]}>AI VERDICT</Text>
            <Text style={[styles.sectionBody, { color: theme.subtext }]}>{bid.reason}</Text>
          </View>
          <View style={[styles.detailSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionLabel, { color: theme.muted }]}>DESCRIPTION</Text>
            <Text style={[styles.sectionBody, { color: theme.subtext }]}>{bid.description}</Text>
          </View>
          {bid.bid_text ? (
            <View style={[styles.detailSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionLabel, { color: theme.muted }]}>BID TEXT</Text>
              <Text style={[styles.sectionBody, { color: theme.subtext }]}>{bid.bid_text}</Text>
            </View>
          ) : null}
          <TouchableOpacity onPress={() => Linking.openURL(bid.link)} style={[styles.viewBtn, { borderColor: GREEN }]}>
            <Text style={{ color: GREEN, fontWeight: '700' }}>View on Freelancer →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DARK : LIGHT;
  const { pendingJob } = usePushNotifications();

  const [screen, setScreen] = useState<'home' | 'job' | 'done'>('home');
  const [currentJob, setCurrentJob] = useState<JobData | null>(null);
  const [selectedBid, setSelectedBid] = useState<BidRecord | null>(null);
  const [refreshHome, setRefreshHome] = useState(0);

  useEffect(() => {
    if (pendingJob) {
      setCurrentJob(pendingJob);
      setScreen('job');
    }
  }, [pendingJob]);

  const handleApprove = async () => {
    if (!currentJob) return;
    setScreen('done');
    try {
      const res = await fetch(`${FLASK_SERVER}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ link: currentJob.link, action: 'approve', job: currentJob }),
      });
      const data = await res.json();
      // שמור ב-Supabase
      await supabase.from('moneymachine.bids').insert({
        title: currentJob.title,
        link: currentJob.link,
        score: currentJob.score,
        reason: currentJob.reason,
        budget: currentJob.budget || '',
        timeline: currentJob.timeline || '',
        description: currentJob.description || '',
        bid_text: data.bid_text || '',
        status: 'pending',
      });
    } catch (e) {
      console.log('Approve error:', e);
    }
  };

  const handleReject = () => {
    setScreen('home');
    setCurrentJob(null);
  };

  const handleDone = () => {
    setScreen('home');
    setCurrentJob(null);
    setRefreshHome(r => r + 1);
  };

  if (screen === 'job' && currentJob) {
    return <JobScreen job={currentJob} theme={theme} onApprove={handleApprove} onReject={handleReject} />;
  }

  if (screen === 'done') {
    return (
      <SafeAreaView style={[styles.decidedScreen, { backgroundColor: theme.bg }]}>
        <Text style={styles.decidedEmoji}>🚀</Text>
        <Text style={[styles.decidedTitle, { color: theme.text }]}>Bid Submitted!</Text>
        <Text style={[styles.decidedSub, { color: theme.muted }]}>The bid was automatically placed on Freelancer.</Text>
        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: GREEN }]} onPress={handleDone}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <>
      <HomeScreen key={refreshHome} theme={theme} onJobSelect={(bid) => setSelectedBid(bid)} />
      {selectedBid && (
        <BidDetailModal bid={selectedBid} theme={theme} onClose={() => setSelectedBid(null)} />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Home
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 16, borderBottomWidth: 1 },
  homeTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtext: { fontSize: 13, textAlign: 'center' },
  bidCard: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
  bidCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bidCardTitle: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  bidCardScore: { fontSize: 13, fontWeight: '900' },
  bidCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bidCardBudget: { fontSize: 12 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Job screen
  jobHeader: { padding: 16, borderBottomWidth: 1 },
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  headerBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  headerBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  headerLabel: { fontSize: 11, letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  jobTitle: { fontSize: 18, fontWeight: '800', lineHeight: 24, marginBottom: 10 },
  jobMeta: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 8 },
  scoreRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6 },
  scoreNumber: { fontSize: 20, fontWeight: '900' },
  scoreLabel: { color: '#888', fontSize: 9 },
  reasonLabel: { fontSize: 9, letterSpacing: 2, marginBottom: 4, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  reasonText: { fontSize: 13, lineHeight: 19 },
  detailRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  detailKey: { fontSize: 12 },
  jobLink: { fontSize: 12, textDecorationLine: 'underline' },

  // Chat
  chatContainer: { padding: 12, flexGrow: 1, justifyContent: 'flex-end' },
  chatPrompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  promptChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  promptChipText: { fontSize: 12 },
  bubble: { borderRadius: 14, padding: 10, marginBottom: 8, maxWidth: '85%', borderWidth: 1 },
  bubbleText: { fontSize: 13, lineHeight: 19 },

  // Input
  inputRow: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1 },
  sendBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '900' },

  // Actions
  actionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  rejectBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  rejectBtnText: { fontWeight: '800', fontSize: 15, letterSpacing: 1 },
  approveBtn: { flex: 2, padding: 14, borderRadius: 14, backgroundColor: '#00C96B', alignItems: 'center', shadowColor: '#00C96B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  approveBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 },

  // Done screen
  decidedScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  decidedEmoji: { fontSize: 64, marginBottom: 24 },
  decidedTitle: { fontSize: 28, fontWeight: '900', marginBottom: 12 },
  decidedSub: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  doneBtn: { paddingHorizontal: 48, paddingVertical: 16, borderRadius: 14 },
  doneBtnText: { color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 1 },

  // Modal
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  detailSection: { borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1 },
  sectionLabel: { fontSize: 10, letterSpacing: 2, marginBottom: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  sectionValue: { fontSize: 14, marginBottom: 4 },
  sectionBody: { fontSize: 13, lineHeight: 20 },
  viewBtn: { padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center', marginTop: 8, marginBottom: 40 },
});
