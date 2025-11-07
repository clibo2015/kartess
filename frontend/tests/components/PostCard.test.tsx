import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PostCard from '../../components/PostCard';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => {
    return <img src={src} alt={alt} {...props} />;
  },
}));

jest.mock('../../lib/auth', () => ({
  getUser: jest.fn(() => ({ id: 'viewer-1' })), // ensure viewer is not owner
}));

jest.mock('../../lib/api', () => ({
  postsAPI: {
    delete: jest.fn(),
  },
}));

const mockPost = {
  id: 'post-1',
  content: 'Test post content',
  module: 'connect',
  created_at: new Date().toISOString(),
  user: {
    id: 'user-1',
    username: 'testuser',
    full_name: 'Test User',
    profile: {
      avatar_url: 'https://example.com/avatar.jpg',
    },
  },
  _count: {
    reactions: 5,
    comments: 3,
  },
  reactions: [],
};

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('PostCard Component', () => {
  it('should render post content', () => {
    renderWithClient(<PostCard post={mockPost} />);
    expect(screen.getByText('Test post content')).toBeInTheDocument();
  });

  it('should render user information', () => {
    renderWithClient(<PostCard post={mockPost} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
  });

  it('should render reaction and comment counts', () => {
    const { container } = renderWithClient(<PostCard post={mockPost} />);
    // Check that reaction and comment counts are rendered
    // The counts are in buttons with emoji, so we check the structure
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    // Verify counts are present by checking button text content
    const buttonTexts = Array.from(buttons).map(btn => btn.textContent);
    expect(buttonTexts.some(text => text?.includes('5'))).toBe(true);
    expect(buttonTexts.some(text => text?.includes('3'))).toBe(true);
  });

  it('should render media if present', () => {
    const postWithMedia = {
      ...mockPost,
      media_urls: ['https://example.com/image.jpg'],
    };
    renderWithClient(<PostCard post={postWithMedia} />);
    expect(screen.getByAltText('Post media')).toBeInTheDocument();
  });

  it('should render module badge', () => {
    renderWithClient(<PostCard post={mockPost} />);
    expect(screen.getByText('connect')).toBeInTheDocument();
  });

  it('should handle multiple modules', () => {
    const multiModulePost = {
      ...mockPost,
      module: 'connect,visuals',
    };
    renderWithClient(<PostCard post={multiModulePost} />);
    expect(screen.getByText('connect')).toBeInTheDocument();
    expect(screen.getByText('visuals')).toBeInTheDocument();
  });
});

