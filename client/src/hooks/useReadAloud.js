import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for browser-native text-to-speech (window.speechSynthesis).
 * Reads at 0.85× rate. Hides the control if SpeechSynthesis is unavailable.
 * Cancels on unmount.
 */
export function useReadAloud() {
  const [isReading, setIsReading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef(null);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const readAloud = useCallback(
    (text) => {
      if (!isSupported) return;

      if (isReading) {
        window.speechSynthesis.cancel();
        setIsReading(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      utterance.onend = () => setIsReading(false);
      utterance.onerror = () => setIsReading(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsReading(true);
    },
    [isReading, isSupported]
  );

  const stop = useCallback(() => {
    if (isSupported && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsReading(false);
    }
  }, [isSupported]);

  return { isReading, isSupported, readAloud, stop };
}
