import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal typings for the Web Speech API (not in the default TS DOM lib).
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function useSpeech(onFinalTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const callbackRef = useRef(onFinalTranscript);
  callbackRef.current = onFinalTranscript;

  const recognitionSupported = typeof window !== 'undefined' && !!getRecognitionCtor();
  const synthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (synthesisSupported) window.speechSynthesis.cancel();
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          setInterim('');
          callbackRef.current(result[0].transcript);
        } else {
          interimText += result[0].transcript;
        }
      }
      if (interimText) setInterim(interimText);
    };
    recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') setError(`Voice input error: ${e.error}`);
    };
    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };
    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    recognition.start();
  }, [synthesisSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!synthesisSupported) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /en-GB/i.test(v.lang) && /male|daniel|arthur|george/i.test(v.name)) ??
        voices.find((v) => /en-GB/i.test(v.lang)) ??
        voices.find((v) => /^en/i.test(v.lang));
      if (preferred) utterance.voice = preferred;
      utterance.rate = 1.02;
      utterance.pitch = 0.9;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [synthesisSupported],
  );

  const cancelSpeech = useCallback(() => {
    if (synthesisSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [synthesisSupported]);

  useEffect(() => {
    // Some browsers load voices asynchronously; touching getVoices primes the list.
    if (synthesisSupported) window.speechSynthesis.getVoices();
    return () => {
      recognitionRef.current?.stop();
      if (synthesisSupported) window.speechSynthesis.cancel();
    };
  }, [synthesisSupported]);

  return {
    listening,
    speaking,
    interim,
    error,
    recognitionSupported,
    synthesisSupported,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
  };
}
