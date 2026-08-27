import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, Check, RefreshCw, Zap, Upload } from 'lucide-react';
import { analyzeImage } from '../services/geminiService';
import { saveItem } from '../services/storageService';
import { FoodCategory, PantryItem, ScanResult } from '../types';
import { useNavigate } from 'react-router-dom';
import { useWaitMessage } from '../hooks/useWaitMessage';

const Scanner: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const waiting = useWaitMessage(isAnalyzing);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Manual Entry Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<FoodCategory>(FoodCategory.OTHER);
  const [formDate, setFormDate] = useState('');
  const [formQty, setFormQty] = useState(1);

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
        
        // Convert to data URL
        const image = canvasRef.current.toDataURL('image/jpeg', 0.8);
        
        // Basic validation
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const image = reader.result as string;
        setCapturedImage(image);
        stopCamera();
        processImage(image);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeImage(base64);
      setScanResult(result);
      
      // Pre-fill form
      setFormName(result.name);
      setFormCategory(result.category);
      setFormDate(result.expiryDate || '');
      setFormQty(1);

    } catch (err) {
      console.error(err);
      setError("AI analysis failed. Please try again or enter manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = () => {
    const newItem: PantryItem = {
      id: crypto.randomUUID(),
      name: formName,
      category: formCategory,
      expiryDate: formDate || null,
      quantity: formQty,
      unit: 'pcs',
      addedDate: new Date().toISOString().split('T')[0],
      thumbnail: capturedImage || undefined
    };
    saveItem(newItem);
    navigate('/pantry');
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setScanResult(null);
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
      <div className={`bg-white text-gray-900 transition-all duration-300 rounded-t-3xl z-30 ${scanResult ? 'h-auto max-h-[85vh] overflow-y-auto' : 'h-32'}`}>
        
        {!capturedImage && (
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
          className="hidden" 
          onChange={handleFileUpload}
        />

        {scanResult && !isAnalyzing && (
          <div className="p-6 space-y-4">
             <div className="flex justify-between items-start">
               <h3 className="text-xl font-bold text-gray-800">Scan Results</h3>
               <span className={`px-2 py-1 rounded text-xs font-bold ${scanResult.confidence > 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                 {Math.round(scanResult.confidence * 100)}% Confidence
               </span>
             </div>

             <div className="space-y-4">
               <div>
                 <label className="block text-xs font-medium text-gray-500 mb-1">Product Name</label>
                 <input 
                   type="text" 
                   value={formName} 
                   onChange={(e) => setFormName(e.target.value)}
                   className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-lg font-medium" 
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                    <select 
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as FoodCategory)}
                      className="w-full p-3 border border-gray-200 rounded-lg outline-none bg-white"
                    >
                      {Object.values(FoodCategory).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                    <div className="flex items-center border border-gray-200 rounded-lg">
                      <button onClick={() => setFormQty(Math.max(1, formQty - 1))} className="p-3 text-gray-500">-</button>
                      <input 
                        type="number" 
                        value={formQty}
                        onChange={(e) => setFormQty(parseInt(e.target.value) || 1)}
                        className="w-full text-center outline-none" 
                      />
                      <button onClick={() => setFormQty(formQty + 1)} className="p-3 text-gray-500">+</button>
                    </div>
                  </div>
               </div>

               <div>
                 <label className="block text-xs font-medium text-gray-500 mb-1">Expiration Date</label>
                 <div className="relative">
                   <input 
                     type="date" 
                     value={formDate} 
                     onChange={(e) => setFormDate(e.target.value)}
                     className={`w-full p-3 border rounded-lg outline-none ${!formDate ? 'border-red-300 text-red-500' : 'border-gray-200'}`} 
                   />
                   {!scanResult.expiryDate && (
                     <p className="text-xs text-orange-500 mt-1 flex items-center">
                       <AlertTriangleIcon size={12} className="mr-1" /> Not detected automatically
                     </p>
                   )}
                 </div>
               </div>
             </div>

             <div className="flex gap-3 pt-4">
               <button 
                 onClick={handleRetake} 
                 className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium flex items-center justify-center gap-2"
               >
                 <RefreshCw size={18} /> Retake
               </button>
               <button 
                 onClick={handleSave} 
                 className="flex-[2] py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 shadow-lg shadow-green-200"
               >
                 <Check size={18} /> Save Item
               </button>
             </div>
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