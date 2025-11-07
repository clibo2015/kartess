import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import BottomNav from '../../components/BottomNav';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getUser } from '../../lib/auth';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Link from 'next/link';
import Button from '../../components/Button';

export default function AdminDashboard() {
  const router = useRouter();
  const currentUser = getUser();

  // Check if user is admin (this should be verified server-side)
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'moderator') {
      router.push('/home');
    }
  }, [currentUser, router]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/stats`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: currentUser?.role === 'admin' || currentUser?.role === 'moderator',
  });

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'moderator')) {
    return null;
  }

  return (
    <Layout title="Admin Dashboard - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Role: {currentUser.role}</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="px-4 py-6 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats?.users?.total || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats?.users?.active || 0} active
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">Pending Reports</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {stats?.moderation?.pendingReports || 0}
                  </p>
                  <Link
                    href="/admin/reports"
                    className="text-xs text-blue-600 hover:text-blue-700 mt-1 block"
                  >
                    View Reports →
                  </Link>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">Total Posts</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats?.content?.posts || 0}
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">Open Jobs</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats?.content?.jobs || 0}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/admin/users">
                    <Button variant="secondary" className="w-full">
                      Manage Users
                    </Button>
                  </Link>
                  <Link href="/admin/reports">
                    <Button variant="secondary" className="w-full">
                      Review Reports
                    </Button>
                  </Link>
                  {currentUser.role === 'admin' && (
                    <>
                      <Link href="/admin/analytics">
                        <Button variant="secondary" className="w-full">
                          View Analytics
                        </Button>
                      </Link>
                      <Link href="/admin/content">
                        <Button variant="secondary" className="w-full">
                          Content Moderation
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Signups</h2>
                <p className="text-sm text-gray-600">
                  {stats?.users?.recentSignups || 0} new users in the last 7 days
                </p>
              </div>
            </div>
          )}
        </div>

        <BottomNav />
      </Layout>
  );
}
