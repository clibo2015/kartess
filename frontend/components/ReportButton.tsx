import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Button from './Button';

interface ReportButtonProps {
  targetType: 'post' | 'comment' | 'user' | 'thread' | 'job';
  targetId: string;
  onSuccess?: () => void;
}

export default function ReportButton({ targetType, targetId, onSuccess }: ReportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState<'spam' | 'harassment' | 'inappropriate' | 'fake' | 'other'>(
    'spam'
  );
  const [description, setDescription] = useState('');

  const reportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to submit report');
      return res.json();
    },
    onSuccess: () => {
      setShowModal(false);
      setDescription('');
      alert('Report submitted successfully. Thank you for helping keep our community safe.');
      if (onSuccess) onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reportMutation.mutate({
      target_type: targetType,
      target_id: targetId,
      reason,
      description: description.trim() || undefined,
    });
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs text-gray-500 hover:text-red-600"
      >
        ⚠️ Report
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Report Content</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for reporting
                </label>
                <select
                  value={reason}
                  onChange={(e) =>
                    setReason(
                      e.target.value as 'spam' | 'harassment' | 'inappropriate' | 'fake' | 'other'
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="spam">Spam</option>
                  <option value="harassment">Harassment</option>
                  <option value="inappropriate">Inappropriate Content</option>
                  <option value="fake">Fake Account/Information</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Details (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Please provide more details..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false);
                    setDescription('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={reportMutation.isPending}
                  className="flex-1 bg-red-600"
                >
                  Submit Report
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
