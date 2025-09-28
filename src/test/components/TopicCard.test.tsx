import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TopicCard } from '~/components/TopicCard';

describe('TopicCard', () => {
  it('should render topic title without image', () => {
    const topic = { id: 1, title: 'Test Topic', created_at: '2023-01-01T00:00:00Z', image: null };

    render(
      <MemoryRouter>
        <TopicCard topic={topic} />
      </MemoryRouter>
    );

    expect(screen.getByText('Test Topic')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/topics/1');
  });

  it('should render topic with image', () => {
    const topic = { id: 1, title: 'Test Topic', created_at: '2023-01-01T00:00:00Z', image: 'https://example.com/image.jpg' };

    render(
      <MemoryRouter>
        <TopicCard topic={topic} />
      </MemoryRouter>
    );

    const img = screen.getByAltText('Test Topic');
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('should include profileId in href when provided', () => {
    const topic = { id: 1, title: 'Test Topic', created_at: '2023-01-01T00:00:00Z', image: null };

    render(
      <MemoryRouter>
        <TopicCard topic={topic} profileId="profile-1" />
      </MemoryRouter>
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', '/topics/1?profileId=profile-1');
  });
});