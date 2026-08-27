import React, { useEffect, useRef, useState } from 'react';

/**
 * Renders Google's official "Sign in with Google" button via Google Identity Services.
 *
 * The GIS script is loaded on demand rather than in index.html so the app doesn't pull
 * it in for guests who never sign in.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google?: any;
  }
}

let gisPromise: Promise<void> | null = null;

const loadGis = (): Promise<void> => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;

  gisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google sign-in')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('Failed to load Google sign-in'));
    };
    document.head.appendChild(script);
  });

  return gisPromise;
};

interface GoogleSignInButtonProps {
  clientId: string;
  onCredential: (credential: string) => void | Promise<void>;
  onError?: (message: string) => void;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ clientId, onCredential, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (response?.credential) onCredential(response.credential);
            else onError?.('Google did not return a sign-in token.');
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 320,
        });
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('failed');
        onError?.('Could not load Google sign-in. Check your connection and try again.');
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <div className="w-full flex flex-col items-center">
      <div ref={containerRef} className="flex justify-center min-h-[44px]" />
      {status === 'loading' && (
        <div className="h-11 w-full max-w-[320px] rounded-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
      )}
      {status === 'failed' && (
        <p className="text-xs text-red-500 font-semibold text-center">
          Google sign-in is unavailable right now.
        </p>
      )}
    </div>
  );
};

export default GoogleSignInButton;
