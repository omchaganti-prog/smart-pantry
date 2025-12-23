import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';

interface PINSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
}

const PINSetupModal: React.FC<PINSetupModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'setup' | 'confirm'>('setup');
  const [error, setError] = useState('');

  const handleNext = () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handleConfirm = () => {
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    onConfirm(pin);
    handleClose();
  };

  const handleClose = () => {
    setPin('');
    setConfirmPin('');
    setStep('setup');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white dark:bg-gray-800 w-full rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Lock size={20} /> Set PIN Code
          </h3>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {step === 'setup' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter a 4-digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:border-blue-500"
                  placeholder="••••"
                />
              </div>
              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
            </>
          )}

          {step === 'confirm' && (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">PIN set to: {pin.replace(/./g, '•')}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:border-blue-500"
                  placeholder="••••"
                />
              </div>
              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
            </>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl font-bold active:scale-95 transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={step === 'setup' ? handleNext : handleConfirm}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-transform"
          >
            {step === 'setup' ? 'Next' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PINSetupModal;
