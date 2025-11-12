import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import { qrAPI, presetsAPI } from '../lib/api';

interface QRGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QRGenerator({ isOpen, onClose }: QRGeneratorProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('personal');
  const [qrToken, setQrToken] = useState<string | null>(null);

  const { data: presetsData } = useQuery({
    queryKey: ['presets'],
    queryFn: () => presetsAPI.getPresets(),
  });

  const generateMutation = useMutation({
    mutationFn: (presetName: string) => qrAPI.generate(presetName),
    onSuccess: (data) => {
      console.log('QR generation success:', data);
      if (data && data.token) {
        setQrToken(data.token);
      } else {
        console.error('QR generation: Invalid response format', data);
        alert('Failed to generate QR code: Invalid response from server');
      }
    },
    onError: (error: any) => {
      console.error('QR generation error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to generate QR code';
      alert(errorMessage);
    },
  });

  if (!isOpen) return null;

  const presets = presetsData?.presets || {};
  const presetNames = Object.keys(presets);

  const handleGenerate = () => {
    generateMutation.mutate(selectedPreset);
  };

  // Generate QR code with URL format for external scanners
  // Format: https://domain.com/register?qr_token=TOKEN
  // This works for both external scanners (redirects to register page) and internal scanner (can parse URL)
  const getFrontendUrl = () => {
    if (typeof window !== 'undefined') {
      // Try to get from environment variable first
      const envUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
      if (envUrl) return envUrl;
      
      // Fallback to current origin
      return window.location.origin;
    }
    // Server-side fallback
    return process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://kartess.com';
  };

  const qrValue = qrToken
    ? `${getFrontendUrl()}/register?qr_token=${encodeURIComponent(qrToken)}`
    : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Share QR Code</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {!qrToken ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Preset
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {presetNames.map((name) => (
                    <option key={name} value={name}>
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                variant="primary"
                onClick={handleGenerate}
                loading={generateMutation.isPending}
                disabled={!presetsData || presetNames.length === 0}
                className="w-full"
              >
                {generateMutation.isPending ? 'Generating...' : 'Generate QR Code'}
              </Button>
              {!presetsData && (
                <p className="text-xs text-gray-500 mt-2 text-center">Loading presets...</p>
              )}
              {presetsData && presetNames.length === 0 && (
                <p className="text-xs text-red-500 mt-2 text-center">
                  No presets available. Please configure your visibility presets first.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col items-center mb-4">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 mb-4">
                  <QRCodeSVG value={qrValue} size={256} />
                </div>
                <p className="text-sm text-gray-600 text-center">
                  Scan this QR code to add me as a contact
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Expires in 24 hours
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setQrToken(null);
                    generateMutation.reset();
                  }}
                  className="flex-1"
                >
                  New QR
                </Button>
                <Button variant="primary" onClick={onClose} className="flex-1">
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
