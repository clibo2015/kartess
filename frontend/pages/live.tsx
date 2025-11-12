import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { getUser } from '../lib/auth';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { liveAPI } from '../lib/api';

export default function LiveStreaming() {
  const router = useRouter();
  const currentUser = getUser();

  const handleGoLive = () => {
    router.push('/live/create');
  };

  return (
    <Layout title="Live - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Live Streaming</h1>
              <Button
                variant="primary"
                onClick={handleGoLive}
                className="px-4 py-2 text-sm bg-red-600"
              >
                🔴 Go Live
              </Button>
            </div>
          </div>

          {/* Active Streams */}
          <div className="px-4 py-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Active Streams</h2>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No active streams at the moment</p>
              <p className="text-sm text-gray-400">
                Start a live stream to connect with your audience in real-time!
              </p>
            </div>
          </div>

          {/* Info Section */}
          <div className="px-4 py-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-bold text-gray-900 mb-2">About Live Streaming</h3>
              <p className="text-sm text-gray-600 mb-4">
                Go live to share moments, host discussions, or connect with your community in
                real-time. Streaming is powered by Agora for high-quality video and audio.
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Share screen or camera feed</p>
                <p>• Interact with viewers via comments</p>
                <p>• Save recordings for later viewing</p>
              </div>
            </div>
          </div>
        </div>

        <BottomNav />
      </Layout>
  );
}
