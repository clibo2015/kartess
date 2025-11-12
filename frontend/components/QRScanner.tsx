import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import Button from './Button';
import PresetSelectionModal from './PresetSelectionModal';
import { qrAPI } from '../lib/api';
import { getUser } from '../lib/auth';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export default function QRScanner({ isOpen, onClose, onSuccess }: QRScannerProps) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerIdRef = useRef<string>('qr-scanner');

  // Reset scanning state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScanning(true);
      setError(null);
      setPresetModalOpen(false);
      setScannedToken(null);
    }
  }, [isOpen]);

  // Handle QR code scan - defined before useEffect that uses it
  const handleScan = useCallback(async (decodedText: string) => {
    try {
      let token: string | null = null;

      // Try to parse as URL first (new format for external scanners)
      try {
        const url = new URL(decodedText);
        const qrTokenParam = url.searchParams.get('qr_token');
        if (qrTokenParam && (url.pathname.includes('/register') || url.pathname === '/')) {
          token = qrTokenParam;
        }
      } catch (urlError) {
        // Not a URL, try parsing as JSON (old format for backward compatibility)
        try {
          const qrData = JSON.parse(decodedText);
          if (qrData.type === 'kartess_contact' && qrData.token) {
            token = qrData.token;
          }
        } catch (jsonError) {
          // Neither URL nor JSON - invalid format
          setError('Invalid QR code format. Please scan a valid Kartess QR code.');
          return;
        }
      }

      if (!token) {
        setError('Invalid QR code - token not found. Please scan a valid Kartess QR code.');
        return;
      }

      // Stop scanning immediately to prevent multiple scans
      setScanning(false);
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch((err: any) => {
            console.warn('Error clearing scanner after scan:', err);
          });
        } catch (err) {
          console.warn('Error clearing scanner after scan:', err);
        }
        scannerRef.current = null;
      }

      setValidating(true);
      setError(null);

      // Validate token first (check if user needs signup)
      const validation = await qrAPI.validate(token);

      if (!validation.valid) {
        setError(validation.error || 'Invalid QR code. The QR code may have expired or already been used.');
        setValidating(false);
        // Allow retry
        setScanning(true);
        return;
      }

      // Check if user is authenticated
      const currentUser = getUser();

      if (!currentUser) {
        // User not authenticated - redirect to signup with QR token
        setValidating(false);
        onClose();
        router.push(`/register?qr_token=${encodeURIComponent(token)}`);
        return;
      }

      // User is authenticated - show preset selection modal
      setScannedToken(token);
      setPresetModalOpen(true);
      setValidating(false);
    } catch (err: any) {
      console.error('Scan error:', err);
      setValidating(false);
      
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.message?.includes('Invalid QR code')) {
        setError('Invalid QR code format. Please scan a valid Kartess QR code.');
      } else {
        setError('Failed to process QR code. Please try again.');
      }
      // Allow retry
      setScanning(true);
    }
  }, [router, onClose]);

  useEffect(() => {
    if (!isOpen || !scanning) {
      // Cleanup scanner when modal closes
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch((err: any) => {
            console.warn('Error clearing scanner:', err);
          });
        } catch (err) {
          console.warn('Error clearing scanner:', err);
        }
        scannerRef.current = null;
      }
      return;
    }

    // Wait for DOM element to be available
    const initScanner = async () => {
      // Check if element exists
      const scannerElement = document.getElementById(scannerIdRef.current);
      if (!scannerElement) {
        // Retry after a short delay
        setTimeout(initScanner, 100);
        return;
      }

      try {
        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Camera access is not available in this browser. Please use a modern browser with camera support.');
          setScanning(false);
          return;
        }

        // Request camera permission explicitly before initializing scanner
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment', // Prefer back camera on mobile
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          });
          // Stop the test stream immediately - we just needed permission
          stream.getTracks().forEach((track) => track.stop());
        } catch (permError: any) {
          console.error('Camera permission error:', permError);
          if (permError.name === 'NotAllowedError' || permError.name === 'PermissionDeniedError') {
            setError('Camera permission was denied. Please enable camera access in your browser settings and try again.');
          } else if (permError.name === 'NotFoundError' || permError.name === 'DevicesNotFoundError') {
            setError('No camera found. Please ensure a camera is connected and try again.');
          } else if (permError.name === 'NotReadableError' || permError.name === 'TrackStartError') {
            setError('Camera is already in use by another application. Please close other apps using the camera and try again.');
          } else {
            setError(`Camera access error: ${permError.message || 'Unknown error'}. Please check your camera settings.`);
          }
          setScanning(false);
          return;
        }

        // Small delay to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify element still exists
        const element = document.getElementById(scannerIdRef.current);
        if (!element) {
          setError('Scanner element not found. Please try again.');
          setScanning(false);
          return;
        }

        // Clear any existing content in the element
        element.innerHTML = '';

        // Initialize scanner after permission is granted
        const scanner = new Html5QrcodeScanner(
          scannerIdRef.current,
          {
            qrbox: { width: 250, height: 250 },
            fps: 10,
            aspectRatio: 1.0,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            showZoomSliderIfSupported: true,
            showTorchButtonIfSupported: true,
          },
          false // verbose
        );

        scanner.render(
          (decodedText) => {
            // QR code scanned successfully
            handleScan(decodedText);
          },
          (errorMessage) => {
            // Scanner is running, ignore minor errors
            // Only log if it's a significant error
            if (errorMessage && !errorMessage.includes('NotFoundException') && !errorMessage.includes('No MultiFormat Readers')) {
              console.debug('QR scanner:', errorMessage);
            }
          }
        );

        scannerRef.current = scanner;
      } catch (error: any) {
        console.error('Scanner initialization error:', error);
        setError(`Failed to initialize camera scanner: ${error.message || 'Unknown error'}. Please try again.`);
        setScanning(false);
      }
    };

    // Start initialization with a small delay to ensure modal is rendered
    const timeoutId = setTimeout(initScanner, 200);

    return () => {
      clearTimeout(timeoutId);
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch((err: any) => {
            console.warn('Error clearing scanner on cleanup:', err);
          });
        } catch (err) {
          console.warn('Error clearing scanner on cleanup:', err);
        }
        scannerRef.current = null;
      }
    };
  }, [isOpen, scanning, handleScan]);

  const handlePresetSelect = async (presetName: 'personal' | 'professional' | 'custom') => {
    if (!scannedToken) return;

    try {
      setValidating(true);
      setError(null);

      // Consume token with selected preset
      const result = await qrAPI.consume(scannedToken, presetName);

      // Success
      setPresetModalOpen(false);
      setScannedToken(null);
      setValidating(false);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      console.error('Consume error:', err);
      setValidating(false);
      
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to process QR code. Please try again.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom">
      <div className="bg-white rounded-lg w-full max-w-md p-6 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Scan QR Code</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        <div id={scannerIdRef.current} className="mb-4"></div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          {error && (
            <Button
              variant="primary"
              onClick={() => {
                setError(null);
                // Restart scanner
                if (scannerRef.current) {
                  scannerRef.current.clear();
                  scannerRef.current = null;
                }
                // Re-trigger useEffect by setting scanning to false then true
                setError(null);
                setScanning(false);
                setTimeout(() => setScanning(true), 100);
              }}
              className="flex-1"
            >
              Retry
            </Button>
          )}
        </div>

        {validating && (
          <div className="mt-4 text-white text-center">
            <p>Processing QR code...</p>
          </div>
        )}

        <p className="text-xs text-gray-500 text-center mt-4">
          Position the QR code within the frame
        </p>
      </div>
      <PresetSelectionModal
        isOpen={presetModalOpen}
        onClose={() => {
          setPresetModalOpen(false);
          setScannedToken(null);
          // Resume scanning if modal is closed
          setScanning(true);
        }}
        onSelect={handlePresetSelect}
        title="Select Preset"
        description="Choose which information you want to share with this contact:"
      />
    </div>
  );
}
