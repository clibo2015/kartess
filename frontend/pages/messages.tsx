import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';

export default function Messages() {
  const router = useRouter();
  
  // Redirect to chats page
  if (typeof window !== 'undefined') {
    router.replace('/chats');
  }

  return (
    <Layout title="Messages - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">Redirecting...</p>
          </div>
        </div>
        <BottomNav />
      </Layout>
  );
}
