import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import Logo from '../../components/Logo';
import { presetsAPI } from '../../lib/api';

interface PresetFields {
  email?: boolean;
  phone?: boolean;
  company?: boolean;
  position?: boolean;
  education?: boolean;
  bio?: boolean;
  handles?: boolean;
  avatar?: boolean;
}

interface Presets {
  personal?: PresetFields;
  professional?: PresetFields;
  custom?: PresetFields;
}

export default function VisibilityPresets() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editingPreset, setEditingPreset] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['presets'],
    queryFn: () => presetsAPI.getPresets(),
  });

  const updateMutation = useMutation({
    mutationFn: (presets: Presets) => presetsAPI.updatePresets(presets),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presets'] });
      setEditingPreset(null);
    },
  });

  const presets: Presets = data?.presets || {
    personal: {
      email: true,
      phone: true,
      bio: true,
      handles: true,
    },
    professional: {
      email: true,
      company: true,
      position: true,
      education: true,
      bio: true,
      handles: true,
    },
    custom: {
      email: false,
      phone: false,
      company: false,
      position: false,
      education: false,
      bio: true,
      handles: true,
    },
  };

  const presetFields: Array<{ key: keyof PresetFields; label: string }> = [
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'company', label: 'Company' },
    { key: 'position', label: 'Position' },
    { key: 'education', label: 'Education' },
    { key: 'bio', label: 'Bio' },
    { key: 'handles', label: 'Handles' },
    { key: 'avatar', label: 'Avatar' },
  ];

  const handleToggle = (presetName: string, field: keyof PresetFields) => {
    const updatedPresets = {
      ...presets,
      [presetName]: {
        ...presets[presetName as keyof Presets],
        [field]: !presets[presetName as keyof Presets]?.[field],
      },
    };
    updateMutation.mutate(updatedPresets);
  };

  if (isLoading) {
    return (
      <Layout title="Visibility Presets - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <BottomNav />
      </Layout>
    );
  }

  return (
    <Layout title="Visibility Presets - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.back()}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <span className="text-xl">←</span>
              </button>
              <Logo size="sm" showText={false} onClick={() => {}} />
              <h1 className="text-2xl font-bold text-gray-900">Visibility Presets</h1>
            </div>
            <p className="text-sm text-gray-500">
              Control what information you share with contacts
            </p>
          </div>

          <div className="px-4 py-4 space-y-6">
            {(['personal', 'professional', 'custom'] as const).map((presetName) => (
              <div key={presetName} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 capitalize">
                      {presetName} Preset
                    </h2>
                    <p className="text-sm text-gray-500">
                      {presetName === 'personal'
                        ? 'For friends and family'
                        : presetName === 'professional'
                        ? 'For business contacts'
                        : 'Custom sharing preferences'}
                    </p>
                  </div>
                  <Button
                    variant={editingPreset === presetName ? 'primary' : 'outline'}
                    onClick={() =>
                      setEditingPreset(editingPreset === presetName ? null : presetName)
                    }
                    className="text-sm"
                  >
                    {editingPreset === presetName ? 'Done' : 'Edit'}
                  </Button>
                </div>

                <div className="space-y-2">
                  {presetFields.map((field) => (
                    <label
                      key={field.key}
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <span className="text-gray-700">{field.label}</span>
                      <input
                        type="checkbox"
                        checked={
                          presets[presetName as keyof Presets]?.[field.key] || false
                        }
                        onChange={() => handleToggle(presetName, field.key)}
                        disabled={editingPreset !== presetName}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <BottomNav />
      </Layout>
  );
}

