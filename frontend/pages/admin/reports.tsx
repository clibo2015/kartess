import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import LoadingSpinner from '../../components/LoadingSpinner';
import Button from '../../components/Button';
import { getUser } from '../../lib/auth';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function AdminReports() {
  const router = useRouter();
  const currentUser = getUser();
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['adminReports', selectedStatus],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/reports?status=${selectedStatus}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch reports');
      return res.json();
    },
    enabled: currentUser?.role === 'admin' || currentUser?.role === 'moderator',
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, status, action_taken }: any) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/reports/${reportId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ status, action_taken }),
        }
      );
      if (!res.ok) throw new Error('Failed to update report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
    },
  });

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'moderator')) {
    return null;
  }

  const reports = data?.reports || [];

  return (
    <Layout title="Reports - Admin">
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Content Reports</h1>
              <Button variant="secondary" onClick={() => router.back()}>
                Back
              </Button>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              {['pending', 'reviewed', 'resolved', 'dismissed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`px-3 py-1 rounded text-sm capitalize ${
                    selectedStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No {selectedStatus} reports</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report: any) => (
                  <div
                    key={report.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          Reported {report.target_type}: {report.target_id}
                        </p>
                        <p className="text-sm text-gray-500">
                          By {report.reporter.full_name || report.reporter.username}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs capitalize ${
                          report.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : report.status === 'resolved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm font-medium text-gray-700">Reason:</p>
                      <p className="text-sm text-gray-900 capitalize">{report.reason}</p>
                      {report.description && (
                        <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                      )}
                    </div>

                    {selectedStatus === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          onClick={() =>
                            updateReportMutation.mutate({
                              reportId: report.id,
                              status: 'resolved',
                              action_taken: 'none',
                            })
                          }
                          disabled={updateReportMutation.isPending}
                          className="flex-1 bg-green-600"
                        >
                          Resolve
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            updateReportMutation.mutate({
                              reportId: report.id,
                              status: 'dismissed',
                              action_taken: 'none',
                            })
                          }
                          disabled={updateReportMutation.isPending}
                          className="flex-1"
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <BottomNav />
      </Layout>
  );
}
