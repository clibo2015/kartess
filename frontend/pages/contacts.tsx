import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';
import BottomNav from '../components/BottomNav';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import QRGenerator from '../components/QRGenerator';
import QRScanner from '../components/QRScanner';
import PresetSelectionModal from '../components/PresetSelectionModal';
import { contactsAPI } from '../lib/api';
import Image from 'next/image';
import Link from 'next/link';

export default function Contacts() {
  const [isQRGeneratorOpen, setIsQRGeneratorOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const { data: contactsData, isLoading: isLoadingContacts, refetch: refetchContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsAPI.getContacts(),
  });

  const { data: pendingData, isLoading: isLoadingPending, refetch: refetchPending } = useQuery({
    queryKey: ['pendingContacts'],
    queryFn: () => contactsAPI.getPending(),
  });

  const contacts = contactsData?.contacts || [];
  const pending = pendingData?.pending || [];

  const handleApprove = async (contactId: string, presetName?: 'personal' | 'professional' | 'custom') => {
    try {
      await contactsAPI.approve(contactId, presetName);
      // Refetch data
      refetchContacts();
      refetchPending();
      alert('Contact approved successfully!');
    } catch (error: any) {
      console.error('Approve error:', error);
      alert(error.response?.data?.error || 'Failed to approve');
    }
  };

  const handleApproveClick = (contactId: string) => {
    setSelectedContactId(contactId);
    setPresetModalOpen(true);
  };

  const handleQRScanSuccess = () => {
    refetchContacts();
    refetchPending();
  };

  return (
    <Layout title="Contacts - Kartess">
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsQRScannerOpen(true)}
                  className="text-sm"
                >
                  📷 Scan QR
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setIsQRGeneratorOpen(true)}
                  className="text-sm"
                >
                  📤 Share QR
                </Button>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 space-y-6">
            {/* Pending Requests */}
            {pending.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Pending Requests ({pending.length})
                </h2>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
                  {pending.map((request: any) => (
                    <div
                      key={request.id}
                      className="p-4 flex items-center justify-between"
                    >
                      <Link
                        href={`/${request.sender.username}/profile`}
                        className="flex items-center gap-3 flex-1"
                      >
                        {request.sender.profile?.avatar_url ? (
                          <Image
                            src={request.sender.profile.avatar_url}
                            alt={request.sender.full_name}
                            width={48}
                            height={48}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            {request.sender.full_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">
                            {request.sender.full_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            @{request.sender.username}
                          </p>
                        </div>
                      </Link>
                      <Button
                        variant="primary"
                        onClick={() => handleApproveClick(request.id)}
                        className="ml-4"
                      >
                        Approve
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Contacts */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Contacts ({contacts.length})
              </h2>
              {isLoadingContacts || isLoadingPending ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <p className="text-gray-500">No contacts yet</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
                  {contacts.map((contact: any) => (
                    <Link
                      key={contact.id}
                      href={`/${contact.user.username}/profile`}
                      className="p-4 flex items-center gap-3 hover:bg-gray-50"
                    >
                      {contact.user.profile?.avatar_url ? (
                        <Image
                          src={contact.user.profile.avatar_url}
                          alt={contact.user.full_name}
                          width={48}
                          height={48}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          {contact.user.full_name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {contact.shared_data?.full_name || contact.user.full_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          @{contact.user.username}
                        </p>
                        {contact.shared_data?.bio && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {contact.shared_data.bio}
                          </p>
                        )}
                        {/* Show shared data if available */}
                        {contact.shared_data && (
                          <div className="mt-2 space-y-1">
                            {contact.shared_data.email && (
                              <p className="text-xs text-gray-500">
                                ✉️ {contact.shared_data.email}
                              </p>
                            )}
                            {contact.shared_data.phone && (
                              <p className="text-xs text-gray-500">
                                📞 {contact.shared_data.phone}
                              </p>
                            )}
                            {contact.shared_data.company && (
                              <p className="text-xs text-gray-500">
                                🏢 {contact.shared_data.company}
                                {contact.shared_data.position && ` - ${contact.shared_data.position}`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <BottomNav />

        <QRGenerator
          isOpen={isQRGeneratorOpen}
          onClose={() => setIsQRGeneratorOpen(false)}
        />

        <QRScanner
          isOpen={isQRScannerOpen}
          onClose={() => setIsQRScannerOpen(false)}
          onSuccess={handleQRScanSuccess}
        />

        <PresetSelectionModal
          isOpen={presetModalOpen}
          onClose={() => {
            setPresetModalOpen(false);
            setSelectedContactId(null);
          }}
          onSelect={(presetName) => {
            if (selectedContactId) {
              handleApprove(selectedContactId, presetName);
              setPresetModalOpen(false);
              setSelectedContactId(null);
            }
          }}
          title="Select Preset"
          description="Choose which information you want to share with this contact:"
        />
      </Layout>
  );
}
