import React, { useEffect, useState } from 'react';
import {
  LayoutGrid, Building2, SlidersHorizontal, MessageCircle, Plus, ChevronLeft,
  Trash2, MapPin, ChevronRight, RotateCcw, Send, LogOut,
} from 'lucide-react';
import { supabase } from './supabaseClient';

/* ---------- Design tokens (Toss-style, blue, white bg) ---------- */
const C = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  blue: '#3182F6',
  blueSoft: '#5B9BFA',
  blueBg: '#E8F3FF',
  blueDark: '#1B64DA',
  grey: '#8B95A1',
  greyBg: '#EDF0F3',
  greyBg2: '#F7F8FA',
  red: '#F04452',
  redBg: '#FDE8E9',
  textPrimary: '#191F28',
  textMuted: '#8B95A1',
  blueGradient: 'linear-gradient(135deg, #4593FF 0%, #2272E0 100%)',
};

const font = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Malgun Gothic', sans-serif";
const fontDisplay = "'Outfit', -apple-system, 'Apple SD Gothic Neo', sans-serif";

const DEFAULT_WEIGHTS = { price: 5, speed: 5, transit: 5, school: 5, builder: 5 };
const INITIAL_CHAT_MESSAGES = [
  { role: 'assistant', content: '안녕하세요! 등록하신 구역과 매물 정보를 바탕으로 비교를 도와드릴게요. 무엇이든 물어보세요.' },
];

/* 도시정비법 기준 표준 절차를 좀 더 세분화 + 단계별 평균 소요기간(개월) */
const STAGES = [
  { label: '정비구역 지정', months: 24 },
  { label: '추진위원회 승인', months: 12 },
  { label: '조합설립인가', months: 18 },
  { label: '시공자 선정', months: 8 },
  { label: '사업시행인가', months: 16 },
  { label: '조합원 분양신청', months: 6 },
  { label: '관리처분인가', months: 12 },
  { label: '이주·철거', months: 12 },
  { label: '착공', months: 0 },
  { label: '일반분양', months: 6 },
  { label: '준공', months: 30 },
  { label: '입주', months: 0 },
];
const STAGE_START_IDX = 8; // '착공' index

const CRITERIA = [
  { key: 'price', label: '가격경쟁력' },
  { key: 'speed', label: '사업속도' },
  { key: 'transit', label: '교통접근성' },
  { key: 'school', label: '학군' },
  { key: 'builder', label: '시공사' },
];

const CATALYSTS = [
  { key: 'station', label: '신규 역 신설 (지하철/GTX)' },
  { key: 'roadIC', label: '도로·IC 교통망 확충' },
  { key: 'corporate', label: '대기업·업무시설 입주' },
  { key: 'jobs', label: '산업단지·일자리 조성' },
  { key: 'commercial', label: '대형 상업시설 입점' },
  { key: 'schoolNew', label: '학교 신설·이전' },
  { key: 'park', label: '공원·녹지 조성' },
  { key: 'govPlan', label: '정부·지자체 개발계획' },
];

const emptyListing = () => ({
  id: 'l' + Date.now(),
  label: '',
  askingPrice: '',
  coopPrice: '',
  extraContribution: '',
  ltvPercent: '70',
  link: '',
  memo: '',
});

const emptyZone = () => ({
  id: 'z' + Date.now(),
  name: '',
  address: '',
  builder: '',
  unitType: '',
  stage: 0,
  manualStartYear: '',
  scores: { price: 3, speed: 3, transit: 3, school: 3, builder: 3 },
  catalysts: [],
  catalystMemo: '',
  supplyTotal: '',
  supplyGeneral: '',
  supplyGeneralPercent: '',
  supplyCoop: '',
  supplyCoopPercent: '',
  far: '',
  bcr: '',
  floors: '',
  costPerPyeong: '',
  listings: [],
  memo: '',
  link: '',
  updatedAt: new Date().toISOString().slice(0, 10),
});

const fmt = (v) => (v !== '' && v !== null && v !== undefined && !isNaN(v)) ? Number(v).toLocaleString() : '-';

function computeScore(zone, weights) {
  const wSum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const raw = CRITERIA.reduce((sum, c) => sum + (zone.scores[c.key] || 0) * weights[c.key], 0);
  return Math.round((raw / (5 * wSum)) * 100);
}

function calcListing(l) {
  const asking = Number(l.askingPrice) || 0;
  const coop = Number(l.coopPrice) || 0;
  const extra = Number(l.extraContribution) || 0;
  const ltv = Number(l.ltvPercent) || 0;
  const premium = asking - coop - extra;
  const loan = Math.round(asking * ltv / 100);
  const cash = asking - loan;
  return { premium, loan, cash };
}

function startEstimate(zone) {
  if (zone.manualStartYear) return { text: `${zone.manualStartYear}년 착공 예정 (직접입력)`, tone: 'manual' };
  if (zone.stage >= STAGE_START_IDX) return { text: `${STAGES[zone.stage].label} 단계 (착공 이상)`, tone: 'done' };
  let months = 0;
  for (let i = zone.stage; i < STAGE_START_IDX; i++) months += STAGES[i].months;
  const now = new Date();
  const future = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return { text: `${future.getFullYear()}년경 착공 추정`, tone: 'estimate' };
}

/* ---------- Score ring (signature element) ---------- */
function ScoreRing({ score, highlight }) {
  const pct = Math.max(0, Math.min(100, score));
  const ringColor = highlight ? C.blue : C.blueSoft;
  return (
    <div
      style={{
        width: 56, height: 56, borderRadius: '999px', flexShrink: 0,
        background: `conic-gradient(${ringColor} ${pct * 3.6}deg, ${C.greyBg} 0deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ width: 46, height: 46, borderRadius: '999px', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 16, lineHeight: 1, color: highlight ? C.blue : C.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{score}</div>
      </div>
    </div>
  );
}

/* ---------- Mini segmented stage bar (compare card) ---------- */
function StageBar({ stage }) {
  return (
    <div className="flex" style={{ gap: 2 }}>
      {STAGES.map((s, i) => (
        <div key={i} title={s.label} style={{ flex: 1, height: 5, borderRadius: 999, background: i <= stage ? C.blue : C.greyBg }} />
      ))}
    </div>
  );
}

/* ---------- Full editable stage timeline (zone form) ---------- */
function StageTimeline({ stage, onSelect }) {
  return (
    <div className="flex flex-col" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 4, top: 10, bottom: 10, width: 2, background: C.greyBg, borderRadius: 2 }} />
      {STAGES.map((s, i) => {
        const state = i < stage ? 'done' : i === stage ? 'current' : 'upcoming';
        return (
          <div
            key={i}
            onClick={() => onSelect(i)}
            className="flex items-center gap-3 py-2.5 cursor-pointer"
            style={{ borderBottom: i < STAGES.length - 1 ? `1px solid ${C.greyBg}` : 'none', position: 'relative' }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0, background: state === 'upcoming' ? '#fff' : C.blue, border: `2px solid ${state === 'upcoming' ? C.greyBg : C.blue}`, boxShadow: state === 'current' ? `0 0 0 4px ${C.blueBg}` : 'none', zIndex: 1 }} />
            <div className="flex-1 text-sm" style={{ fontWeight: state === 'current' ? 700 : 500, color: state === 'upcoming' ? C.textMuted : C.textPrimary }}>
              {s.label}
            </div>
            {s.months > 0 && <div className="text-xs" style={{ fontFamily: fontDisplay, color: C.textMuted }}>{s.months}개월</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Score chips (1~5 tap) ---------- */
function ScoreChips({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            onClick={() => onChange(n)}
            style={{ width: 36, height: 36, borderRadius: 12, background: active ? C.blue : C.greyBg, color: active ? '#fff' : C.textMuted, fontWeight: 600, fontSize: 14, border: 'none' }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-5">
      <div className="text-sm font-medium mb-2" style={{ color: C.textPrimary }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', border: 'none', borderRadius: 14, padding: '14px 16px', fontSize: 16,
  color: C.textPrimary, background: C.greyBg, outline: 'none', boxSizing: 'border-box',
};

const cardStyle = { background: C.card, border: `1px solid ${C.greyBg}`, boxShadow: '0 1px 2px rgba(20,30,40,0.03), 0 6px 20px rgba(20,30,40,0.05)' };

function titleImageStyle(height = 100) {
  return {
    width: 'min(320px, 100%)',
    height,
    objectFit: 'contain',
    objectPosition: 'center',
    display: 'block',
  };
}

/* ---------- Main App ---------- */
export default function App() {
  const [zones, setZones] = useState([]);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [tab, setTab] = useState('compare');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [listingDraft, setListingDraft] = useState(null);
  const [editingListingId, setEditingListingId] = useState(null);

  const [chatMessages, setChatMessages] = useState(INITIAL_CHAT_MESSAGES);
  const [apiMessages, setApiMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  const [isSavingRemote, setIsSavingRemote] = useState(false);
  const user = session?.user || null;

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resetLocalData = () => {
      setZones([]);
      setWeights(DEFAULT_WEIGHTS);
      setChatMessages(INITIAL_CHAT_MESSAGES);
      setApiMessages([]);
      setSelectedId(null);
      setDraft(null);
      setListingDraft(null);
      setEditingListingId(null);
    };

    const loadUserData = async () => {
      setHasLoadedRemote(false);
      setSyncMessage('불러오는 중...');

      const { data, error } = await supabase
        .from('user_app_data')
        .select('zones, weights, chat_messages, api_messages')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setSyncMessage('Supabase 테이블 설정이 필요해요.');
        setHasLoadedRemote(false);
        return;
      }

      setZones(Array.isArray(data?.zones) ? data.zones : []);
      setWeights(data?.weights || DEFAULT_WEIGHTS);
      setChatMessages(Array.isArray(data?.chat_messages) && data.chat_messages.length > 0 ? data.chat_messages : INITIAL_CHAT_MESSAGES);
      setApiMessages(Array.isArray(data?.api_messages) ? data.api_messages : []);
      setSelectedId(null);
      setDraft(null);
      setListingDraft(null);
      setEditingListingId(null);
      setHasLoadedRemote(true);
      setSyncMessage(data ? '저장된 기록을 불러왔어요.' : '새 기록을 시작했어요.');
    };

    if (!user) {
      resetLocalData();
      setHasLoadedRemote(false);
      setSyncMessage('');
      return;
    }

    loadUserData();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !hasLoadedRemote) return undefined;

    const timer = window.setTimeout(async () => {
      setIsSavingRemote(true);
      const { error } = await supabase
        .from('user_app_data')
        .upsert({
          user_id: user.id,
          zones,
          weights,
          chat_messages: chatMessages,
          api_messages: apiMessages,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      setIsSavingRemote(false);
      setSyncMessage(error ? '저장에 실패했어요. Supabase 설정을 확인해주세요.' : '자동 저장됨');
    }, 700);

    return () => window.clearTimeout(timer);
  }, [apiMessages, chatMessages, hasLoadedRemote, user?.id, weights, zones]);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const credentials = { email: email.trim(), password };
    const { error } = authMode === 'signup'
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials);

    setAuthLoading(false);
    if (error) {
      setAuthError(error.message);
      return;
    }

    if (authMode === 'signup') {
      setSyncMessage('가입 확인 메일을 확인해주세요.');
    }
  };

  const handleOAuth = async (provider) => {
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const closeDetail = () => { setTab('compare'); setSelectedId(null); setDraft(null); setListingDraft(null); setEditingListingId(null); };

  const openZone = (id) => {
    const z = zones.find((zn) => zn.id === id);
    setDraft({ ...z, scores: { ...z.scores }, listings: z.listings.map((l) => ({ ...l })) });
    setSelectedId(id); setTab('detail'); setListingDraft(null); setEditingListingId(null);
  };

  const openNew = () => { setDraft(emptyZone()); setSelectedId('new'); setTab('detail'); setListingDraft(null); setEditingListingId(null); };

  const saveDraft = () => {
    if (!draft.name.trim()) return;
    const toSave = { ...draft, updatedAt: new Date().toISOString().slice(0, 10) };
    if (selectedId === 'new') setZones((prev) => [...prev, toSave]);
    else setZones((prev) => prev.map((z) => (z.id === selectedId ? toSave : z)));
    closeDetail();
  };

  const deleteZone = (id) => { setZones((prev) => prev.filter((z) => z.id !== id)); closeDetail(); };
  const updateDraft = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));
  const updateScore = (key, value) => setDraft((prev) => ({ ...prev, scores: { ...prev.scores, [key]: value } }));
  const toggleCatalyst = (key) => setDraft((prev) => {
    const has = prev.catalysts.includes(key);
    return { ...prev, catalysts: has ? prev.catalysts.filter((k) => k !== key) : [...prev.catalysts, key] };
  });

  const openListing = (id) => { const l = draft.listings.find((x) => x.id === id); setListingDraft({ ...l }); setEditingListingId(id); };
  const openNewListing = () => { setListingDraft(emptyListing()); setEditingListingId('new'); };
  const closeListing = () => { setListingDraft(null); setEditingListingId(null); };
  const updateListingField = (field, value) => setListingDraft((prev) => ({ ...prev, [field]: value }));

  const saveListing = () => {
    if (editingListingId === 'new') setDraft((prev) => ({ ...prev, listings: [...prev.listings, listingDraft] }));
    else setDraft((prev) => ({ ...prev, listings: prev.listings.map((l) => (l.id === editingListingId ? listingDraft : l)) }));
    closeListing();
  };
  const deleteListing = (id) => { setDraft((prev) => ({ ...prev, listings: prev.listings.filter((l) => l.id !== id) })); closeListing(); };

  const sortedZones = [...zones].sort((a, b) => computeScore(b, weights) - computeScore(a, weights));

  const buildContext = () => {
    if (zones.length === 0) return '사용자가 아직 등록한 재개발 구역이 없습니다. 일반적인 첫 주택 구매 조언을 제공하세요.';
    const lines = zones.map((z) => {
      const listingLines = z.listings.length === 0 ? '등록된 매물 없음' : z.listings.map((l) => {
        const c = calcListing(l);
        return `  - ${l.label || '매물'}: 매매가 ${l.askingPrice || 0}만원, 조합원분양가 ${l.coopPrice || 0}만원, 추가분담금 ${l.extraContribution || 0}만원, 프리미엄 ${c.premium}만원, 대출가능액(LTV ${l.ltvPercent || 0}%) ${c.loan}만원, 필요현금 ${c.cash}만원`;
      }).join('\n');
      const score = computeScore(z, weights);
      const catalystLine = z.catalysts.length === 0 ? '없음' : z.catalysts.map((k) => (CATALYSTS.find((c) => c.key === k) || {}).label).join(', ');
      const supplyLine = `공급계획: 총 ${z.supplyTotal || '-'}세대 (일반분양 ${z.supplyGeneral || '-'}세대/${z.supplyGeneralPercent || '-'}%, 조합원분양 ${z.supplyCoop || '-'}세대/${z.supplyCoopPercent || '-'}%) / 건축계획: 용적률 ${z.far || '-'}%, 건폐율 ${z.bcr || '-'}%, ${z.floors || '-'}층, 평당공사비 ${z.costPerPyeong || '-'}만원`;
      return `[${z.name}] 위치: ${z.address || '미입력'} / 사업단계: ${STAGES[z.stage].label} / ${startEstimate(z).text} / 시공사: ${z.builder || '미정'} / 종합점수: ${score}점\n평가점수 - 가격:${z.scores.price} 속도:${z.scores.speed} 교통:${z.scores.transit} 학군:${z.scores.school} 시공사:${z.scores.builder}\n호재: ${catalystLine}${z.catalystMemo ? ' (' + z.catalystMemo + ')' : ''}\n${supplyLine}\n메모: ${z.memo || '없음'}\n매물:\n${listingLines}`;
    });
    return `당신은 사용자의 첫 주택 구매를 돕는 재개발 구역·매물 비교 어시스턴트입니다. 다음은 사용자가 등록한 후보 구역과 매물 정보입니다. 이 데이터를 바탕으로 질문에 답하고, 비교·추천 시 근거를 함께 설명하세요.\n\n${lines.join('\n\n')}`;
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg = { role: 'user', content: text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    const newApiHistory = [...apiMessages, userMsg];
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: buildContext(),
          messages: newApiHistory,
        }),
      });
      const data = await response.json();
      const replyText = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n') || '응답을 받지 못했어요.';
      setChatMessages((prev) => [...prev, { role: 'assistant', content: replyText }]);
      setApiMessages([...newApiHistory, { role: 'assistant', content: replyText }]);
    } catch (e) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: '오류가 발생했어요. 잠시 후 다시 시도해주세요.' }]);
      setApiMessages(newApiHistory);
    } finally {
      setChatLoading(false);
    }
  };

  if (authLoading && !user) {
    return (
      <div style={{ background: C.bg, height: '100dvh', fontFamily: font, color: C.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/next-home-title.png" alt="Next Home" style={titleImageStyle(96)} />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ background: C.bg, minHeight: '100dvh', fontFamily: font, color: C.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 430 }}>
          <div className="flex justify-center" style={{ marginBottom: 24 }}>
            <img src="/next-home-title.png" alt="Next Home" style={titleImageStyle(110)} />
          </div>

          <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              autoComplete="email"
              required
            />
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
            />
            {authError && <div className="text-sm" style={{ color: C.red }}>{authError}</div>}
            {syncMessage && <div className="text-sm" style={{ color: C.textMuted }}>{syncMessage}</div>}
            <button type="submit" className="w-full py-4 rounded-2xl font-semibold text-base" style={{ background: C.blueGradient, color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(49,130,246,0.28)', opacity: authLoading ? 0.6 : 1 }} disabled={authLoading}>
              {authMode === 'signup' ? '이메일로 가입' : '이메일로 로그인'}
            </button>
          </form>

          <button
            onClick={() => { setAuthMode((prev) => (prev === 'signin' ? 'signup' : 'signin')); setAuthError(''); }}
            className="w-full mt-3 py-3 rounded-2xl text-sm font-semibold"
            style={{ background: C.greyBg2, color: C.textPrimary, border: `1px solid ${C.greyBg}` }}
          >
            {authMode === 'signup' ? '이미 계정이 있어요' : '새 계정 만들기'}
          </button>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={() => handleOAuth('google')} className="py-3 rounded-2xl text-sm font-semibold" style={{ background: '#fff', color: C.textPrimary, border: `1px solid ${C.greyBg}` }}>
              Google
            </button>
            <button onClick={() => handleOAuth('kakao')} className="py-3 rounded-2xl text-sm font-semibold" style={{ background: '#FEE500', color: '#191600', border: 'none' }}>
              Kakao
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, height: '100dvh', fontFamily: font, color: C.textPrimary, overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@700;800&display=swap');
        input[type=range] { -webkit-appearance: none; height: 4px; border-radius: 999px; background: ${C.greyBg}; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 999px; background: ${C.blue}; cursor: pointer; margin-top: -1px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);}
        textarea { font-family: ${font}; }
        button { font-family: ${font}; }
      `}</style>

      <div style={{ maxWidth: 430, margin: '0 auto', height: '100%', minHeight: 0, position: 'relative', background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '24px 20px 16px', background: C.bg, flexShrink: 0 }}>
          {(() => {
            if (tab === 'detail' && listingDraft) {
              return (
                <div className="flex items-center justify-between">
                  <button onClick={closeListing} style={{ color: C.textMuted, background: 'none', border: 'none' }}><ChevronLeft size={22} /></button>
                  <div className="text-base font-semibold">{editingListingId === 'new' ? '새 매물' : '매물 편집'}</div>
                  {editingListingId !== 'new' ? (
                    <button onClick={() => deleteListing(editingListingId)} style={{ color: C.red, background: 'none', border: 'none' }}><Trash2 size={19} /></button>
                  ) : <div style={{ width: 19 }} />}
                </div>
              );
            }
            if (tab === 'detail' && draft) {
              return (
                <div className="flex items-center justify-between">
                  <button onClick={closeDetail} style={{ color: C.textMuted, background: 'none', border: 'none' }}><ChevronLeft size={22} /></button>
                  <div className="text-base font-semibold">{selectedId === 'new' ? '새 구역' : '구역 편집'}</div>
                  {selectedId !== 'new' ? (
                    <button onClick={() => deleteZone(selectedId)} style={{ color: C.red, background: 'none', border: 'none' }}><Trash2 size={19} /></button>
                  ) : <div style={{ width: 19 }} />}
                </div>
              );
            }
            return (
              <div className="flex justify-center">
                <img
                  src="/next-home-title.png"
                  alt="Next Home"
                  style={titleImageStyle(100)}
                />
              </div>
            );
          })()}
        </div>

        {/* Content */}
        <div style={{ padding: '8px 20px calc(96px + env(safe-area-inset-bottom))', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

          {/* ---- Compare tab ---- */}
          {tab === 'compare' && (
            <div>
              <div className="flex items-center justify-between mb-4 mt-2">
                <div className="text-sm" style={{ color: C.textMuted }}>
                  비교 중인 구역 <span style={{ color: C.textPrimary, fontWeight: 600 }}>{zones.length}</span>곳
                </div>
                <button onClick={openNew} className="flex items-center gap-1 text-sm font-semibold px-3.5 py-2 rounded-full" style={{ background: C.blueGradient, color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(49,130,246,0.28)' }}>
                  <Plus size={14} /> 추가
                </button>
              </div>

              {zones.length === 0 ? (
                <div className="text-center py-16 px-6 rounded-2xl" style={cardStyle}>
                  <div className="flex items-center justify-center rounded-full mx-auto mb-4" style={{ width: 52, height: 52, background: C.blueBg }}>
                    <Building2 size={24} style={{ color: C.blue }} />
                  </div>
                  <div className="text-sm mb-4" style={{ color: C.textMuted }}>아직 등록된 구역이 없어요.</div>
                  <button onClick={openNew} className="text-sm font-semibold px-4 py-2.5 rounded-full" style={{ background: C.blueGradient, color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(49,130,246,0.28)' }}>첫 구역 추가하기</button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {sortedZones.map((z, idx) => {
                    const score = computeScore(z, weights);
                    const est = startEstimate(z);
                    const stats = z.listings.length > 0 ? { count: z.listings.length, minCash: Math.min(...z.listings.map((l) => calcListing(l).cash)) } : null;
                    return (
                      <div
                        key={z.id}
                        onClick={() => openZone(z.id)}
                        className="rounded-2xl p-5 cursor-pointer"
                        style={{ ...cardStyle, border: idx === 0 ? `1.5px solid ${C.blue}` : cardStyle.border }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {idx === 0 ? (
                              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: C.blue, color: '#fff' }}>BEST</span>
                            ) : (
                              <div className="flex items-center justify-center rounded-full text-xs font-bold" style={{ width: 24, height: 24, background: C.greyBg, color: C.textMuted }}>{idx + 1}</div>
                            )}
                            <div className="font-bold" style={{ fontSize: 17 }}>{z.name}</div>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <ScoreRing score={score} highlight={idx === 0} />
                            <span className="text-xs" style={{ color: C.textMuted }}>종합점수</span>
                          </div>
                        </div>

                        {z.address && <div className="flex items-center gap-1 text-xs mb-4" style={{ color: C.textMuted }}><MapPin size={11} /> {z.address}</div>}

                        <div className="mb-4">
                          <StageBar stage={z.stage} />
                          <div className="flex items-center justify-between mt-2">
                            <div className="text-xs font-medium" style={{ color: C.blue }}>{STAGES[z.stage].label}</div>
                            <div className="text-xs" style={{ color: C.textMuted }}>{est.text}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-4" style={{ borderTop: `1px solid ${C.greyBg}` }}>
                          <div>
                            <div className="text-xs mb-1" style={{ color: C.textMuted }}>등록 매물</div>
                            <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 16 }}>{z.listings.length}건</div>
                          </div>
                          <div>
                            <div className="text-xs mb-1" style={{ color: C.textMuted }}>최소 필요현금(만원)</div>
                            <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 16 }}>{stats ? fmt(stats.minCash) : '-'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---- Detail tab ---- */}
          {tab === 'detail' && (
            <div className="mt-2">

              {/* zone picker */}
              {!draft && (
                <div>
                  <button onClick={openNew} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-4 rounded-2xl mb-4" style={{ background: C.blueGradient, color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(49,130,246,0.28)' }}>
                    <Plus size={15} /> 새 구역 추가
                  </button>
                  <div className="flex flex-col gap-2">
                    {zones.map((z) => (
                      <div key={z.id} onClick={() => openZone(z.id)} className="flex items-center justify-between p-4 rounded-2xl cursor-pointer" style={cardStyle}>
                        <div>
                          <div className="font-semibold" style={{ fontSize: 15 }}>{z.name || '(이름 없음)'}</div>
                          <div className="text-xs mt-1" style={{ color: C.textMuted }}>{STAGES[z.stage].label}</div>
                        </div>
                        <ChevronRight size={16} style={{ color: C.textMuted }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* zone form */}
              {draft && !listingDraft && (
                <div>
                  <Field label="구역명">
                    <input style={inputStyle} value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} placeholder="예: 영통 후보지" />
                  </Field>
                  <Field label="주소 / 위치">
                    <input style={inputStyle} value={draft.address} onChange={(e) => updateDraft('address', e.target.value)} placeholder="예: 수원시 영통구" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="시공사">
                      <input style={inputStyle} value={draft.builder} onChange={(e) => updateDraft('builder', e.target.value)} placeholder="미정" />
                    </Field>
                    <Field label="관심 평형">
                      <input style={inputStyle} value={draft.unitType} onChange={(e) => updateDraft('unitType', e.target.value)} placeholder="예: 84㎡" />
                    </Field>
                  </div>

                  <Field label={`사업단계 — ${STAGES[draft.stage].label}`}>
                    <div className="p-4 rounded-2xl mb-3" style={cardStyle}>
                      <StageTimeline stage={draft.stage} onSelect={(i) => updateDraft('stage', i)} />
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-2xl mb-3" style={{ background: C.blueBg }}>
                      <span className="text-sm font-medium" style={{ color: C.blueDark }}>{startEstimate(draft).text}</span>
                    </div>
                    <div className="text-xs font-medium mb-2" style={{ color: C.textMuted }}>착공 예상 연도 직접 입력 (선택)</div>
                    <input type="number" style={inputStyle} value={draft.manualStartYear} onChange={(e) => updateDraft('manualStartYear', e.target.value)} placeholder="예: 2029" />
                  </Field>

                  <Field label="호재 (선택입력)">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {CATALYSTS.map((c) => {
                        const active = draft.catalysts.includes(c.key);
                        return (
                          <button
                            key={c.key}
                            onClick={() => toggleCatalyst(c.key)}
                            className="text-xs font-medium px-3 py-2 rounded-full"
                            style={{ background: active ? C.blue : C.greyBg, color: active ? '#fff' : C.textMuted, border: 'none' }}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      style={inputStyle}
                      value={draft.catalystMemo}
                      onChange={(e) => updateDraft('catalystMemo', e.target.value)}
                      placeholder="호재 상세 (예: GTX-C 인덕원역 도보 5분, 삼성전자 캠퍼스 확장 등)"
                    />
                  </Field>

                  <Field label="공급계획 (선택입력)">
                    <div className="flex flex-col gap-3">
                      <input type="number" style={inputStyle} value={draft.supplyTotal} onChange={(e) => updateDraft('supplyTotal', e.target.value)} placeholder="총 공급세대수" />
                      <div className="grid grid-cols-2 gap-3">
                        <input type="number" style={inputStyle} value={draft.supplyGeneral} onChange={(e) => updateDraft('supplyGeneral', e.target.value)} placeholder="일반분양(세대)" />
                        <input type="number" style={inputStyle} value={draft.supplyGeneralPercent} onChange={(e) => updateDraft('supplyGeneralPercent', e.target.value)} placeholder="일반분양 비율(%)" />
                        <input type="number" style={inputStyle} value={draft.supplyCoop} onChange={(e) => updateDraft('supplyCoop', e.target.value)} placeholder="조합원분양(세대)" />
                        <input type="number" style={inputStyle} value={draft.supplyCoopPercent} onChange={(e) => updateDraft('supplyCoopPercent', e.target.value)} placeholder="조합원분양 비율(%)" />
                      </div>
                    </div>
                  </Field>

                  <Field label="건축계획 (선택입력)">
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" style={inputStyle} value={draft.far} onChange={(e) => updateDraft('far', e.target.value)} placeholder="용적률(%)" />
                      <input type="number" style={inputStyle} value={draft.bcr} onChange={(e) => updateDraft('bcr', e.target.value)} placeholder="건폐율(%)" />
                      <input type="number" style={inputStyle} value={draft.floors} onChange={(e) => updateDraft('floors', e.target.value)} placeholder="층수" />
                      <input type="number" style={inputStyle} value={draft.costPerPyeong} onChange={(e) => updateDraft('costPerPyeong', e.target.value)} placeholder="평당 공사비(만원)" />
                    </div>
                  </Field>

                  <Field label={`매물 (${draft.listings.length})`}>
                    <div className="text-xs mb-3" style={{ color: C.textMuted }}>
                      네이버부동산은 공개 API가 없어 자동 연동은 어려워요. 매물 링크를 붙여두고 정보는 직접 입력해주세요.
                    </div>
                    <div className="flex flex-col gap-2 mb-3">
                      {draft.listings.length === 0 ? (
                        <div className="text-sm py-2" style={{ color: C.textMuted }}>아직 등록된 매물이 없어요.</div>
                      ) : draft.listings.map((l) => {
                        const c = calcListing(l);
                        return (
                          <div key={l.id} onClick={() => openListing(l.id)} className="p-4 rounded-2xl cursor-pointer flex items-center justify-between" style={cardStyle}>
                            <div>
                              <div className="text-sm font-semibold">{l.label || '매물'}</div>
                              <div className="text-xs mt-1" style={{ color: C.textMuted }}>매매가 {fmt(l.askingPrice)}만원 · 프리미엄 {fmt(c.premium)}만원</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs" style={{ color: C.textMuted }}>필요현금</div>
                              <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 15, color: C.blue }}>{fmt(c.cash)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={openNewListing} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-2xl" style={{ background: C.blueBg, color: C.blueDark, border: 'none' }}>
                      <Plus size={14} /> 매물 추가
                    </button>
                  </Field>

                  <Field label="평가 점수">
                    <div className="p-4 rounded-2xl flex flex-col gap-5" style={cardStyle}>
                      {CRITERIA.map((c) => (
                        <div key={c.key}>
                          <div className="text-sm font-medium mb-2.5">{c.label}</div>
                          <ScoreChips value={draft.scores[c.key]} onChange={(v) => updateScore(c.key, v)} />
                        </div>
                      ))}
                    </div>
                  </Field>

                  <Field label="메모">
                    <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={draft.memo} onChange={(e) => updateDraft('memo', e.target.value)} placeholder="임장 후기, 주의사항 등" />
                  </Field>
                  <Field label="참고 링크">
                    <input style={inputStyle} value={draft.link} onChange={(e) => updateDraft('link', e.target.value)} placeholder="온누리시스템 / 조합 홈페이지 URL" />
                  </Field>

                  <button onClick={saveDraft} className="w-full py-4 rounded-2xl font-semibold text-base mt-1" style={{ background: C.blueGradient, color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(49,130,246,0.28)' }}>저장하기</button>
                </div>
              )}

              {/* listing form */}
              {draft && listingDraft && (
                <div>
                  <Field label="매물명">
                    <input style={inputStyle} value={listingDraft.label} onChange={(e) => updateListingField('label', e.target.value)} placeholder="예: 101동 1502호 / 84A 12층" />
                  </Field>
                  <Field label="네이버부동산 링크">
                    <input style={inputStyle} value={listingDraft.link} onChange={(e) => updateListingField('link', e.target.value)} placeholder="매물 URL 붙여넣기" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="매매가(만원)">
                      <input type="number" style={inputStyle} value={listingDraft.askingPrice} onChange={(e) => updateListingField('askingPrice', e.target.value)} />
                    </Field>
                    <Field label="조합원분양가(만원)">
                      <input type="number" style={inputStyle} value={listingDraft.coopPrice} onChange={(e) => updateListingField('coopPrice', e.target.value)} />
                    </Field>
                    <Field label="추가분담금(만원)">
                      <input type="number" style={inputStyle} value={listingDraft.extraContribution} onChange={(e) => updateListingField('extraContribution', e.target.value)} />
                    </Field>
                    <Field label="대출가능비율 LTV(%)">
                      <input type="number" style={inputStyle} value={listingDraft.ltvPercent} onChange={(e) => updateListingField('ltvPercent', e.target.value)} />
                    </Field>
                  </div>

                  <div className="p-4 rounded-2xl mb-5" style={{ background: C.blueBg }}>
                    <div className="text-xs font-medium mb-3" style={{ color: C.blueDark }}>계산 결과 (세금·중개비용 등은 제외한 단순 계산)</div>
                    {(() => {
                      const c = calcListing(listingDraft);
                      return (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-xs mb-1" style={{ color: C.blueDark }}>프리미엄</div>
                            <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 16 }}>{fmt(c.premium)}</div>
                          </div>
                          <div>
                            <div className="text-xs mb-1" style={{ color: C.blueDark }}>대출가능액</div>
                            <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 16 }}>{fmt(c.loan)}</div>
                          </div>
                          <div>
                            <div className="text-xs mb-1" style={{ color: C.blueDark }}>필요현금</div>
                            <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 16 }}>{fmt(c.cash)}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <Field label="메모">
                    <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={listingDraft.memo} onChange={(e) => updateListingField('memo', e.target.value)} placeholder="동/호수, 향, 컨디션 등" />
                  </Field>

                  <button onClick={saveListing} className="w-full py-4 rounded-2xl font-semibold text-base" style={{ background: C.blueGradient, color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(49,130,246,0.28)' }}>매물 저장</button>
                </div>
              )}
            </div>
          )}

          {/* ---- Chat tab ---- */}
          {tab === 'chat' && (
            <div className="mt-2">
              <div className="flex flex-col gap-3 mb-4">
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div
                      className="px-4 py-3 rounded-2xl text-sm"
                      style={{
                        maxWidth: '82%', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                        background: m.role === 'user' ? C.blue : C.greyBg,
                        color: m.role === 'user' ? '#fff' : C.textPrimary,
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div className="px-4 py-3 rounded-2xl text-sm" style={{ background: C.greyBg, color: C.textMuted }}>답변을 작성 중이에요…</div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                  placeholder="예: 영통이랑 비산동 중 어디가 나을까?"
                />
                <button onClick={sendChat} disabled={chatLoading} style={{ width: 48, height: 48, borderRadius: 14, background: C.blueGradient, color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(49,130,246,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: chatLoading ? 0.5 : 1 }}>
                  <Send size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ---- Settings tab ---- */}
          {tab === 'settings' && (
            <div className="mt-2">
              <div className="p-4 rounded-2xl mb-4 flex items-center justify-between gap-3" style={cardStyle}>
                <div style={{ minWidth: 0 }}>
                  <div className="text-sm font-semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email || '로그인됨'}</div>
                  <div className="text-xs mt-1" style={{ color: C.textMuted }}>{isSavingRemote ? '저장 중...' : syncMessage}</div>
                </div>
                <button onClick={handleSignOut} className="flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: 14, background: C.greyBg2, color: C.textMuted, border: `1px solid ${C.greyBg}`, flexShrink: 0 }} title="로그아웃">
                  <LogOut size={18} />
                </button>
              </div>
              <div className="text-sm mb-5" style={{ color: C.textMuted }}>
                항목별 중요도를 조절하면 비교 탭의 순위가 바로 바뀌어요. 항목들의 합이 100이 아니어도 비율로 계산돼요.
              </div>
              <div className="p-4 rounded-2xl flex flex-col gap-5 mb-4" style={cardStyle}>
                {CRITERIA.map((c) => (
                  <div key={c.key}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">{c.label}</span>
                      <span className="font-semibold" style={{ color: C.blue }}>{weights[c.key]}</span>
                    </div>
                    <input type="range" min={0} max={10} step={1} value={weights[c.key]} onChange={(e) => setWeights((prev) => ({ ...prev, [c.key]: Number(e.target.value) }))} style={{ width: '100%' }} />
                  </div>
                ))}
              </div>
              <button onClick={() => setWeights({ price: 5, speed: 5, transit: 5, school: 5, builder: 5 })} className="flex items-center gap-1.5 text-sm font-medium mb-6" style={{ color: C.textMuted, background: 'none', border: 'none' }}>
                <RotateCcw size={13} /> 기본값으로 되돌리기
              </button>
              <div className="p-4 rounded-2xl text-sm leading-relaxed" style={{ background: C.blueBg, color: C.blueDark }}>
                지금은 화면 안에서만 데이터가 유지돼요. 마음에 들면 배우자와 실시간으로 같은 데이터를 보고 입력할 수 있도록 동기화를 연결할게요.
              </div>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div
          style={{
            position: 'fixed',
            left: '50%',
            right: 'auto',
            bottom: 0,
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 430,
            zIndex: 20,
            background: '#fff',
            borderTop: `1px solid ${C.greyBg}`,
            padding: '10px 10px calc(10px + env(safe-area-inset-bottom))',
            boxSizing: 'border-box',
          }}
          className="flex justify-around"
        >
          {[
            { id: 'compare', label: '비교', icon: LayoutGrid },
            { id: 'detail', label: '상세', icon: Building2 },
            { id: 'chat', label: 'AI비교', icon: MessageCircle },
            { id: 'settings', label: '설정', icon: SlidersHorizontal },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); if (t.id !== 'detail') { setSelectedId(null); setDraft(null); setListingDraft(null); setEditingListingId(null); } }}
                className="flex flex-col items-center justify-center gap-0.5 rounded-2xl"
                style={{ minWidth: 60, height: 54, color: active ? C.blue : C.textMuted, background: active ? C.blueBg : 'none', border: 'none', transition: 'background 0.15s ease' }}
              >
                <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
                <span style={{ fontSize: 11.5, lineHeight: 1.1, fontWeight: active ? 600 : 400 }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
