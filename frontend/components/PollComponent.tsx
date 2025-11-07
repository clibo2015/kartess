import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pollsAPI } from '../lib/api';
import { getSocket } from '../lib/socket';
import { getUser } from '../lib/auth';
import Button from './Button';

interface PollComponentProps {
  postId: string;
}

export default function PollComponent({ postId }: PollComponentProps) {
  const currentUser = getUser();
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const { data: poll, isLoading } = useQuery({
    queryKey: ['poll', postId],
    queryFn: () => pollsAPI.getPoll(postId),
    enabled: !!postId,
  });

  const voteMutation = useMutation({
    mutationFn: (optionId: string) => pollsAPI.vote(postId, optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poll', postId] });
      setSelectedOption(null);
    },
  });

  useEffect(() => {
    if (!poll) return;

    const socket = getSocket();
    socket.on('poll.vote', (data: any) => {
      if (data.post_id === postId) {
        queryClient.invalidateQueries({ queryKey: ['poll', postId] });
      }
    });

    return () => {
      socket.off('poll.vote');
    };
  }, [poll, postId, queryClient]);

  if (isLoading || !poll) {
    return <div className="text-sm text-gray-500">Loading poll...</div>;
  }

  const hasVoted = !!poll.userVote;
  const showResults = hasVoted || poll.userVote !== null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-medium text-gray-700 mb-2">Poll</p>
      {poll.options.map((option: any) => {
        const isSelected = selectedOption === option.id;
        const percentage = option.percentage || 0;

        return (
          <div key={option.id} className="relative">
            {showResults ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-lg h-10 flex items-center justify-between px-3">
                  <span className="text-sm text-gray-900">{option.option_text}</span>
                  <span className="text-sm font-medium text-gray-600">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="absolute left-0 top-0 h-10 bg-blue-200 rounded-lg transition-all duration-300"
                  style={{ width: `${percentage}%`, zIndex: 0 }}
                />
                <div className="relative z-10 flex-1 flex items-center justify-between px-3">
                  <span className="text-sm text-gray-900">{option.option_text}</span>
                  <span className="text-sm font-medium text-gray-600">
                    {option.vote_count} votes
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!hasVoted) {
                    setSelectedOption(option.id);
                    voteMutation.mutate(option.id);
                  }
                }}
                disabled={voteMutation.isPending}
                className={`w-full px-3 py-2 text-left border-2 rounded-lg transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                } ${voteMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="text-sm text-gray-900">{option.option_text}</span>
              </button>
            )}
          </div>
        );
      })}
      <p className="text-xs text-gray-500 mt-2">
        {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
        {hasVoted && poll.userVote && (
          <span className="ml-2">• You voted: {poll.userVote.option_text}</span>
        )}
      </p>
    </div>
  );
}
