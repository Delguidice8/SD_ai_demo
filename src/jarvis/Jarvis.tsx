import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  BatteryMedium,
  Cpu,
  Mic,
  MicOff,
  Power,
  Send,
  Timer,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { bootGreeting, think } from './brain';
import { useSpeech } from './useSpeech';

interface Message {
  id: number;
  from: 'user' | 'jarvis';
  text: string;
  time: string;
}

interface ActiveTimer {
  id: number;
  label: string;
  endsAt: number;
}

const BOOT_LINES = [
  'Initializing neural core…',
  'Loading language matrix…',
  'Calibrating voice interface…',
  'Establishing secure uplink…',
  'All systems online.',
];

const QUICK_COMMANDS = ['What time is it?', 'System status', 'Set a timer for 1 minute', 'Tell me a joke', 'What does SD.ai do?', 'Help'];

const STORAGE_KEY = 'jarvis:userName';

function loadName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'sir';
  } catch {
    return 'sir';
  }
}

const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

let messageId = 0;

interface JarvisProps {
  onExit: () => void;
}

export default function Jarvis({ onExit }: JarvisProps) {
  const [phase, setPhase] = useState<'standby' | 'booting' | 'online'>('standby');
  const [bootStep, setBootStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [voiceOn, setVoiceOn] = useState(true);
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [battery, setBattery] = useState<number | null>(null);
  const [load, setLoad] = useState<number[]>(() => Array.from({ length: 24 }, () => 20 + Math.random() * 30));
  const [thinking, setThinking] = useState(false);

  const userNameRef = useRef(loadName());
  const startedAt = useRef(Date.now());
  const logRef = useRef<HTMLDivElement>(null);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;

  const handleRef = useRef<(text: string) => void>(() => {});
  const speech = useSpeech((text) => handleRef.current(text));
  const { speak } = speech;

  const say = useCallback(
    (text: string) => {
      setMessages((m) => [...m, { id: ++messageId, from: 'jarvis', text, time: stamp() }]);
      if (voiceOnRef.current) speak(text);
    },
    [speak],
  );

  const handleCommand = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setMessages((m) => [...m, { id: ++messageId, from: 'user', text, time: stamp() }]);
      setThinking(true);

      window.setTimeout(() => {
        setThinking(false);
        const reply = think(text, {
          userName: userNameRef.current,
          timers: timers.length,
          uptimeSeconds: Math.floor((Date.now() - startedAt.current) / 1000),
        });
        const action = reply.action;

        if (action?.type === 'clear') {
          setMessages([]);
        }
        say(reply.text);

        if (action?.type === 'open') {
          window.open(action.url, '_blank', 'noopener,noreferrer');
        } else if (action?.type === 'timer') {
          setTimers((t) => [...t, { id: ++messageId, label: action.label, endsAt: Date.now() + action.seconds * 1000 }]);
        } else if (action?.type === 'rename') {
          userNameRef.current = action.name;
          try {
            localStorage.setItem(STORAGE_KEY, action.name);
          } catch {
            /* storage unavailable — keep the name for this session only */
          }
        } else if (action?.type === 'exit') {
          window.setTimeout(onExit, 2200);
        }
      }, 450);
    },
    [say, timers.length, onExit],
  );
  handleRef.current = handleCommand;

  // Boot sequence
  useEffect(() => {
    if (phase !== 'booting') return;
    if (bootStep < BOOT_LINES.length) {
      const t = window.setTimeout(() => setBootStep((s) => s + 1), 420);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setPhase('online');
      say(bootGreeting(userNameRef.current));
    }, 500);
    return () => window.clearTimeout(t);
  }, [phase, bootStep, say]);

  // Clock, timers and simulated core load
  useEffect(() => {
    const tick = window.setInterval(() => {
      setNow(new Date());
      setLoad((l) => [...l.slice(1), Math.max(5, Math.min(95, l[l.length - 1] + (Math.random() - 0.5) * 22))]);
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const finished = timers.filter((t) => t.endsAt <= now.getTime());
    if (finished.length === 0) return;
    setTimers((all) => all.filter((t) => t.endsAt > now.getTime()));
    finished.forEach((t) => say(`Your ${t.label} timer is complete.`));
  }, [now, timers, say]);

  // Connectivity and battery
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; addEventListener: (e: string, f: () => void) => void }> };
    nav.getBattery?.().then((b) => {
      setBattery(Math.round(b.level * 100));
      b.addEventListener('levelchange', () => setBattery(Math.round(b.level * 100)));
    }).catch(() => {});
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking, speech.interim]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    handleCommand(input);
    setInput('');
  };

  const toggleVoice = () => {
    if (voiceOn) speech.cancelSpeech();
    setVoiceOn((v) => !v);
  };

  const coreState = speech.listening ? 'listening' : speech.speaking ? 'speaking' : thinking ? 'thinking' : 'idle';
  const uptime = Math.floor((now.getTime() - startedAt.current) / 1000);
  const currentLoad = Math.round(load[load.length - 1]);

  // ── Standby / boot screens ───────────────────────────────────────────────
  if (phase !== 'online') {
    return (
      <div className="jarvis-root min-h-screen flex flex-col items-center justify-center px-4 text-cyan-300">
        <div className="absolute inset-0 jarvis-grid pointer-events-none" />
        <button
          onClick={onExit}
          aria-label="Back to site"
          className="absolute top-5 right-5 p-2 rounded-full border border-cyan-500/30 hover:bg-cyan-500/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <ArcReactor state={phase === 'booting' ? 'thinking' : 'idle'} size={220} />
        {phase === 'standby' ? (
          <button
            onClick={() => setPhase('booting')}
            className="mt-12 jarvis-font tracking-[0.3em] text-sm uppercase px-8 py-3 border border-cyan-400/60 rounded hover:bg-cyan-400/10 hover:shadow-[0_0_24px_rgba(34,211,238,0.45)] transition-all"
          >
            Initialize Jarvis
          </button>
        ) : (
          <div className="mt-10 font-mono text-sm space-y-1 w-72">
            {BOOT_LINES.slice(0, bootStep).map((line, i) => (
              <div key={line} className="jarvis-fade-in">
                <span className="text-cyan-600">[{String(i + 1).padStart(2, '0')}]</span> {line}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Main HUD ─────────────────────────────────────────────────────────────
  return (
    <div className="jarvis-root min-h-screen text-cyan-100 flex flex-col">
      <div className="fixed inset-0 jarvis-grid pointer-events-none" />
      <div className="fixed inset-0 jarvis-scanlines pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-cyan-500/20">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
          <span className="jarvis-font text-lg sm:text-xl tracking-[0.35em] text-cyan-300">J.A.R.V.I.S</span>
          <span className="hidden sm:inline text-xs text-cyan-600 tracking-widest">// SD.ai</span>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label={voiceOn ? 'Mute voice' : 'Unmute voice'} onClick={toggleVoice}>
            {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </IconButton>
          <IconButton label="Shut down" onClick={onExit}>
            <Power className="w-4 h-4" />
          </IconButton>
        </div>
      </header>

      <main className="relative z-10 flex-1 grid gap-4 p-4 sm:p-6 lg:grid-cols-[260px_1fr_260px] min-h-0">
        {/* Left: telemetry */}
        <aside className="space-y-4 order-2 lg:order-1">
          <Panel title="Chronometer">
            <div className="jarvis-font text-4xl text-cyan-200 tabular-nums">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              <span className="text-lg text-cyan-500 ml-1">{String(now.getSeconds()).padStart(2, '0')}</span>
            </div>
            <div className="text-xs text-cyan-500 mt-1 uppercase tracking-widest">
              {now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </Panel>

          <Panel title="Core Load" icon={<Cpu className="w-3.5 h-3.5" />}>
            <div className="flex items-end gap-[3px] h-16">
              {load.map((v, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-cyan-700 to-cyan-300 rounded-sm transition-all duration-700" style={{ height: `${v}%`, opacity: 0.35 + (i / load.length) * 0.65 }} />
              ))}
            </div>
            <div className="mt-2 text-xs flex justify-between text-cyan-500">
              <span>CPU</span>
              <span className="tabular-nums text-cyan-300">{currentLoad}%</span>
            </div>
          </Panel>

          <Panel title="Systems" icon={<Activity className="w-3.5 h-3.5" />}>
            <ul className="space-y-2 text-sm">
              <StatusRow label="Uplink" value={online ? 'Online' : 'Offline'} ok={online} icon={online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />} />
              <StatusRow label="Power" value={battery === null ? 'External' : `${battery}%`} ok={battery === null || battery > 20} icon={<BatteryMedium className="w-3.5 h-3.5" />} />
              <StatusRow label="Voice in" value={speech.recognitionSupported ? 'Ready' : 'Unavailable'} ok={speech.recognitionSupported} />
              <StatusRow label="Voice out" value={!speech.synthesisSupported ? 'Unavailable' : voiceOn ? 'Active' : 'Muted'} ok={speech.synthesisSupported && voiceOn} />
              <StatusRow label="Uptime" value={formatUptime(uptime)} ok />
            </ul>
          </Panel>
        </aside>

        {/* Center: reactor + conversation */}
        <section className="order-1 lg:order-2 flex flex-col items-center min-h-0">
          <div className="py-4 sm:py-6">
            <ArcReactor state={coreState} size={200} />
          </div>
          <div className="text-xs tracking-[0.4em] uppercase text-cyan-400 mb-4 jarvis-font h-4">
            {coreState === 'listening' ? 'Listening' : coreState === 'speaking' ? 'Speaking' : coreState === 'thinking' ? 'Processing' : 'Standing by'}
          </div>

          <div className="w-full max-w-2xl flex-1 flex flex-col jarvis-panel rounded-lg min-h-[280px]">
            <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[42vh] lg:max-h-none">
              {messages.map((m) => (
                <div key={m.id} className={`jarvis-fade-in flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-md px-3 py-2 text-sm leading-relaxed ${m.from === 'user' ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-50' : 'bg-slate-900/60 border-l-2 border-cyan-400 text-cyan-100'}`}>
                    <div className="text-[10px] uppercase tracking-widest text-cyan-500 mb-0.5">
                      {m.from === 'user' ? userNameRef.current : 'Jarvis'} · {m.time}
                    </div>
                    {m.text}
                  </div>
                </div>
              ))}
              {speech.interim && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-md px-3 py-2 text-sm italic text-cyan-300/70 border border-dashed border-cyan-400/30">{speech.interim}…</div>
                </div>
              )}
              {thinking && (
                <div className="flex gap-1 pl-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
            </div>

            {speech.error && <div className="px-4 py-1 text-xs text-amber-400">{speech.error}</div>}

            <form onSubmit={submit} className="flex items-center gap-2 p-3 border-t border-cyan-500/20">
              <button
                type="button"
                onClick={speech.listening ? speech.stopListening : speech.startListening}
                aria-label={speech.listening ? 'Stop listening' : 'Start voice input'}
                className={`shrink-0 p-2.5 rounded-full border transition-all ${speech.listening ? 'border-red-400 text-red-300 bg-red-500/15 shadow-[0_0_16px_rgba(248,113,113,0.5)]' : 'border-cyan-400/50 text-cyan-300 hover:bg-cyan-400/10'}`}
              >
                {speech.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Give a command…"
                className="flex-1 min-w-0 bg-transparent border-b border-cyan-500/30 focus:border-cyan-300 outline-none px-1 py-2 text-sm placeholder:text-cyan-700"
                autoFocus
              />
              <button type="submit" aria-label="Send" className="shrink-0 p-2.5 rounded-full border border-cyan-400/50 text-cyan-300 hover:bg-cyan-400/10 transition-colors disabled:opacity-40" disabled={!input.trim()}>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* Right: timers + quick commands */}
        <aside className="space-y-4 order-3">
          <Panel title="Active Timers" icon={<Timer className="w-3.5 h-3.5" />}>
            {timers.length === 0 ? (
              <p className="text-xs text-cyan-600">No active timers. Try "set a timer for 5 minutes".</p>
            ) : (
              <ul className="space-y-2">
                {timers.map((t) => {
                  const remaining = Math.max(0, Math.ceil((t.endsAt - now.getTime()) / 1000));
                  return (
                    <li key={t.id} className="flex items-center justify-between text-sm">
                      <span className="text-cyan-400 truncate mr-2">{t.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="jarvis-font tabular-nums text-cyan-200">{formatUptime(remaining)}</span>
                        <button aria-label={`Cancel ${t.label} timer`} onClick={() => setTimers((all) => all.filter((x) => x.id !== t.id))} className="text-cyan-600 hover:text-red-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Quick Commands">
            <div className="flex flex-wrap lg:flex-col gap-2">
              {QUICK_COMMANDS.map((cmd) => (
                <button key={cmd} onClick={() => handleCommand(cmd)} className="text-left text-xs px-3 py-2 rounded border border-cyan-500/25 text-cyan-300 hover:bg-cyan-400/10 hover:border-cyan-300/60 transition-colors">
                  › {cmd}
                </button>
              ))}
            </div>
          </Panel>
        </aside>
      </main>
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────

function formatUptime(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function Panel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="jarvis-panel rounded-lg p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-cyan-500 mb-3 jarvis-font">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function StatusRow({ label, value, ok, icon }: { label: string; value: string; ok: boolean; icon?: ReactNode }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-cyan-500">
        {icon ?? <span className="w-3.5" />}
        {label}
      </span>
      <span className={`flex items-center gap-1.5 ${ok ? 'text-cyan-200' : 'text-amber-400'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-cyan-400' : 'bg-amber-400'}`} />
        {value}
      </span>
    </li>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="p-2 rounded-full border border-cyan-500/30 text-cyan-300 hover:bg-cyan-400/10 transition-colors">
      {children}
    </button>
  );
}

function ArcReactor({ state, size }: { state: 'idle' | 'listening' | 'speaking' | 'thinking'; size: number }) {
  const color = state === 'listening' ? '#f87171' : '#22d3ee';
  const speed = state === 'idle' ? 1 : 2.5;
  return (
    <div className={`relative jarvis-core jarvis-core--${state}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
        <defs>
          <radialGradient id="jarvis-glow">
            <stop offset="0%" stopColor="#ecfeff" />
            <stop offset="35%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer tick ring */}
        <g className="jarvis-spin" style={{ animationDuration: `${40 / speed}s` }}>
          {Array.from({ length: 60 }).map((_, i) => (
            <line key={i} x1="100" y1="4" x2="100" y2={i % 5 === 0 ? 14 : 9} stroke={color} strokeOpacity={i % 5 === 0 ? 0.9 : 0.4} strokeWidth="1.2" transform={`rotate(${i * 6} 100 100)`} />
          ))}
        </g>

        {/* Segmented ring */}
        <g className="jarvis-spin-reverse" style={{ animationDuration: `${24 / speed}s` }}>
          <circle cx="100" cy="100" r="78" fill="none" stroke={color} strokeWidth="5" strokeDasharray="40 12 8 12" strokeOpacity="0.55" />
        </g>

        {/* Thin arcs */}
        <g className="jarvis-spin" style={{ animationDuration: `${12 / speed}s` }}>
          <circle cx="100" cy="100" r="64" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="120 280" strokeLinecap="round" />
          <circle cx="100" cy="100" r="58" fill="none" stroke={color} strokeWidth="1" strokeDasharray="60 300" strokeOpacity="0.7" transform="rotate(180 100 100)" />
        </g>

        {/* Inner triangle housing */}
        <g className="jarvis-spin-reverse" style={{ animationDuration: `${60 / speed}s` }}>
          <polygon points="100,52 142,124 58,124" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.8" />
          <circle cx="100" cy="100" r="46" fill="none" stroke={color} strokeWidth="0.75" strokeOpacity="0.6" />
        </g>

        {/* Glowing core */}
        <circle cx="100" cy="100" r="38" fill="url(#jarvis-glow)" className="jarvis-pulse" />
        <circle cx="100" cy="100" r="14" fill="#ecfeff" opacity="0.95" />
      </svg>
    </div>
  );
}
