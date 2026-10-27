import React, { useState } from 'react';
import { Lock, User, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';

export interface LoginCredentials {
  identity: string;
  password: string;
}

export interface LoginCardProps {
  onSubmit: (credentials: LoginCredentials) => Promise<void> | void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export const LoginCard: React.FC<LoginCardProps> = ({
  onSubmit,
  isLoading = false,
  errorMessage = null,
}) => {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedIdentity = identity.trim();
    if (!trimmedIdentity) {
      setValidationError('Please enter your username or email address.');
      return;
    }

    if (!password) {
      setValidationError('Please enter your password.');
      return;
    }

    await onSubmit({
      identity: trimmedIdentity,
      password,
    });
  };

  const activeError = validationError || errorMessage;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-md mb-3">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          OMAL ERP
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Accra Showroom &amp; Tema Depot
        </p>
      </div>

      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Sign in to your account</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your credentials to access your designated branch workspace.
            </p>
          </div>

          {activeError && (
            <div className="mb-5">
              <Alert variant="error">{activeError}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Input
                label="Username or Email"
                id="identity"
                name="identity"
                type="text"
                autoComplete="username"
                required
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="e.g. manager or user@omal.com"
                disabled={isLoading}
                leftIcon={<User className="w-4 h-4" />}
              />
            </div>

            <div>
              <Input
                label="Password"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                leftIcon={<Lock className="w-4 h-4" />}
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full font-semibold shadow-sm"
                isLoading={isLoading}
              >
                Sign In
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Authorised OMAL personnel only. All access, operations and stock transactions are recorded in the immutable audit log.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
