import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

const mockUseChat = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useChat', () => ({
  useChat: mockUseChat,
}));

function defaultChat() {
  return {
    messages: [],
    loading: false,
    send: vi.fn(),
    clear: vi.fn(),
    userContext: {},
  };
}

describe('App', () => {
  it('renders without crashing', () => {
    mockUseChat.mockReturnValue(defaultChat());
    render(<App />);
    expect(screen.getByText('Travel Assistant')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    mockUseChat.mockReturnValue(defaultChat());
    render(<App />);
    expect(screen.getByText(/Ask me anything about travel/)).toBeInTheDocument();
  });

  it('shows suggestion buttons in empty state', () => {
    mockUseChat.mockReturnValue(defaultChat());
    render(<App />);
    expect(screen.getByText(/Southeast Asia/)).toBeInTheDocument();
    expect(screen.getByText(/Iceland/)).toBeInTheDocument();
    expect(screen.getByText(/Tokyo/)).toBeInTheDocument();
  });

  it('Send button is disabled when input is empty', () => {
    mockUseChat.mockReturnValue(defaultChat());
    render(<App />);
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeDisabled();
  });

  it('shows profile bar when userContext has destination and passport', () => {
    mockUseChat.mockReturnValue({
      ...defaultChat(),
      userContext: { destination: 'Tokyo, Japan', passport: ['Israeli'] },
    });
    render(<App />);
    expect(screen.getByText(/Tokyo, Japan/)).toBeInTheDocument();
    expect(screen.getByText(/Israeli/)).toBeInTheDocument();
  });
});
