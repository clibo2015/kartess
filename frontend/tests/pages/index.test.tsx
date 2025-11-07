import React from 'react';
import { render, screen } from '@testing-library/react';
import Index from '../../pages/index';

describe('Landing Page', () => {
  it('should render landing page content', () => {
    render(<Index />);
    // Use getAllByText since "Kartess" appears multiple times on the page
    const kartessElements = screen.getAllByText(/Kartess/i);
    expect(kartessElements.length).toBeGreaterThan(0);
  });

  it('should have Get Started button', () => {
    render(<Index />);
    expect(screen.getByText(/Get Started/i)).toBeInTheDocument();
  });

  it('should have Login button', () => {
    render(<Index />);
    expect(screen.getByText(/Login/i)).toBeInTheDocument();
  });
});

