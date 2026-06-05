/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Camera, 
  X, 
  RefreshCw, 
  CheckCircle, 
  ShieldAlert, 
  QrCode, 
  Scan,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Session } from '../types';
import { attendanceTokenService } from '../supabase';

// ==========================================
// STUDENT VIEW: UNIQUE QR CODE GENERATED VIEW
// ==========================================
interface StudentQRPresenterProps {
  session: Session;
  token: string | null;
  onClose: () => void;
}

export function StudentQRPresenter({ session, token, onClose }: StudentQRPresenterProps) {
  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100 animate-fade-in">
      <div className="glass-panel max-w-sm w-full p-6 md:p-8 rounded-2xl relative flex flex-col items-center text-center bg-slate-950 border border-slate-930">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="w-12 h-12 rounded-xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <QrCode className="h-6 w-6" />
        </div>

        <h3 className="font-display font-extrabold text-lg text-white mb-1">My Attendance QR</h3>
        <p className="text-slate-400 text-[11px] mb-5 tracking-wide max-w-[250px]">
          Present this unique code to the instructor or scanning terminal.
        </p>

        {/* Unique Student QR */}
        <div className="bg-white p-5 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.15)] mb-5 transition-all duration-300 transform hover:scale-[1.01]">
          {token ? (
            <QRCodeSVG 
              value={token}
              size={180}
              level="H"
              includeMargin={false}
            />
          ) : (
            <div className="w-[180px] h-[180px] flex items-center justify-center font-bold text-slate-700 text-[11px] text-center bg-slate-100 rounded-xl">
              Generating secure attendance token...
            </div>
          )}
        </div>

        {/* Verification Token Display */}
        {token && (
          <div className="w-full bg-slate-900/80 border border-slate-800/80 p-2.5 rounded-xl text-center space-y-1 mb-5">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Verification Code
            </div>
            <div className="font-mono text-cyan-400 font-black text-sm tracking-widest selection:bg-cyan-500/20">
              {token}
            </div>
          </div>
        )}

        <p className="text-xs text-rose-450 font-bold mt-1 tracking-wide bg-rose-500/5 px-4.5 py-1.5 rounded-full border border-rose-500/10">
          "Your QR is valid only for this session."
        </p>

      </div>
    </div>
  );
}

// ==========================================
// CENTRAL QR SCANNER (WEBCAM OVERLAY)
// ==========================================
interface QRScannerModalProps {
  title?: string;
  subtitle?: string;
  onScanSuccess: (tokenString: string) => Promise<boolean>; // Returns true if verified
  onClose: () => void;
}

export function QRScannerModal({ 
  title = "Scan QR Code", 
  subtitle = "Align student QR code inside the box to check in",
  onScanSuccess, 
  onClose 
}: QRScannerModalProps) {
  const [cameraState, setCameraState] = useState<'pending' | 'granted' | 'denied' | 'unavailable'>('pending');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const qrRegionId = 'qr-webcam-element';
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  const startScanner = async () => {
    try {
      setCameraState('pending');
      setErrorMsg(null);
      setSuccessMsg(null);

      // Explicitly cleanup old scanner if there is any
      if (html5QrcodeRef.current) {
        try {
          if (html5QrcodeRef.current.isScanning) {
            await html5QrcodeRef.current.stop();
          }
        } catch (e) {}
        html5QrcodeRef.current = null;
      }

      // Check persisted permission state to prevent double prompts
      let permissionGranted = localStorage.getItem('smart_attendance_camera_access_granted') === 'true';

      try {
        if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as any });
          if (result.state === 'granted') {
            permissionGranted = true;
            localStorage.setItem('smart_attendance_camera_access_granted', 'true');
          } else if (result.state === 'denied') {
            permissionGranted = false;
            localStorage.setItem('smart_attendance_camera_access_granted', 'false');
          }
        }
      } catch (e) {
        console.warn("Permissions API check skipped:", e);
      }

      // Only prompt with explicit getUserMedia if we don't have recorded confirmation
      if (!permissionGranted && typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .catch(async () => {
              return await navigator.mediaDevices.getUserMedia({ video: true });
            });
          // Stop stream tracks so Html5Qrcode can bind to the device camera stream exclusively
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            localStorage.setItem('smart_attendance_camera_access_granted', 'true');
            permissionGranted = true;
          }
        } catch (err) {
          console.warn("Camera permission denied:", err);
          setErrorMsg("Camera permission denied. Please allow camera access and try again.");
          setCameraState('denied');
          localStorage.setItem('smart_attendance_camera_access_granted', 'false');
          return;
        }
      }

      // Verify availability
      const devices = await Html5Qrcode.getCameras().catch(() => []);
      if (!devices || devices.length === 0) {
        setErrorMsg("Camera not available on this device.");
        setCameraState('unavailable');
        return;
      }

      setCameraState('granted');
      
      // Delay scanner instance creation slightly to ensure container is fully visible and styled
      setTimeout(async () => {
        try {
          const scannerInstance = new Html5Qrcode(qrRegionId);
          html5QrcodeRef.current = scannerInstance;

          await scannerInstance.start(
            { facingMode: 'environment' },
            {
              fps: 12,
              qrbox: { width: 230, height: 230 },
            },
            (decodedText) => {
              localStorage.setItem('smart_attendance_camera_access_granted', 'true');
              handleScannedData(decodedText);
            },
            () => {
              // Silent frame fetch fails
            }
          ).catch((err) => {
            console.error("Scanner start error:", err);
            setErrorMsg("Camera permission denied. Please allow camera access and try again.");
            setCameraState('denied');
            localStorage.setItem('smart_attendance_camera_access_granted', 'false');
          });
        } catch (innerErr: any) {
          console.error("Failed to create scanner instance:", innerErr);
          setErrorMsg("Camera permission denied. Please allow camera access and try again.");
          setCameraState('denied');
          localStorage.setItem('smart_attendance_camera_access_granted', 'false');
        }
      }, 100);

    } catch (err) {
      console.error(err);
      setErrorMsg("Camera permission denied. Please allow camera access and try again.");
      setCameraState('denied');
      localStorage.setItem('smart_attendance_camera_access_granted', 'false');
    }
  };

  useEffect(() => {
    startScanner();

    return () => {
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          html5QrcodeRef.current.stop().then(() => {
            html5QrcodeRef.current = null;
          }).catch(err => console.error(err));
        } else {
          html5QrcodeRef.current = null;
        }
      }
    };
  }, []);

  const handleScannedData = async (txt: string) => {
    if (!txt) return;
    try {
      // Clear messages
      setErrorMsg(null);

      // Stop scanning instantly to prevent dual hits
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().catch(e => console.error(e));
      }

      setSuccessMsg("Verifying verification credentials...");
      
      const isOk = await onScanSuccess(txt);
      if (isOk) {
        setSuccessMsg("Attendance Verified Successfully");
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setSuccessMsg(null);
        setErrorMsg("Failed to verify. Session ended or QR code invalid.");
        // restart scanner if failed after 3 seconds
        setTimeout(() => {
          startScanner();
        }, 3000);
      }

    } catch (err: any) {
      setSuccessMsg(null);
      setErrorMsg(err.message || 'Verification Error occurred.');
      setTimeout(() => {
        startScanner();
      }, 3000);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg("Verifying manual token...");

      const isOk = await onScanSuccess(manualToken.trim());
      if (isOk) {
        setSuccessMsg("Attendance Verified Successfully");
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setSuccessMsg(null);
        setErrorMsg("Invalid, expired, or deactivated attendance token.");
      }
    } catch (err: any) {
      setSuccessMsg(null);
      setErrorMsg(err.message || 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-100 animate-fade-in">
      <div className="glass-panel max-w-md w-full p-6 rounded-2xl relative flex flex-col items-center bg-slate-950 border border-slate-900">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
          <Scan className="h-5 w-5" />
        </div>

        <h3 className="font-display font-extrabold text-lg text-white mb-0.5">{title}</h3>
        <p className="text-slate-400 text-[11px] text-center mb-5 max-w-[280px]">
          {subtitle}
        </p>

        {/* FEEDBACK BANNERS */}
        {errorMsg && (
          <div className="w-full bg-rose-500/10 text-rose-400 border border-rose-500/15 p-3 rounded-xl text-xs mb-4 flex items-start space-x-2.5">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-rose-455 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="w-full bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 p-3.5 rounded-xl text-xs mb-4 flex items-center space-x-2.5">
            {successMsg === "Attendance Verified Successfully" ? (
              <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400 animate-bounce" />
            ) : (
              <RefreshCw className="h-4 w-4 shrink-0 text-emerald-400 animate-spin" />
            )}
            <div>
              <span className="font-bold block">{successMsg}</span>
              {successMsg === "Attendance Verified Successfully" && (
                <span className="text-[10px] text-slate-400 mt-0.5 block">Your attendance has been recorded.</span>
              )}
            </div>
          </div>
        )}

        {/* CAMERA DENIED SCREEN */}
        {cameraState === 'denied' && !showManualInput && (
          <div className="w-full py-6 px-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-center space-y-4 mb-4">
            <XCircle className="h-10 w-10 text-rose-450 mx-auto" />
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm font-display">Camera Access Required</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Camera permission denied. Please allow camera access and try again.
              </p>
              <p className="text-[10px] text-slate-500 leading-normal">
                Allow camera access to scan student attendance QR codes.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button 
                onClick={startScanner}
                className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-45 transition-all text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
              >
                Enable Camera
              </button>
              <button 
                onClick={() => setShowManualInput(true)}
                className="w-full py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-350 transition-all font-semibold rounded-xl text-xs cursor-pointer"
              >
                Enter Attendance Token Instead
              </button>
            </div>
          </div>
        )}

        {/* CAMERA UNAVAILABLE SCREEN */}
        {cameraState === 'unavailable' && !showManualInput && (
          <div className="w-full py-6 px-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-center space-y-4 mb-4">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm font-display">Camera Not Available</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Camera not available on this device.
              </p>
              <p className="text-[10px] text-slate-500 leading-normal">
                You can still verify attendance using the student's attendance token.
              </p>
            </div>
            <button 
              onClick={() => setShowManualInput(true)}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 transition-all text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              Enter Attendance Token
            </button>
          </div>
        )}

        {/* ACTIVE WEBCAM BUFFER (ALWAYS MOUNTED WHEN NO MANUAL INPUT TO BE TARGETED BY HTML5QRCODE) */}
        {!showManualInput && (
          <div className={`w-full aspect-square rounded-2xl overflow-hidden bg-slate-950 border border-slate-900/80 bg-slate-900/60 relative mb-4 ${cameraState === 'granted' ? 'block' : 'hidden'}`}>
            <div id={qrRegionId} className="w-full h-full" />
            <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)] z-10" />
          </div>
        )}

        {/* CAMERA ACQUIRING SYSTEM BUFFER */}
        {cameraState === 'pending' && !showManualInput && (
          <div className="w-full aspect-square flex flex-col items-center justify-center p-8 bg-slate-900/40 border border-slate-900 rounded-2xl mb-4 animate-pulse">
            <RefreshCw className="h-7 w-7 text-cyan-450 animate-spin mb-3" />
            <span className="text-slate-500 text-[11px] tracking-wide font-mono">Initializing device lenses...</span>
          </div>
        )}

        {/* MANUAL UNIQUE CODE FALLBACK FORM */}
        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="w-full space-y-4 mb-2">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                Enter Your Secure, Unique QR Code Token
              </label>
              <input
                type="text"
                required
                placeholder="e.g. TOKEN-SESS-STUD-XXXXXX"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="w-full bg-slate-900 text-white font-mono tracking-wide rounded-xl border border-slate-800 focus:border-cyan-500 px-4 py-3 placeholder:text-slate-600 text-xs text-center"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowManualInput(false);
                  if (cameraState !== 'unavailable') {
                    startScanner();
                  }
                }}
                className="w-1/3 py-2.5 rounded-xl border border-slate-850 hover:bg-slate-900 text-slate-400 font-semibold text-xs transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-2/3 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-450 text-slate-950 font-bold block text-xs hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] transition-all cursor-pointer"
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  <span>Verify and Mark Attendance</span>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
