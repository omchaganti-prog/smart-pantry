import React, { useState, useEffect } from 'react';
import { Lock, Delete, Fingerprint } from 'lucide-react';
import { verifyPin } from '../services/pinService';
import { biometricEnrolled, verifyBiometric } from '../services/biometricService';

interface LockScreenProps {
  onUnlock: () => void;
}

const PIN_LENGTH_MIN = 4;

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const submit = async (candidate: string) => {
    setChecking(true);
    const ok = await verifyPin(candidate);
    setChecking(false);
    if (ok) {
      onUnlock();
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  const press = (digit: string) => {
    if (checking) return;
    setError('');
    const next = (pin + digit).slice(0, 8);
    setPin(next);
  };

  const hasBiometric = biometricEnrolled();

  const tryBiometric = async () => {
    setError('');
    setChecking(true);
    const ok = await verifyBiometric();
    setChecking(false);
    if (ok) onUnlock();
    else setError('Biometric check failed — use your PIN');
  };

  // offer the fingerprint prompt straight away, but never block the PIN pad behind it
  useEffect(() => {
    if (hasBiometric) void tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-6 text-white">
      <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-6">
        <Lock size={28} />
      </div>
      <h1 className="text-xl font-extrabold mb-1">SmartPantry is locked</h1>
      <p className="text-sm text-gray-400 mb-8">Enter your PIN to continue</p>

      <div className="flex gap-3 mb-4" aria-label="PIN entry">
        {Array.from({ length: Math.max(PIN_LENGTH_MIN, pin.length) }).map((_, i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-colors ${i < pin.length ? 'bg-green-400' : 'bg-white/25'}`}
          />
        ))}
      </div>

      <p className={`text-xs font-semibold h-5 mb-4 ${error ? 'text-red-400' : 'text-transparent'}`}>
        {error || 'placeholder'}
      </p>

      <div className="grid grid-cols-3 gap-4 w-full max-w-[260px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button
            key={d}
            onClick={() => press(d)}
            className="h-16 rounded-2xl bg-white/10 border border-white/15 text-xl font-bold hover:bg-white/20 active:scale-95 transition-all"
          >
            {d}
          </button>
        ))}
        <button
          onClick={() => { setPin(''); setError(''); }}
          className="h-16 rounded-2xl text-xs font-bold text-gray-400 hover:text-white transition-colors"
        >
          Clear
        </button>
        <button
          onClick={() => press('0')}
          className="h-16 rounded-2xl bg-white/10 border border-white/15 text-xl font-bold hover:bg-white/20 active:scale-95 transition-all"
        >
          0
        </button>
        <button
          onClick={() => { setError(''); setPin(p => p.slice(0, -1)); }}
          className="h-16 rounded-2xl flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          aria-label="Delete last digit"
        >
          <Delete size={20} />
        </button>
      </div>

      <button
        onClick={() => submit(pin)}
        disabled={pin.length < PIN_LENGTH_MIN || checking}
        className="mt-8 w-full max-w-[260px] py-4 rounded-2xl bg-green-500 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-600 active:scale-95 transition-all"
      >
        {checking ? 'Checking…' : 'Unlock'}
      </button>

      {hasBiometric && (
        <button
          onClick={tryBiometric}
          disabled={checking}
          className="mt-4 flex items-center gap-2 text-sm font-bold text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
        >
          <Fingerprint size={18} /> Use biometrics instead
        </button>
      )}
    </div>
  );
};

export default LockScreen;
