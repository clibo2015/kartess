import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation } from '@tanstack/react-query';
import Layout from '../../../components/Layout';
import BottomNav from '../../../components/BottomNav';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { careernetAPI } from '../../../lib/api';
import { getUser } from '../../../lib/auth';
import Link from 'next/link';
import Image from 'next/image';

export default function JobDetail() {
  const router = useRouter();
  const { jobId } = router.query;
  const currentUser = getUser();
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const { data: job, isLoading } = useQuery({
    queryKey: ['careernetJob', jobId],
    queryFn: () => careernetAPI.getJob(jobId as string),
    enabled: !!jobId,
  });

  const applicationMutation = useMutation({
    mutationFn: (data: { cover_letter?: string; resume?: File }) =>
      careernetAPI.applyToJob(jobId as string, data),
    onSuccess: () => {
      setShowApplicationForm(false);
      setCoverLetter('');
      setResumeFile(null);
      alert('Application submitted successfully!');
    },
  });

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    applicationMutation.mutate({
      cover_letter: coverLetter || undefined,
      resume: resumeFile || undefined,
    });
  };

  const isOwner = job?.user_id === currentUser?.id;

  return (
    <Layout title={job?.title || 'Job - CareerNet'}>
        <div className="min-h-screen bg-gray-50 pb-20">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : !job ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Job not found</p>
              <Button
                variant="secondary"
                onClick={() => router.push('/careernet')}
                className="mt-4"
              >
                Back to Jobs
              </Button>
            </div>
          ) : (
            <>
              {/* Job Header */}
              <div className="bg-white border-b border-gray-200 px-4 py-6">
                <Link
                  href="/careernet"
                  className="text-purple-600 hover:text-purple-700 text-sm mb-4 inline-block"
                >
                  ← Back to Jobs
                </Link>

                <div className="flex items-start gap-3 mb-4">
                  {job.user.profile?.avatar_url ? (
                    <Image
                      src={job.user.profile.avatar_url}
                      alt={job.user.full_name}
                      width={48}
                      height={48}
                      className="rounded-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                      {job.user.full_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h1>
                    {job.company && (
                      <p className="text-lg text-gray-700 font-medium">{job.company}</p>
                    )}
                    <p className="text-sm text-gray-500">Posted by {job.user.full_name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded text-sm ${
                    job.status === 'open'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {job.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {job.type && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded capitalize">
                      {job.type.replace('-', ' ')}
                    </span>
                  )}
                  {job.location && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                      📍 {job.location}
                    </span>
                  )}
                  {job.salary_range && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                      💰 {job.salary_range}
                    </span>
                  )}
                </div>
              </div>

              {/* Job Details */}
              <div className="px-4 py-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2">Description</h2>
                  <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
                </div>

                {(job.requirements as string[])?.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Requirements</h2>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {(job.requirements as string[]).map((req, idx) => (
                        <li key={idx}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(job.tags as string[])?.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Skills</h2>
                    <div className="flex flex-wrap gap-2">
                      {(job.tags as string[]).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {job.application_url && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Apply</h2>
                    <a
                      href={job.application_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-700 underline"
                    >
                      {job.application_url}
                    </a>
                  </div>
                )}

                {job.application_email && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Contact</h2>
                    <a
                      href={`mailto:${job.application_email}`}
                      className="text-purple-600 hover:text-purple-700 underline"
                    >
                      {job.application_email}
                    </a>
                  </div>
                )}

                {/* Application Form */}
                {!isOwner && job.status === 'open' && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    {!showApplicationForm ? (
                      <Button
                        variant="primary"
                        onClick={() => setShowApplicationForm(true)}
                        className="w-full bg-purple-600"
                      >
                        Apply Now
                      </Button>
                    ) : (
                      <form onSubmit={handleApply} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cover Letter (Optional)
                          </label>
                          <textarea
                            value={coverLetter}
                            onChange={(e) => setCoverLetter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            rows={6}
                            placeholder="Write your cover letter..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Resume (PDF, Optional)
                          </label>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setShowApplicationForm(false);
                              setCoverLetter('');
                              setResumeFile(null);
                            }}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={applicationMutation.isPending}
                            className="flex-1 bg-purple-600"
                          >
                            {applicationMutation.isPending ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              'Submit Application'
                            )}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                <div className="text-sm text-gray-500 text-center">
                  {job._count?.applications || 0} applications • Posted{' '}
                  {new Date(job.created_at).toLocaleDateString()}
                </div>
              </div>
            </>
          )}
        </div>

        <BottomNav />
      </Layout>
  );
}
