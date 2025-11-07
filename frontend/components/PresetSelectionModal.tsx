import { useState } from 'react';
import Button from './Button';

interface PresetSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (presetName: 'personal' | 'professional' | 'custom') => void;
  title?: string;
  description?: string;
}

export default function PresetSelectionModal({
  isOpen,
  onClose,
  onSelect,
  title = 'Select Preset',
  description = 'Choose which information you want to share with this contact:',
}: PresetSelectionModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<'personal' | 'professional' | 'custom' | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedPreset) {
      onSelect(selectedPreset);
      setSelectedPreset(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-top safe-area-bottom">
      <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            {description && (
              <p className="text-sm text-gray-500 mt-1">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-3">
          <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="preset"
              value="personal"
              checked={selectedPreset === 'personal'}
              onChange={() => setSelectedPreset('personal')}
              className="mt-1 w-4 h-4 text-blue-600"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Personal</div>
              <div className="text-xs text-gray-500 mt-1">
                Share personal information: name, email, phone, bio, handles
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="preset"
              value="professional"
              checked={selectedPreset === 'professional'}
              onChange={() => setSelectedPreset('professional')}
              className="mt-1 w-4 h-4 text-blue-600"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Professional</div>
              <div className="text-xs text-gray-500 mt-1">
                Share professional information: name, company, position, education
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="preset"
              value="custom"
              checked={selectedPreset === 'custom'}
              onChange={() => setSelectedPreset('custom')}
              className="mt-1 w-4 h-4 text-blue-600"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Custom</div>
              <div className="text-xs text-gray-500 mt-1">
                Share custom selection based on your preset configuration
              </div>
            </div>
          </label>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedPreset}
              className="flex-1"
            >
              Confirm
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
