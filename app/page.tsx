'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import topics from '../data/topics';
import { schedule } from '../data/schedule';
import { AppState, DayProgress, Theme, Intensity, JokeFrequency, Briefing, DailyEntry } from '../types';
import { tx, ui } from '../lib/i18n';
import { coach } from '../lib/coach';

const DAY = 86400000;
const HOUR = 3600000;
const MIN = 60000;

const initial: AppState = {
  version: 1,
  lang: 'en',
  theme: 'soc',
  intensity: 'normal',
  jokeFrequency: 'normal',
  briefing: 'full',
  sound: true,
  notifications: false,
  daily: {},
  breakStartedAt: null,
  breaksUsed: 0,
  streak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
  coachHistory: [],
  timer: { running: false, sessionStartedAt: null, accumulatedMs: 0, lastSyncedAt: null },
};

function fmt(ms: number) {
  ms = Math.max(0, Math.floor(ms / 1000) * 1000);
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  const s = Math.floor((ms % MIN) / 1000);
  return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':');
}

function today() {
  return new Date().toLocaleDateString('en-CA');
}

function getDay(date: string) {
  return schedule.find((x) => x.date === date) || schedule[schedule.length - 1];
}

function safeParse(s: string): AppState | null {
  try {
    const x = JSON.parse(s);
    if (!x || x.version !== 1 || typeof x.daily !== 'object' || !x.timer) return null;
    return { ...initial, ...x, timer: { ...initial.timer, ...x.timer } };
  } catch {
    return null;
  }
}

function labelForDay(d: DailyEntry, language: 'en' | 'ar') {
  const t = topics.find((x) => x.id === d.topicId);
  if (d.kind === 'topic') return t ? (language === 'ar' ? t.arTitle : t.title) : language === 'ar' ? 'موضوع' : 'Topic';
  const labels = {
    satr: language === 'ar' ? 'منصة سطر' : 'Satr',
    break: language === 'ar' ? 'يوم راحة' : 'Break',
    review: language === 'ar' ? 'مراجعة نهائية' : 'Final Review',
    pre: language === 'ar' ? 'قبل المسابقة' : 'Pre-Competition',
    competition: language === 'ar' ? 'يوم المسابقة' : 'Competition',
  } as const;
  return labels[d.kind];
}

function statusForDay(d: DailyEntry, date: string, currentDate: string, p?: DayProgress) {
  if (d.date === currentDate) return 'today';
  if (p?.completed) return 'completed';
  if (p?.missed) return 'missed';
  if (d.kind === 'break') return 'break';
  if (d.kind === 'review') return 'review';
  if (d.kind === 'pre') return 'pre';
  if (d.kind === 'competition') return 'competition';
  if (date > currentDate) return 'upcoming';
  return 'missed';
}

export default function Home() {
  const [state, setState] = useState<AppState>(initial);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<'dashboard' | 'calendar' | 'mistakes' | 'settings' | 'topic'>('dashboard');
  const [now, setNow] = useState(Date.now());
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selectedDay, setSelectedDay] = useState<DailyEntry | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem('cyber7h-state');
    if (raw) {
      const parsed = safeParse(raw);
      if (parsed) setState(parsed);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem('cyber7h-state', JSON.stringify(state));
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = state.lang;
  }, [state, ready]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedDay(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const date = today();
  const day = getDay(date);
  const topic = topics.find((t) => t.id === day.topicId);
  const dp: DayProgress = state.daily[date] || { studyMs: 0, theory: [], practical: [], assessmentSubmitted: false };

  const currentStudy = state.timer.running && state.timer.sessionStartedAt
    ? state.timer.accumulatedMs + (now - state.timer.sessionStartedAt)
    : state.timer.accumulatedMs;

  const debt = Object.entries(state.daily)
    .filter(([d, p]) => d < date && !p.completed && !p.missed)
    .reduce((a, [, p]) => a + Math.max(0, 7 * HOUR - p.studyMs), 0);

  const required = 7 * HOUR + debt;
  const remaining = Math.max(0, required - currentStudy);
  const pct = Math.min(100, (currentStudy / required) * 100);
  const totalQuestions = topics.reduce((a, t) => a + t.questions.length, 0);
  const mistakes = Object.values(state.daily).flatMap((p) => p.mistakes || []);
  const correct = Object.values(state.daily).reduce((a, p) => a + (p.score || 0), 0);
  const submitted = Object.values(state.daily).reduce((a, p) => a + (p.assessmentSubmitted ? 10 : 0), 0);
  const accuracy = submitted ? Math.round((correct / submitted) * 100) : 0;

  const weak = Object.entries(
    topics.map((t) => ({ id: t.id, title: t.title, count: 0 })).reduce((a, x) => {
      a[x.id] = x;
      return a;
    }, {} as Record<string, { id: string; title: string; count: number }>)
  );
  mistakes.forEach((m) => {
    const found = topics.find((t) => m.startsWith(t.id + ':'));
    if (found) {
      const entry = weak.find(([id]) => id === found.id);
      if (entry) entry[1].count++;
    }
  });
  weak.sort((a, b) => b[1].count - a[1].count);
  const weakNames = weak.filter(([, v]) => v.count > 0).slice(0, 2).map(([, v]) => v.title);

  const daysUntil = Math.max(
    0,
    Math.ceil((new Date('2026-11-30T12:00:00').getTime() - new Date(date + 'T12:00:00').getTime()) / DAY)
  );

  const brief = useMemo(
    () => coach({
      date,
      topic,
      topicDay: day.topicDay,
      studyMs: currentStudy,
      requiredMs: required,
      debtMs: debt,
      streak: state.streak,
      accuracy,
      weak: weakNames,
      days: daysUntil,
      lang: state.lang,
      intensity: state.intensity,
      history: state.coachHistory,
    }),
    [date, topic, day.topicDay, currentStudy, required, debt, state.streak, accuracy, weakNames.join(','), daysUntil, state.lang, state.intensity, state.coachHistory]
  );

  const setStateSafe = (fn: (s: AppState) => AppState) => setState((s) => fn(JSON.parse(JSON.stringify(s))));

  function start() {
    if (state.breakStartedAt) return;
    const n = Date.now();
    setStateSafe((s) => ({ ...s, timer: { ...s.timer, running: true, sessionStartedAt: n, lastSyncedAt: n } }));
  }

  function pause() {
    if (!state.timer.running || !state.timer.sessionStartedAt) return;
    const n = Date.now();
    const acc = state.timer.accumulatedMs + (n - state.timer.sessionStartedAt);
    setStateSafe((s) => ({ ...s, timer: { running: false, sessionStartedAt: null, accumulatedMs: acc, lastSyncedAt: n } }));
  }

  function stop() {
    const n = Date.now();
    const acc = state.timer.running && state.timer.sessionStartedAt
      ? state.timer.accumulatedMs + (n - state.timer.sessionStartedAt)
      : state.timer.accumulatedMs;
    setStateSafe((s) => ({
      ...s,
      daily: { ...s.daily, [date]: { ...dp, studyMs: Math.max(dp.studyMs, acc) } },
      timer: { running: false, sessionStartedAt: null, accumulatedMs: acc, lastSyncedAt: n },
    }));
  }

  useEffect(() => {
    if (!ready || !state.timer.running || !state.timer.sessionStartedAt) return;
    if (currentStudy >= required) {
      setStateSafe((s) => {
        const old = s.daily[date] || { studyMs: 0, theory: [], practical: [] };
        const nd = { ...old, studyMs: currentStudy, completed: true };
        return {
          ...s,
          daily: { ...s.daily, [date]: nd },
          timer: { running: false, sessionStartedAt: null, accumulatedMs: currentStudy, lastSyncedAt: Date.now() },
          streak: s.streak + 1,
          longestStreak: Math.max(s.longestStreak, s.streak + 1),
          lastCompletedDate: date,
        };
      });
    }
  }, [currentStudy, required, ready]);

  function toggle(kind: 'theory' | 'practical', id: string) {
    setStateSafe((s) => {
      const d = s.daily[date] || { studyMs: 0, theory: [], practical: [] };
      const arr = d[kind].includes(id) ? d[kind].filter((x) => x !== id) : [...d[kind], id];
      return { ...s, daily: { ...s.daily, [date]: { ...d, [kind]: arr } } };
    });
  }

  function submit() {
    if (!topic) return;
    const qs = topic.questions;
    let score = 0;
    const ms: string[] = [];
    qs.forEach((q) => {
      if (answers[q.id] === q.answer) score++;
      else ms.push(`${topic.id}:${q.id}`);
    });
    setStateSafe((s) => ({
      ...s,
      daily: {
        ...s.daily,
        [date]: {
          ...(s.daily[date] || { studyMs: currentStudy, theory: [], practical: [] }),
          studyMs: currentStudy,
          assessmentSubmitted: true,
          answers: qs.map((q) => answers[q.id] ?? -1),
          score,
          mistakes: ms,
        },
      },
    }));
  }

  function takeBreak() {
    if (state.breaksUsed >= 12 || state.breakStartedAt) return;
    if (!confirm(state.lang === 'ar' ? 'هذا البريك بيستهلك يومًا واحدًا من أصل 12. هل تريد المتابعة؟' : 'This break consumes one of 12 break days. Continue?')) return;
    pause();
    setStateSafe((s) => ({ ...s, breaksUsed: s.breaksUsed + 1, breakStartedAt: new Date().toISOString() }));
  }

  const breakLeft = state.breakStartedAt
    ? Math.max(0, 24 * HOUR - (now - new Date(state.breakStartedAt).getTime()))
    : 0;

  useEffect(() => {
    if (state.breakStartedAt && breakLeft <= 0) setStateSafe((s) => ({ ...s, breakStartedAt: null }));
  }, [breakLeft, state.breakStartedAt]);

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cybersecurity-7h-progress.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const p = safeParse(String(r.result));
      if (!p) {
        alert('Invalid progress file. Current progress was not changed.');
        return;
      }
      setState(p);
      alert('Progress imported successfully.');
    };
    r.readAsText(f);
    e.target.value = '';
  }

  function reset() {
    if (confirm(state.lang === 'ar' ? 'تأكيد قوي: سيتم مسح كل التقدم محليًا. هل أنت متأكد؟' : 'Strong confirmation: all local progress will be erased. Continue?')) {
      setState(initial);
    }
  }

  const T = ui[state.lang];
  const nav = [
    ['dashboard', T.dashboard],
    ['calendar', T.calendar],
    ['mistakes', T.mistakes],
    ['settings', T.settings],
  ] as const;

  const selectedTopic = selectedDay?.topicId ? topics.find((t) => t.id === selectedDay.topicId) : undefined;
  const selectedProgress = selectedDay ? state.daily[selectedDay.date] : undefined;

  if (!ready) {
    return <div className="app"><main className="main"><div className="loading-card">Loading mission control…</div></main></div>;
  }

  return (
    <div className={`app theme-${state.theme} ${state.lang === 'ar' ? 'rtl' : ''}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="shell">
        <aside className="sidebar">
          <div className="brand-mark"><span>7H</span><div><b>CYBERSECURITY</b><small>MISSION CONTROL</small></div></div>
          <div className="side-status"><i /> LOCAL-FIRST <span>●</span> NOV 30 MISSION</div>
          <nav className="nav" aria-label="Primary navigation">
            {nav.map(([id, label]) => (
              <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
                <span className="nav-icon">{id === 'dashboard' ? '⌂' : id === 'calendar' ? '▦' : id === 'mistakes' ? '!' : '⚙'}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="side-mission">
            <div className="eyebrow">COUNTDOWN</div>
            <strong>{daysUntil}</strong>
            <span>{state.lang === 'ar' ? 'يوم حتى المهمة' : 'days until mission'}</span>
          </div>
          <div className="sidebar-footer">LOCAL STORAGE<br />NO LOGIN · NO EXTERNAL AI</div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div>
              <div className="breadcrumb">MISSION CONTROL <span>/</span> {labelForDay(day, state.lang)}</div>
              <div className="date-line">{date} <span>•</span> {state.lang === 'ar' ? 'التوقيت المحلي' : 'LOCAL TIME'}</div>
            </div>
            <div className="top-actions">
              <button className="lang-switch" onClick={() => setStateSafe((s) => ({ ...s, lang: s.lang === 'en' ? 'ar' : 'en' }))}>
                {state.lang === 'en' ? 'العربية' : 'English'}
              </button>
              <button className="profile-chip" onClick={() => setPage('settings')} aria-label="Open settings">◉</button>
            </div>
          </header>

          {page === 'dashboard' && (
            <>
              <section className="hero mission-hero">
                <div className="hero-copy">
                  <div className="eyebrow">DAY {schedule.findIndex((x) => x.date === date) + 1} · {state.breakStartedAt ? 'BREAK MODE' : 'MISSION ACTIVE'}</div>
                  <h1>{topic ? (state.lang === 'ar' ? topic.arTitle : topic.title) : labelForDay(day, state.lang)}</h1>
                  <p>{topic
                    ? tx(state.lang, topic.why, topic.arWhy)
                    : day.kind === 'satr'
                      ? tx(state.lang, 'Use your Satr track and spend the day building fundamentals.', 'استخدم مسار سطر وخصص اليوم لبناء الأساسيات.')
                      : day.kind === 'pre'
                        ? tx(state.lang, 'Light review. Prepare your setup. Rest. No heavy new learning.', 'مراجعة خفيفة. جهز بيئتك. ارتح. لا يوجد تعلم ثقيل جديد.')
                        : day.kind === 'competition'
                          ? tx(state.lang, 'You have done the preparation. Today is execution.', 'تم إنجاز التحضير. اليوم للتنفيذ.')
                          : tx(state.lang, 'Close weaknesses using mixed questions, practical labs and mistake review.', 'أغلق نقاط الضعف بالأسئلة المختلطة والمختبرات ومراجعة الأخطاء.')}</p>
                </div>
                <div className="mission-badge"><span>MISSION</span><b>7H</b><small>DAILY TARGET</small></div>
              </section>

              <section className="stat-grid">
                <div className="metric-card"><span>DAILY TARGET</span><strong>{fmt(7 * HOUR)}</strong><small>Required study time</small></div>
                <div className="metric-card highlight"><span>STUDIED</span><strong>{fmt(currentStudy)}</strong><small>{Math.round(pct)}% of current requirement</small></div>
                <div className="metric-card"><span>REMAINING</span><strong>{fmt(remaining)}</strong><small>Keep the mission moving</small></div>
                <div className="metric-card"><span>STUDY DEBT</span><strong>{fmt(debt)}</strong><small>{debt ? 'Carry-over from missed targets' : 'No active debt'}</small></div>
              </section>

              {!state.breakStartedAt && day.kind !== 'competition' && day.kind !== 'pre' && (
                <section className="timer-card panel">
                  <div className="panel-heading"><div><div className="eyebrow">MISSION TIMER</div><h2>{state.timer.running ? 'MISSION IN PROGRESS' : 'READY TO DEPLOY'}</h2></div><span className="live-dot">{state.timer.running ? '● LIVE' : '● STANDBY'}</span></div>
                  <div className="timer-wrap"><div className="timer">{fmt(remaining)}</div><div className="timer-sub">{state.lang === 'ar' ? 'الوقت المتبقي من الهدف الحالي' : 'TIME REMAINING IN CURRENT TARGET'}</div></div>
                  <div className="progress large"><i style={{ width: `${pct}%` }} /></div>
                  <div className="timer-actions">
                    {!state.timer.running
                      ? <button className="btn primary big" onClick={start}>{state.timer.accumulatedMs ? '▶ RESUME MISSION' : '▶ START MISSION'}</button>
                      : <button className="btn big" onClick={pause}>⏸ PAUSE MISSION</button>}
                    <button className="btn big" onClick={stop}>■ STOP & SAVE</button>
                    <button className="btn big subtle" onClick={takeBreak}>☕ TAKE BREAK</button>
                  </div>
                </section>
              )}

              {state.breakStartedAt && (
                <section className="break-card panel">
                  <div className="eyebrow">24-HOUR BREAK</div>
                  <h2>RECOVERY WINDOW</h2>
                  <div className="timer">{fmt(breakLeft)}</div>
                  <p>{state.lang === 'ar' ? `البريكات المتبقية: ${12 - state.breaksUsed} / 12` : `Breaks remaining: ${12 - state.breaksUsed} / 12`}</p>
                </section>
              )}

              <section className="panel briefing-panel">
                <div className="panel-heading"><div><div className="eyebrow">DAILY BRIEFING</div><h2>{T.briefing}</h2></div><span className="mode-chip">{brief.mode}</span></div>
                <div className={`brief-grid briefing-${state.briefing}`}>
                  <div className="brief-block"><span>SITUATION</span><strong>{brief.greeting}</strong><p>{brief.main}</p></div>
                  {state.briefing !== 'minimal' && <div className="brief-block"><span>MISSION</span><strong>{topic ? `Complete ${topic.title}` : 'Keep review focused'}</strong><p>{topic ? 'Build theory, complete practical work, then submit the assessment.' : 'Use mixed questions, labs and mistake review.'}</p></div>}
                  {state.briefing !== 'minimal' && <div className="brief-block"><span>THREAT</span><strong>{debt ? `${fmt(debt)} debt` : weakNames.length ? weakNames.join(' · ') : 'Delay'}</strong><p>{debt ? 'Carry-over study debt is active.' : weakNames.length ? 'These areas are currently appearing in your mistakes.' : 'Protect the first study block from distraction.'}</p></div>}
                  <div className="brief-block next"><span>NEXT ACTION</span><strong>{brief.next}</strong><p>One focused block. Then reassess.</p></div>
                </div>
                {state.jokeFrequency !== 'never' && <div className="cyber-joke">⌁ <span>{brief.joke}</span></div>}
              </section>

              {topic && (
                <section className="panel topic-progress-panel">
                  <div className="panel-heading"><div><div className="eyebrow">CURRENT TOPIC · DAY {day.topicDay}/2</div><h2>{state.lang === 'ar' ? topic.arTitle : topic.title}</h2></div><button className="btn" onClick={() => setPage('topic')}>OPEN TOPIC →</button></div>
                  <p className="muted lead">{tx(state.lang, topic.why, topic.arWhy)}</p>
                  <div className="check-grid">
                    <div><div className="check-title">THEORY <span>{dp.theory.length}/{topic.theory.length}</span></div>{topic.theory.map((x) => <label className="check" key={x.id}><input type="checkbox" checked={dp.theory.includes(x.id)} onChange={() => toggle('theory', x.id)} /><span>{state.lang === 'ar' ? x.ar : x.en}</span></label>)}</div>
                    <div><div className="check-title">PRACTICAL <span>{dp.practical.length}/{topic.practical.length}</span></div>{topic.practical.map((x) => <label className="check" key={x.id}><input type="checkbox" checked={dp.practical.includes(x.id)} onChange={() => toggle('practical', x.id)} /><span>{state.lang === 'ar' ? x.ar : x.en}</span></label>)}</div>
                  </div>
                </section>
              )}

              <section className="stat-grid lower-stats">
                <div className="metric-card"><span>🔥 CURRENT STREAK</span><strong>{state.streak}</strong><small>Days completed</small></div>
                <div className="metric-card"><span>LONGEST STREAK</span><strong>{state.longestStreak}</strong><small>Best run</small></div>
                <div className="metric-card"><span>QUESTIONS</span><strong>{submitted}/{totalQuestions}</strong><small>Submitted assessments</small></div>
                <div className="metric-card"><span>ACCURACY</span><strong>{accuracy}%</strong><small>Across submitted questions</small></div>
              </section>
            </>
          )}

          {page === 'topic' && topic && (
            <section>
              <div className="hero"><div className="eyebrow">TOPIC · DAY {day.topicDay}/2</div><h1>{state.lang === 'ar' ? topic.arTitle : topic.title}</h1><p>{tx(state.lang, topic.why, topic.arWhy)}</p></div>
              <div className="panel topic-detail"><div className="detail-grid"><div><h2>THEORY</h2>{topic.theory.map((x) => <label className="check" key={x.id}><input type="checkbox" checked={dp.theory.includes(x.id)} onChange={() => toggle('theory', x.id)} /><span>{state.lang === 'ar' ? x.ar : x.en}</span></label>)}</div><div><h2>PRACTICAL</h2>{topic.practical.map((x) => <label className="check" key={x.id}><input type="checkbox" checked={dp.practical.includes(x.id)} onChange={() => toggle('practical', x.id)} /><span>{state.lang === 'ar' ? x.ar : x.en}</span></label>)}</div></div><h2>COMMON MISTAKES</h2>{topic.mistakes.map((x) => <div className="info-line" key={x}>• {x}</div>)}<h2>TOOLS</h2><div className="tool-list">{topic.tools.map((x) => <span key={x}>{x}</span>)}</div></div>
              <div className="panel assessment"><div className="panel-heading"><div><div className="eyebrow">ASSESSMENT</div><h2>10 QUESTIONS</h2></div><span className="mode-chip">{dp.assessmentSubmitted ? `${dp.score}/10` : 'ANSWERS HIDDEN'}</span></div>{topic.questions.map((q, i) => <div className="q" key={q.id}><b>{i + 1}. {state.lang === 'ar' ? q.arQuestion : q.question}</b>{(state.lang === 'ar' ? q.arOptions : q.options)?.map((o, j) => <label className="option" key={j}><input type="radio" name={q.id} checked={answers[q.id] === j} onChange={() => setAnswers((a) => ({ ...a, [q.id]: j }))} />{o}</label>)}</div>)}<button className="btn primary big" onClick={submit}>SUBMIT ASSESSMENT</button>{dp.assessmentSubmitted && <div className="result-banner"><strong>{dp.score}/10</strong><span>{state.lang === 'ar' ? 'تم تسجيل الاختبار. راجع الأخطاء.' : 'Assessment recorded. Review mistakes from Mistake Review.'}</span></div>}</div>
            </section>
          )}

          {page === 'calendar' && (
            <section>
              <div className="hero"><div className="eyebrow">SCHEDULE · SEPT 17 → NOV 30</div><h1>{T.calendar}</h1><p>{state.lang === 'ar' ? 'خطة المهمة كاملة: منصة سطر، 25 موضوعًا، 12 يوم راحة، 4 أيام مراجعة، ما قبل المسابقة، ويوم المسابقة.' : 'Full mission schedule: Satr, 25 topics, 12 break days, 4 review days, pre-competition and competition day.'}</p></div>
              <div className="panel calendar-panel">
                <div className="calendar-legend">
                  <span><i className="today-dot" /> Today</span><span><i className="completed-dot" /> Completed</span><span><i className="break-dot" /> Break</span><span><i className="review-dot" /> Review</span><span><i className="missed-dot" /> Missed</span>
                </div>
                <div className="calendar-grid">
                  {schedule.map((d) => {
                    const p = state.daily[d.date];
                    const status = statusForDay(d, d.date, date, p);
                    const t = topics.find((x) => x.id === d.topicId);
                    return <button aria-label={`${d.date} ${labelForDay(d, state.lang)}`} className={`calendar-day ${status}`} key={d.date} onClick={() => setSelectedDay(d)}><div className="calendar-top"><b>{new Date(d.date + 'T12:00:00').getDate()}</b><span>{status.toUpperCase()}</span></div><strong>{d.kind === 'topic' ? (t?.title || 'Topic') : labelForDay(d, state.lang)}</strong>{d.topicDay && <small>DAY {d.topicDay}/2</small>}{p?.completed && <em>✓ COMPLETE</em>}</button>;
                  })}
                </div>
              </div>
            </section>
          )}

          {page === 'mistakes' && (
            <section><div className="hero"><div className="eyebrow">DEFENSIVE REVIEW</div><h1>{T.mistakes}</h1><p>{state.lang === 'ar' ? 'كل خطأ محفوظ للمراجعة ولا يخصم من وقت الدراسة.' : 'Every mistake is retained for review and never deducts study time.'}</p></div><div className="stat-grid lower-stats"><div className="metric-card"><span>MISTAKES</span><strong>{mistakes.length}</strong><small>Recorded wrong answers</small></div><div className="metric-card"><span>ACCURACY</span><strong>{accuracy}%</strong><small>Across submitted assessments</small></div><div className="metric-card"><span>QUESTIONS</span><strong>{submitted}</strong><small>Questions submitted</small></div><div className="metric-card"><span>WEAK TOPICS</span><strong>{weakNames.length}</strong><small>Topics with mistakes</small></div></div><div className="panel mistakes-panel">{mistakes.length === 0 ? <div className="empty-state"><span>✓</span><h2>No mistakes yet.</h2><p>Complete an assessment to start building your weakness profile.</p></div> : mistakes.map((m, i) => <div className="mistake" key={`${m}-${i}`}><div className="mistake-icon">!</div><div><strong>{m.split(':')[0]}</strong><p>{m}</p><small>Review this concept from the topic assessment.</small></div></div>)}</div></section>
          )}

          {page === 'settings' && (
            <section><div className="hero"><div className="eyebrow">LOCAL CONFIGURATION</div><h1>Settings</h1><p>Customize the mission control experience without changing your study data.</p></div><div className="settings-stack">
              <div className="panel settings-card"><div className="setting-title"><span>01</span><div><h2>APPEARANCE</h2><p>Choose the visual command-center style.</p></div></div><div className="setting-options">{[['soc','SOC'],['terminal','Terminal'],['futuristic','Futuristic Cyber'],['clean','Clean Dark'],['light','Light']].map(([value,label]) => <button key={value} className={state.theme === value ? 'choice active' : 'choice'} onClick={() => setStateSafe((s) => ({ ...s, theme: value as Theme }))}><i>{state.theme === value ? '●' : '○'}</i>{label}</button>)}</div></div>
              <div className="panel settings-card"><div className="setting-title"><span>02</span><div><h2>COACH</h2><p>Control how aggressively the coach pushes you.</p></div></div><div className="settings-fields"><label>Coach intensity<select value={state.intensity} onChange={(e) => setStateSafe((s) => ({ ...s, intensity: e.target.value as Intensity }))}><option value="calm">Calm</option><option value="normal">Normal</option><option value="strict">Strict</option><option value="brutal">Brutal-but-fun</option></select></label><label>Coach language<select value={state.lang} onChange={(e) => setStateSafe((s) => ({ ...s, lang: e.target.value as 'en' | 'ar' }))}><option value="en">English</option><option value="ar">Arabic</option></select></label><label>Daily briefing<select value={state.briefing} onChange={(e) => setStateSafe((s) => ({ ...s, briefing: e.target.value as Briefing }))}><option value="full">Full</option><option value="compact">Compact</option><option value="minimal">Minimal</option></select></label></div></div>
              <div className="panel settings-card"><div className="setting-title"><span>03</span><div><h2>MOTIVATION</h2><p>Fine-tune jokes and optional browser feedback.</p></div></div><div className="settings-fields"><label>Joke frequency<select value={state.jokeFrequency} onChange={(e) => setStateSafe((s) => ({ ...s, jokeFrequency: e.target.value as JokeFrequency }))}><option value="never">Never</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><label>Sound<select value={String(state.sound)} onChange={(e) => setStateSafe((s) => ({ ...s, sound: e.target.value === 'true' }))}><option value="true">On</option><option value="false">Off</option></select></label><label>Browser notifications<select value={String(state.notifications)} onChange={(e) => setStateSafe((s) => ({ ...s, notifications: e.target.value === 'true' }))}><option value="false">Off</option><option value="true">On</option></select></label></div></div>
              <div className="panel settings-card"><div className="setting-title"><span>04</span><div><h2>DATA & PROGRESS</h2><p>Backup, restore, or reset your local mission data.</p></div></div><div className="data-actions"><button className="btn" onClick={exportData}>↓ EXPORT PROGRESS</button><button className="btn" onClick={() => fileRef.current?.click()}>↑ IMPORT PROGRESS</button><input ref={fileRef} type="file" accept="application/json" onChange={importData} hidden /><button className="btn danger" onClick={reset}>RESET PROGRESS</button></div></div>
            </div></section>
          )}

          <footer className="footer">CYBERSECURITY 7H COACH · LOCAL-FIRST · NO LOGIN · NO EXTERNAL AI REQUIRED</footer>
        </main>
      </div>

      <div className="mobile-nav">{nav.map(([id, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><span>{id === 'dashboard' ? '⌂' : id === 'calendar' ? '▦' : id === 'mistakes' ? '!' : '⚙'}</span>{label}</button>)}</div>

      {selectedDay && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedDay(null); }}>
          <div className="day-modal" role="dialog" aria-modal="true" aria-labelledby="day-modal-title">
            <button className="modal-close" onClick={() => setSelectedDay(null)} aria-label="Close">×</button>
            <div className="eyebrow">MISSION DAY</div>
            <h2 id="day-modal-title">{selectedDay.date}</h2>
            <div className="modal-status">{statusForDay(selectedDay, selectedDay.date, date, selectedProgress).toUpperCase()}</div>
            <div className="modal-topic">{selectedTopic ? selectedTopic.title : labelForDay(selectedDay, state.lang)}{selectedDay.topicDay && <span>DAY {selectedDay.topicDay}/2</span>}</div>
            <div className="modal-stats"><div><span>STUDIED</span><strong>{fmt(selectedProgress?.studyMs || 0)}</strong></div><div><span>TARGET</span><strong>{selectedDay.kind === 'competition' || selectedDay.kind === 'pre' ? '—' : '07:00:00'}</strong></div><div><span>ASSESSMENT</span><strong>{selectedProgress?.assessmentSubmitted ? `${selectedProgress.score || 0}/10` : '—'}</strong></div></div>
            <p className="muted">{selectedTopic ? selectedTopic.why : selectedDay.kind === 'break' ? 'A 24-hour recovery period. It does not create study debt.' : selectedDay.kind === 'review' ? 'Final review period focused on weaknesses and mixed practice.' : selectedDay.kind === 'competition' ? 'Competition day. No normal study requirement.' : 'Schedule checkpoint for the mission.'}</p>
            <button className="btn primary big" onClick={() => { setSelectedDay(null); if (selectedTopic) setPage('topic'); }}>OPEN DETAILS</button>
          </div>
        </div>
      )}
    </div>
  );
}
