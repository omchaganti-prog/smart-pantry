import { useState, useEffect } from 'react';

export interface WaitStage {
  /** show this message once the wait has run this many seconds */
  afterSeconds: number;
  message: string;
}

/**
 * AI calls here regularly take 20s or more, which reads as "the app froze" unless we
 * say something. Given a loading flag, this reports how long the wait has been going
 * and the reassuring line that goes with it.
 */
export const DEFAULT_WAIT_STAGES: WaitStage[] = [
  { afterSeconds: 10, message: 'Still working on it…' },
  { afterSeconds: 20, message: "Sorry, this is taking longer than expected — hang tight." },
  { afterSeconds: 45, message: "Sorry, still going. The AI is running slow right now — you can keep waiting or cancel and try again." },
];

export const useWaitMessage = (
  isWaiting: boolean,
  stages: WaitStage[] = DEFAULT_WAIT_STAGES
): { elapsedSeconds: number; message: string | null } => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isWaiting) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const tick = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [isWaiting]);

  if (!isWaiting) return { elapsedSeconds: 0, message: null };

  // the last stage we've passed wins
  const current = [...stages]
    .sort((a, b) => a.afterSeconds - b.afterSeconds)
    .reduce<WaitStage | null>(
      (found, stage) => (elapsedSeconds >= stage.afterSeconds ? stage : found),
      null
    );

  return { elapsedSeconds, message: current?.message ?? null };
};
