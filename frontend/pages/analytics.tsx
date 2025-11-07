import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import LoadingSpinner from '../components/LoadingSpinner';
import { getUser } from '../lib/auth';

export default function UserAnalytics() {
  const currentUser = getUser();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['userAnalytics'],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/${currentUser?.username}/analytics`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
    enabled: !!currentUser,
  });

  return (
    <Layout title="Analytics - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <h1 className="text-2xl font-bold text-gray-900">Your Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Insights into your activity</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="px-4 py-6 space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">Total Posts</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analytics?.posts?.total || 0}
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">Total Reactions</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analytics?.reactions?.total || 0}
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">Total Comments</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analytics?.comments?.total || 0}
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">Connections</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analytics?.contacts?.total || 0}
                  </p>
                </div>
              </div>

              {/* Engagement Stats */}
              {analytics?.engagement && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Engagement</h2>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">Average Reactions per Post</span>
                        <span className="text-sm font-medium text-gray-900">
                          {analytics.engagement.avgReactions?.toFixed(1) || 0}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">Average Comments per Post</span>
                        <span className="text-sm font-medium text-gray-900">
                          {analytics.engagement.avgComments?.toFixed(1) || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {analytics?.recentActivity && analytics.recentActivity.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
                  <div className="space-y-2">
                    {analytics.recentActivity.map((activity: any, idx: number) => (
                      <div key={idx} className="text-sm text-gray-600">
                        {activity.action} - {new Date(activity.created_at).toLocaleDateString()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <BottomNav />
      </Layout>
  );
}
