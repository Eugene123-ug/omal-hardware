import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginCard } from './LoginCard';

describe('LoginCard Component', () => {
  it('renders clean username and password fields only (no role pickers or demo buttons)', () => {
    const handleSubmit = vi.fn();
    render(<LoginCard onSubmit={handleSubmit} />);

    // Brand and titles
    expect(screen.getByText('WONARK COMPANY LIMITED')).toBeInTheDocument();
    expect(screen.getByText('Enterprise ERP & POS Workspace')).toBeInTheDocument();

    // Standard credential inputs
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/account password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();

    // Verify STRICTLY NO role selectors or demo switcher links exist
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText(/select role/i)).toBeNull();
    expect(screen.queryByText(/demo login/i)).toBeNull();
    expect(screen.queryByText(/switch user/i)).toBeNull();
  });

  it('validates required username/email and shows error message', async () => {
    const handleSubmit = vi.fn();
    render(<LoginCard onSubmit={handleSubmit} />);

    const form = screen.getByRole('button', { name: /sign in/i }).closest('form');
    fireEvent.submit(form!);

    expect(await screen.findByText(/please enter your username or email address/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('validates required password when username is provided', async () => {
    const handleSubmit = vi.fn();
    render(<LoginCard onSubmit={handleSubmit} />);

    const identityInput = screen.getByLabelText(/username or email/i);
    fireEvent.change(identityInput, { target: { value: 'owner@wonark.com' } });

    const form = screen.getByRole('button', { name: /sign in/i }).closest('form');
    fireEvent.submit(form!);

    expect(await screen.findByText(/please enter your password/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('keeps password input strictly secure as password type without peek toggle', () => {
    const handleSubmit = vi.fn();
    render(<LoginCard onSubmit={handleSubmit} />);

    const passwordInput = screen.getByLabelText(/account password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    expect(screen.queryByRole('button', { name: /show password/i })).toBeNull();
  });

  it('calls onSubmit with entered credentials when valid', async () => {
    const handleSubmit = vi.fn();
    render(<LoginCard onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText(/username or email/i), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText(/account password/i), {
      target: { value: 'securepassword123' },
    });

    const form = screen.getByRole('button', { name: /sign in/i }).closest('form');
    fireEvent.submit(form!);

    expect(handleSubmit).toHaveBeenCalledWith({
      identity: 'admin',
      password: 'securepassword123',
    });
  });

  it('displays error message passed via props', () => {
    const handleSubmit = vi.fn();
    render(<LoginCard onSubmit={handleSubmit} errorMessage="Invalid credentials provided." />);

    expect(screen.getByText('Invalid credentials provided.')).toBeInTheDocument();
  });
});
