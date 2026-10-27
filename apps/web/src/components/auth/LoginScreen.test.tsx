import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginScreen } from './LoginScreen';

describe('Secure Enterprise LoginScreen Component', () => {
  it('renders the clean royal blue card with LOGIN header and user icon', () => {
    const handleLoginSuccess = vi.fn();
    render(<LoginScreen onLoginSuccess={handleLoginSuccess} />);

    // Brand and card header
    expect(screen.getByText('OMAL')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^login$/i })).toBeInTheDocument();
    expect(screen.getByText(/OMAL HARDWARE LTD/i)).toBeInTheDocument();

    // Form elements
    expect(screen.getByPlaceholderText('Username or Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();

    // Controls
    expect(screen.getByText('Remember Me')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forgot password\?/i })).toBeInTheDocument();

    // STRICTLY NO demo credentials
    expect(screen.queryByText(/quick demo credentials/i)).toBeNull();
  });

  it('keeps password input strictly secure as password type without eye peek toggle', () => {
    const handleLoginSuccess = vi.fn();
    render(<LoginScreen onLoginSuccess={handleLoginSuccess} />);

    const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    expect(screen.queryByLabelText(/show password/i)).toBeNull();
  });

  it('navigates to Forgot Password screen and back', () => {
    const handleLoginSuccess = vi.fn();
    render(<LoginScreen onLoginSuccess={handleLoginSuccess} />);

    const forgotBtn = screen.getByRole('button', { name: /forgot password\?/i });
    fireEvent.click(forgotBtn);

    expect(screen.getByText('RESET PASSWORD')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset instructions/i })).toBeInTheDocument();

    // Back to Login
    const backBtn = screen.getByRole('button', { name: /back to login/i });
    fireEvent.click(backBtn);

    expect(screen.getByRole('heading', { name: /^login$/i })).toBeInTheDocument();
  });

  it('validates empty credentials and displays error message', async () => {
    const handleLoginSuccess = vi.fn();
    render(<LoginScreen onLoginSuccess={handleLoginSuccess} />);

    const form = screen.getByPlaceholderText('Username or Email').closest('form');
    fireEvent.submit(form!);

    expect(await screen.findByText('Please enter your username or email.')).toBeInTheDocument();
    expect(handleLoginSuccess).not.toHaveBeenCalled();
  });
});
