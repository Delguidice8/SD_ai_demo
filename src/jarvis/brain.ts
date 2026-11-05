// Local, dependency-free command engine for the Jarvis interface.
// Everything runs in the browser — no API keys or backend required.

export type JarvisAction =
  | { type: 'open'; url: string }
  | { type: 'timer'; seconds: number; label: string }
  | { type: 'clear' }
  | { type: 'rename'; name: string }
  | { type: 'exit' };

export interface JarvisReply {
  text: string;
  action?: JarvisAction;
}

export interface BrainContext {
  userName: string;
  timers: number;
  uptimeSeconds: number;
}

const SITES: Record<string, string> = {
  google: 'https://www.google.com',
  youtube: 'https://www.youtube.com',
  github: 'https://github.com',
  gmail: 'https://mail.google.com',
  maps: 'https://maps.google.com',
  calendar: 'https://calendar.google.com',
  news: 'https://news.google.com',
  wikipedia: 'https://www.wikipedia.org',
  linkedin: 'https://www.linkedin.com',
};

const JOKES = [
  "I would tell you a UDP joke, but you might not get it.",
  "There are 10 kinds of people: those who understand binary, and those who don't.",
  "I asked the server for a joke. It returned a 418: I'm a teapot.",
  "My favourite exercise is a cross between a lunge and a crunch. I call it lunch.",
  "Debugging is like being the detective in a crime movie where you are also the murderer.",
];

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function bootGreeting(userName: string): string {
  const greeting = greetingForHour(new Date().getHours());
  return `${greeting}, ${userName}. All systems are online. How can I help you today?`;
}

/** Evaluates a plain arithmetic expression. Returns null if it isn't one. */
function calculate(expression: string): number | null {
  const cleaned = expression
    .replace(/\btimes\b|\bx\b|multiplied by/g, '*')
    .replace(/divided by|\bover\b/g, '/')
    .replace(/\bplus\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/to the power of|\^/g, '**')
    .replace(/,/g, '')
    .trim();
  // Only digits, whitespace, decimal points, parentheses and operators may pass.
  if (!cleaned || !/^[\d\s.+\-*/%()]+$/.test(cleaned) || !/\d/.test(cleaned)) return null;
  try {
    const result = Function(`"use strict"; return (${cleaned});`)();
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function parseDuration(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (unit.startsWith('h')) return value * 3600;
  if (unit.startsWith('m')) return value * 60;
  return value;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (s || parts.length === 0) parts.push(`${s} second${s === 1 ? '' : 's'}`);
  return parts.join(' ');
}

export function think(rawInput: string, ctx: BrainContext): JarvisReply {
  const input = rawInput.toLowerCase().trim().replace(/[?!.]+$/, '');
  const now = new Date();

  if (!input) return { text: "I'm listening." };

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(input) || input === 'jarvis') {
    return { text: `${greetingForHour(now.getHours())}, ${ctx.userName}. What can I do for you?` };
  }

  if (/how are you|how's it going|status report|system status|diagnostics/.test(input)) {
    return {
      text: `All systems nominal. Uptime is ${formatDuration(ctx.uptimeSeconds)}, ${ctx.timers} active timer${ctx.timers === 1 ? '' : 's'}, and core temperature is well within limits.`,
    };
  }

  if (/what time|current time|the time/.test(input)) {
    return { text: `It is ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` };
  }

  if (/what('s| is) (the )?(date|day)|today's date|what day/.test(input)) {
    return {
      text: `Today is ${now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`,
    };
  }

  if (/who are you|what are you|your name/.test(input)) {
    return {
      text: "I'm Jarvis, the SD.ai assistant interface. I can tell the time, run calculations, set timers, open websites, search the web, and tell you about SD.ai's services.",
    };
  }

  if (/^(help|commands|what can you do)/.test(input)) {
    return {
      text: 'Try: "what time is it", "calculate 12 times 8", "set a timer for 5 minutes", "open YouTube", "search for quantum computing", "tell me a joke", "system status", or "what does SD.ai do". Say "clear" to wipe the log or "shut down" to exit.',
    };
  }

  if (/^(my name is|call me) /.test(input)) {
    const name = rawInput.trim().replace(/^(my name is|call me)\s+/i, '').replace(/[.!]+$/, '');
    return { text: `Understood. I'll call you ${name}.`, action: { type: 'rename', name } };
  }

  if (/joke|make me laugh/.test(input)) {
    return { text: pick(JOKES) };
  }

  if (/^(clear|reset|wipe)( the)?( log| screen| chat)?$/.test(input)) {
    return { text: 'Log cleared.', action: { type: 'clear' } };
  }

  if (/^(shut ?down|exit|goodbye|bye|power off|close)/.test(input)) {
    return { text: `Powering down. Goodbye, ${ctx.userName}.`, action: { type: 'exit' } };
  }

  if (/timer|remind me in|countdown/.test(input)) {
    const seconds = parseDuration(input);
    if (!seconds) return { text: 'For how long? Try "set a timer for 10 minutes".' };
    return {
      text: `Timer set for ${formatDuration(seconds)}.`,
      action: { type: 'timer', seconds, label: formatDuration(seconds) },
    };
  }

  const openMatch = input.match(/^(open|launch|go to|pull up)\s+(.+)$/);
  if (openMatch) {
    const target = openMatch[2].replace(/^the\s+/, '').replace(/\s+/g, '');
    const known = SITES[target];
    if (known) return { text: `Opening ${openMatch[2]}.`, action: { type: 'open', url: known } };
    if (/^[\w-]+(\.[\w-]+)+$/.test(target)) {
      return { text: `Opening ${target}.`, action: { type: 'open', url: `https://${target}` } };
    }
  }

  const searchMatch = input.match(/^(search( for| the web for)?|google|look up|find)\s+(.+)$/);
  if (searchMatch) {
    const query = searchMatch[3];
    return {
      text: `Searching the web for "${query}".`,
      action: { type: 'open', url: `https://www.google.com/search?q=${encodeURIComponent(query)}` },
    };
  }

  const mathSource = input.replace(/^(calculate|compute|what('s| is)|solve)\s+/, '');
  const result = calculate(mathSource);
  if (result !== null) {
    const pretty = Number.isInteger(result) ? result.toLocaleString() : result.toLocaleString(undefined, { maximumFractionDigits: 6 });
    return { text: `That comes to ${pretty}.` };
  }

  if (/sd\.?ai|your company|services|what do you (do|offer)/.test(input)) {
    return {
      text: 'SD.ai builds AI-powered automation: 24/7 AI customer support agents, CRM integrations that keep your data clean, and automated appointment scheduling. Would you like me to book a free consultation?',
    };
  }

  if (/consultation|book|schedule (a )?(call|meeting)|contact/.test(input)) {
    return { text: 'You can reach the SD.ai team at contact@sd.ai or (123) 456-7890. I can also open the contact form on the main site — just say "shut down" to return there.' };
  }

  if (/thank/.test(input)) {
    return { text: pick(['Always a pleasure.', 'At your service.', 'Anytime.']) };
  }

  return {
    text: `I'm not sure how to handle "${rawInput.trim()}" yet. Say "help" to see what I can do, or "search for ${rawInput.trim()}" and I'll look it up.`,
  };
}
