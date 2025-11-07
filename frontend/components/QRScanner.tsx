import { useState, useRef, useEffect } from 'react';
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

  useEffect(() => {
    if (!isOpen || !scanning) {
      // Cleanup scanner when modal closes
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
      return;
    }

    // Request camera permission before initializing scanner
    const initScanner = async () => {
      try {
        // Request camera permission explicitly
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Stop the test stream immediately - we just needed permission
        stream.getTracks().forEach((track) => track.stop());

        // Initialize scanner after permission is granted
        const scanner = new Html5QrcodeScanner(
          scannerIdRef.current,
          {
            qrbox: { width: 250, height: 250 },
            fps: 5,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          },
          false
        );

        scanner.render(
          (decodedText) => {
            // QR code scanned
            handleScan(decodedText);
          },
          (errorMessage) => {
            // Error handling is done in onScanFailure callback
          }
        );

        scannerRef.current = scanner;
      } catch (error: any) {
        console.error('Camera permission error:', error);
        setError('Camera permission is required to scan QR codes. Please enable camera access in your browser settings.');
        setScanning(false);
      }
    };

    initScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [isOpen, scanning]);

  const handleScan = async (decodedText: string) => {
    try {
      // Parse QR code data
      const qrData = JSON.parse(decodedText);

      if (qrData.type !== 'kartess_contact' || !qrData.token) {
        setError('Invalid QR code');
        return;
      }

      // Stop scanning
      setScanning(false);
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }

      const token = qrData.token;
      setValidating(true);
      setError(null);

      // Validate token first (check if user needs signup)
      const validation = await qrAPI.validate(token);

      if (!validation.valid) {
        setError(validation.error || 'Invalid QR code');
        setValidating(false);
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
        setError('Invalid QR code format');
      } else {
        setError('Failed to process QR code. Please try again.');
      }
    }
  };

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
