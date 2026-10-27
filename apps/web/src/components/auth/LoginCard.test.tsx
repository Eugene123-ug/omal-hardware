import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginCard } from './LoginCard';

describe('LoginCard Component', () => {
  it('renders clean username and password fields only (no role pickers or demo buttons)', () => {
    const handleSubmit = vi.fn();
    render(<LoginCard onSubmit={handleSubmit} />);

    // Brand and titles
    expect(screen.getByText('OMAL ERP')).toBeInTheDocument();
    expect(screen.getByText('Accra Showroom & Tema Depot')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();

    // Standard credential inputs
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i, { selector: 'input' })).toBeInTheDocument();
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

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/please enter your username or email address/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('validates required password when username is provided', async () => {
    const handleSubmit = vi.fn();
    render(<LoginCard onSubmit={handleSubmit} />);

    const identityInput = screen.getByLabelText(/username or email/i);
    fireEvent.change(identityInput, { target: { value: 'owner@omal.com' } });

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/please enter your password/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('keeps password input strictly secure as password type without peek toggle', () => {
    const handleSubmit = vi.fn();
    render(<LoginCard onSubmit={handleSubmit} />);

    const passwordInput = screen.getByLabelText(/^password/i, { selector: 'input' }) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    expect(screen.queryByRole('button', { name: /show password/i })).toBeNull();
  });

  it('calls onSubmit with entered credentials when valid', () => {
    const handleSubmit = vi.fn();
    render(<LoginCard onSubmit={handleSubmit} />);

    const identityInput = screen.getByLabelText(/username or email/i);
    const passwordInput = screen.getByLabelText(/^password/i, { selector: 'input' });

    fireEvent.change(identityInput, { target: { value: 'manager' } });
    fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      identity: 'manager',
      password: 'Secret123!',
    });
  });

  it('displays error message passed via props', () => {
    render(<LoginCard onSubmit={vi.fn()} errorMessage="Invalid server credentials" />);
    expect(screen.getByText('Invalid server credentials')).toBeInTheDocument();
  });
});
