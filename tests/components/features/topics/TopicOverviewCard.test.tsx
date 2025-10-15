import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TopicOverviewCard } from '~/components/features/topics/TopicOverviewCard';
import type { Topic } from '~/lib/schemas/topic';

describe('TopicOverviewCard', () => {
  const mockTopic: Topic = {
    id: 1,
    title: 'Test Topic Title',
    image: 'https://example.com/test-image.jpg',
    created_at: '2024-01-01T12:00:00Z',
  };

  it('renders topic title', () => {
    render(<TopicOverviewCard topic={mockTopic} answerCount={5} />);

    expect(screen.getByText('Test Topic Title')).toBeInTheDocument();
  });

  it('displays answer count', () => {
    render(<TopicOverviewCard topic={mockTopic} answerCount={10} />);

    expect(screen.getByText('回答 10 件')).toBeInTheDocument();
  });

  it('shows topic badge', () => {
    render(<TopicOverviewCard topic={mockTopic} answerCount={5} />);

    expect(screen.getByText('お題')).toBeInTheDocument();
  });

  it('renders topic image when available', () => {
    render(<TopicOverviewCard topic={mockTopic} answerCount={5} />);

    const image = screen.getByAltText('Test Topic Title');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/test-image.jpg');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('does not render image when topic has no image', () => {
    const topicWithoutImage = { ...mockTopic, image: null };

    render(<TopicOverviewCard topic={topicWithoutImage} answerCount={5} />);

    expect(screen.queryByAltText('Test Topic Title')).not.toBeInTheDocument();
  });

  it('displays formatted creation date', () => {
    render(<TopicOverviewCard topic={mockTopic} answerCount={5} />);

    // The date should be formatted and displayed
    expect(screen.getByText(/作成:/)).toBeInTheDocument();
  });

  it('handles invalid creation date gracefully', () => {
    const topicWithInvalidDate = { ...mockTopic, created_at: 'invalid-date' };

    render(<TopicOverviewCard topic={topicWithInvalidDate} answerCount={5} />);

    // Should not display creation date for invalid dates
    expect(screen.queryByText(/作成:/)).not.toBeInTheDocument();
  });

  it('has correct data-testid', () => {
    render(<TopicOverviewCard topic={mockTopic} answerCount={5} />);

    expect(screen.getByTestId('topic-overview-card')).toBeInTheDocument();
  });

  it('renders with zero answer count', () => {
    render(<TopicOverviewCard topic={mockTopic} answerCount={0} />);

    expect(screen.getByText('回答 0 件')).toBeInTheDocument();
  });

  it('renders with large answer count', () => {
    render(<TopicOverviewCard topic={mockTopic} answerCount={999} />);

    expect(screen.getByText('回答 999 件')).toBeInTheDocument();
  });
});
