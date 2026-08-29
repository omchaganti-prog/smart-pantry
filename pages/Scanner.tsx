import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, Check, RefreshCw, Zap, Upload, Plus, Trash2, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { analyzeImage } from '../services/geminiService';
import { saveItems } from '../services/storageService';
import { prepareScanImage } from '../services/imageService';
import { FoodCategory, PantryItem, ScanResult } from '../types';
import { useNavigate } from 'react-router-dom';
import { useWaitMessage } from '../hooks/useWaitMessage';
import { useWalkthrough } from '../contexts/WalkthroughContext';

/** One reviewable row. A scan of a fridge shelf produces many of these. */
interface DetectedRow {
  id: string;
  name: string;
  category: FoodCategory;
  quantity: number;
  unit: string;
  expiryDate: string;
  confidence: number;
  include: boolean;
}

const UNITS = ['pcs', 'g', 'kg', 'ml', 'L', 'bag', 'can', 'bottle', 'pack', 'box'];
const LOW_CONFIDENCE = 0.6;

// The batch outlives navigation: the walkthrough's scan step routes away on resume, and
// a stray back-tap shouldn't discard a fridge's worth of scanning.
const BATCH_KEY = 'smart_pantry_scan_batch';
const BATCH_THUMB_KEY = 'smart_pantry_scan_thumb';

const loadBatch = (): DetectedRow[] => {
  try {
    const raw = sessionStorage.getItem(BATCH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const toRow = (result: ScanResult): DetectedRow => ({
  id: crypto.randomUUID(),
  name: result.name,
  category: result.category,
  quantity: result.quantity ?? 1,
  unit: result.unit ?? 'pcs',
  expiryDate: result.expiryDate ?? '',
  confidence: result.confidence,
  include: true,
});

const Scanner: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const waiting = useWaitMessage(isAnalyzing);
  const [detected, setDetected] = useState<DetectedRow[]>(loadBatch);
  const [photoCount, setPhotoCount] = useState(0);
  // persisted too — the component remounts when the tour resumes or you tab away,
  // and a batch that survives should keep its picture
  const [lastThumbnail, setLastThumbnail] = useState<string | null>(
    () => sessionStorage.getItem(BATCH_THUMB_KEY)
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const { notifyInteraction, isWalkthroughActive } = useWalkthrough();

  // keep the batch across navigation
  useEffect(() => {
    try {
      sessionStorage.setItem(BATCH_KEY, JSON.stringify(detected));
    } catch {
      /* not worth failing a scan over */
    }
  }, [detected]);

  const showResults = detected.length > 0;

  const startCamera = async () => {
    setError(null);
    try {
      // First try to get the rear camera (environment)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsStreamActive(true);
        }
      } catch (envError) {
        console.warn("Environment camera not found, trying fallback...", envError);
        // Fallback to any available video source (e.g., laptop webcam)
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsStreamActive(true);
        }
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setError("Could not access camera. Check permissions or try uploading a file.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreamActive(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      // Ensure video dimensions are valid
      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        setError("Camera not ready yet. Please wait a moment.");
        return;
      }

      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        
        const image = canvasRef.current.toDataURL('image/jpeg', 0.8);

        if (image.length < 1000) {
            setError("Image capture failed (empty data). Try again.");
            return;
        }

        setCapturedImage(image);
        stopCamera();
        processImage(image);
      }
    }
  };

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read that file'));
      reader.readAsDataURL(file);
    });

  // Several photos can be picked at once — a fridge rarely fits in one frame.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    stopCamera();

    for (const file of files) {
      try {
        const image = await readFile(file);
        setCapturedImage(image);
        await processImage(image);
      } catch {
        setError('Could not read one of those images.');
      }
    }
    e.target.value = '';   // let the same file be picked again
  };

  const processImage = async (base64: string) => {
    setIsAnalyzing(true);
    setError(null);
    setNotice(null);
    try {
      // A full-resolution photo is 500KB-3MB as base64 — over the request limit, and far
      // more than the model needs. Shrink before upload, and keep a small thumbnail.
      const { upload, thumbnail } = await prepareScanImage(base64);
      setLastThumbnail(thumbnail);
      try { sessionStorage.setItem(BATCH_THUMB_KEY, thumbnail); } catch { /* quota */ }

      const results = await analyzeImage(upload);
      setPhotoCount(n => n + 1);

      if (results.length === 0) {
        setNotice("Nothing recognisable in that photo. Try again, or add an item by hand.");
        return;
      }

      // Photographing the same shelf twice shouldn't produce two rows for one carton.
      //
      // This updater must stay PURE: it originally mutated rows carried over from `prev`
      // and called setNotice from inside, so React's double-invocation applied every
      // merge twice and one bottle of milk became two.
      let mergedCount = 0;
      setDetected(prev => {
        const next = prev.map(row => ({ ...row }));
        for (const result of results) {
          const key = result.name.trim().toLowerCase();
          const existing = next.find(r => r.name.trim().toLowerCase() === key);
          if (existing) {
            existing.quantity += result.quantity ?? 1;
          } else {
            next.push(toRow(result));
          }
        }
        return next;
      });

      mergedCount = results.filter(result =>
        detected.some(r => r.name.trim().toLowerCase() === result.name.trim().toLowerCase())
      ).length;

      setNotice(
        mergedCount > 0
          ? `Found ${results.length} item${results.length === 1 ? '' : 's'} — ${mergedCount} already in the list, so quantities were combined.`
          : `Found ${results.length} item${results.length === 1 ? '' : 's'}.`
      );
    } catch (err: any) {
      console.error(err);
      // the service now reports the real cause (too large, rate limited, server down)
      setError(err?.message || 'Scan failed. Try again or add the item by hand.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateRow = (id: string, patch: Partial<DetectedRow>) =>
    setDetected(rows => rows.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: string) => setDetected(rows => rows.filter(r => r.id !== id));

  const addBlankRow = () =>
    setDetected(rows => [...rows, {
      id: crypto.randomUUID(),
      name: '', category: FoodCategory.OTHER, quantity: 1, unit: 'pcs',
      expiryDate: '', confidence: 1, include: true,
    }]);

  const scanMore = () => {
    setCapturedImage(null);
    setError(null);
    setNotice(null);
    startCamera();
  };

  const clearBatch = () => {
    sessionStorage.removeItem(BATCH_THUMB_KEY);
    setLastThumbnail(null);
    setDetected([]);
    setPhotoCount(0);
    setNotice(null);
  };

  const included = detected.filter(r => r.include && r.name.trim());

  const handleSave = () => {
    if (included.length === 0) return;

    const items: PantryItem[] = included.map(row => ({
      id: crypto.randomUUID(),
      name: row.name.trim(),
      category: row.category,
      expiryDate: row.expiryDate || null,
      quantity: row.quantity,
      unit: row.unit,
      // was `.split('T')[0]` here but a full timestamp everywhere else
      addedDate: new Date().toISOString(),
      thumbnail: lastThumbnail ?? undefined,
    }));

    const result = saveItems(items);
    if (result.failed) {
      setError("There's no room left in this browser's storage. Remove some pantry items and try again.");
      return;
    }

    sessionStorage.removeItem(BATCH_KEY);
    sessionStorage.removeItem(BATCH_THUMB_KEY);
    if (isWalkthroughActive) notifyInteraction("[data-walkthrough='nav-scan']");
    navigate('/pantry');
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setError(null);
    startCamera();
  };

  return (
    <div className="h-screen bg-black flex flex-col relative text-white">
      {/* Header */}
      <div className="absolute top-0 w-full p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={() => navigate('/')} className="p-2 bg-white/20 rounded-full backdrop-blur-md">
           <X size={20} />
        </button>
        <h2 className="text-sm font-semibold tracking-wider">SMART SCANNER</h2>
        <div className="w-9" /> {/* Spacer */}
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {error && !capturedImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 p-6 text-center z-10">
            <AlertTriangleIcon size={48} className="text-red-500 mb-4" />
            <p className="mb-4">{error}</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { setError(null); startCamera(); }}
                className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg font-medium"
              >
                Retry Camera
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-green-600 rounded-lg font-medium"
              >
                Upload Image Instead
              </button>
            </div>
          </div>
        )}

        {!capturedImage && !error && (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="absolute inset-0 w-full h-full object-cover"
              onLoadedMetadata={() => setIsStreamActive(true)}
            />
            {/* Scan Overlay */}
            <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none z-10">
               <div className="w-full h-full border-2 border-green-400/50 relative">
                 <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500"></div>
                 <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500"></div>
                 <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500"></div>
                 <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500"></div>
               </div>
            </div>
            <p className="absolute bottom-32 z-20 text-center w-full text-white/80 text-sm">
              Align food item within frame
            </p>
          </>
        )}

        {capturedImage && (
          <div className="w-full h-full relative bg-gray-900">
             <img src={capturedImage} alt="Captured" className="w-full h-full object-contain opacity-50" />
             {isAnalyzing && (
               <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
                 <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-500 mb-4"></div>
                 <p className="text-green-400 font-mono text-sm animate-pulse">DETECTING OBJECTS...</p>
                 <p className="text-green-400 font-mono text-sm animate-pulse delay-75">READING DATES (OCR)...</p>
                 {waiting.message && (
                   <div className="mt-5 mx-6 px-4 py-3 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm max-w-[280px]">
                     <p className="text-xs font-semibold text-amber-300 leading-relaxed text-center">
                       {waiting.message}
                     </p>
                     <p className="text-[10px] text-amber-200/70 mt-1 font-medium text-center">
                       {waiting.elapsedSeconds}s elapsed
                     </p>
                   </div>
                 )}
               </div>
             )}
          </div>
        )}
        
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls / Results Panel */}
      <div className={`bg-white text-gray-900 transition-all duration-300 rounded-t-3xl z-30 ${showResults ? 'h-auto max-h-[85vh] overflow-y-auto' : 'h-32'}`}>
        
        {!capturedImage && !showResults && (
          <div className="flex justify-center items-center h-full space-x-8 pb-8">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-4 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              <Upload size={24} />
            </button>
            <button 
              onClick={capturePhoto} 
              className="w-20 h-20 rounded-full border-4 border-white bg-green-500 hover:bg-green-600 shadow-lg flex items-center justify-center transition-transform active:scale-95"
            >
              <Camera size={32} className="text-white" />
            </button>
            <div className="w-14"></div> {/* Spacer for balance */}
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*"
          multiple
          className="hidden" 
          onChange={handleFileUpload}
        />

        {showResults && !isAnalyzing && (
          <div className="p-5 space-y-4">
             <div className="flex justify-between items-center">
               <div>
                 <h3 className="text-xl font-bold text-gray-800">
                   {detected.length} item{detected.length === 1 ? '' : 's'} found
                 </h3>
                 <p className="text-xs text-gray-400 font-semibold">
                   {photoCount} photo{photoCount === 1 ? '' : 's'} · {included.length} selected
                 </p>
               </div>
               <button
                 onClick={() => {
                   const allOn = detected.every(r => r.include);
                   setDetected(rows => rows.map(r => ({ ...r, include: !allOn })));
                 }}
                 className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800"
               >
                 {detected.every(r => r.include) ? <CheckSquare size={16} className="text-green-500" /> : <Square size={16} />}
                 Select all
               </button>
             </div>

             {notice && (
               <p className="text-xs font-semibold text-green-700 bg-green-50 rounded-xl px-3 py-2">{notice}</p>
             )}
             {error && (
               <p className="text-xs font-semibold text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
             )}

             <div className="space-y-3">
               {detected.map(row => (
                 <div
                   key={row.id}
                   className={`rounded-2xl border p-3 transition-colors ${row.include ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}
                 >
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => updateRow(row.id, { include: !row.include })}
                       className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${row.include ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent'}`}
                       aria-label="Include this item"
                     >
                       <Check size={14} strokeWidth={4} />
                     </button>
                     <input
                       type="text"
                       value={row.name}
                       onChange={e => updateRow(row.id, { name: e.target.value })}
                       placeholder="Item name"
                       className="flex-1 min-w-0 font-bold text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-green-500 py-1"
                     />
                     <button
                       onClick={() => removeRow(row.id)}
                       className="p-1.5 text-gray-300 hover:text-red-500 flex-shrink-0"
                       aria-label="Remove"
                     >
                       <Trash2 size={16} />
                     </button>
                   </div>

                   {row.confidence < LOW_CONFIDENCE && (
                     <p className="text-[11px] text-amber-600 font-semibold flex items-center gap-1 mt-1.5 ml-8">
                       <AlertTriangle size={11} /> Not sure about this one — worth checking
                     </p>
                   )}

                   <div className="grid grid-cols-2 gap-2 mt-3 ml-8">
                     <select
                       value={row.category}
                       onChange={e => updateRow(row.id, { category: e.target.value as FoodCategory })}
                       className="text-sm p-2 rounded-lg bg-gray-100 border-none font-medium text-gray-700"
                     >
                       {Object.values(FoodCategory).map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     <div className="flex gap-1">
                       <input
                         type="number"
                         min={1}
                         value={row.quantity}
                         onChange={e => updateRow(row.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                         className="w-14 text-sm p-2 rounded-lg bg-gray-100 border-none text-center font-medium"
                       />
                       <select
                         value={row.unit}
                         onChange={e => updateRow(row.id, { unit: e.target.value })}
                         className="flex-1 min-w-0 text-sm p-2 rounded-lg bg-gray-100 border-none font-medium text-gray-700"
                       >
                         {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                       </select>
                     </div>
                   </div>

                   <div className="mt-2 ml-8">
                     <input
                       type="date"
                       value={row.expiryDate}
                       onChange={e => updateRow(row.id, { expiryDate: e.target.value })}
                       className="w-full text-sm p-2 rounded-lg bg-gray-100 border-none text-gray-700"
                     />
                     {!row.expiryDate && (
                       <p className="text-[11px] text-gray-400 mt-1">No expiry date read — add one if you know it</p>
                     )}
                   </div>
                 </div>
               ))}
             </div>

             <button
               onClick={addBlankRow}
               className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-bold text-sm flex items-center justify-center gap-2 hover:border-green-400 hover:text-green-600 transition-colors"
             >
               <Plus size={16} /> Add an item by hand
             </button>

             <div className="flex gap-3 pt-1 sticky bottom-0 bg-white pb-2">
               <button
                 onClick={scanMore}
                 className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2"
               >
                 <Camera size={18} /> Scan more
               </button>
               <button
                 onClick={handleSave}
                 disabled={included.length === 0}
                 className="flex-[2] py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 disabled:opacity-40 disabled:shadow-none"
               >
                 <Check size={18} /> Add {included.length} item{included.length === 1 ? '' : 's'}
               </button>
             </div>

             <button onClick={clearBatch} className="w-full text-xs font-bold text-gray-400 hover:text-gray-600 pb-2">
               Discard everything
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AlertTriangleIcon = ({size, className}: {size: number, className?: string}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
)

export default Scanner;