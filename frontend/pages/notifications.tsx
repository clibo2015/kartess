import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import NotificationsPanel from '../components/NotificationsPanel';
import NotificationsBell from '../components/NotificationsBell';

export default function Notifications() {
  const [notificationsOpen, setNotificationsOpen] = useState(true);

  return (
    <Layout title="Notifications - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            </div>
            <NotificationsPanel
              isOpen={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
            />
          </div>
        </div>
        <BottomNav />
      </Layout>
  );
}

