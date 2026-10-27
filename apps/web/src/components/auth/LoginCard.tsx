import React, { useState } from 'react';
import { Lock, User, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { useCompany } from '../../context/CompanyContext';

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
  const { companyName, companyLogo } = useCompany();

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
        {companyLogo ? (
          <img
            src={companyLogo}
            alt={companyName}
            className="w-16 h-16 rounded-2xl mx-auto object-contain mb-3 bg-white p-1 border border-slate-200"
          />
        ) : (
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-md mb-3">
            <ShieldCheck className="w-8 h-8" />
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {companyName}
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Enterprise ERP &amp; POS Workspace
        </p>
      </div>

      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {activeError && (
              <Alert variant="error" title="Authentication Error">
                {activeError}
              </Alert>
            )}

            <Input
              label="Username or Email"
              type="text"
              name="identity"
              autoComplete="username"
              placeholder="e.g. admin or staff@company.com"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              disabled={isLoading}
              required
              leftIcon={<User className="w-4 h-4 text-slate-400" />}
            />

            <Input
              label="Account Password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your security password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-md bg-emerald-600 hover:bg-emerald-700"
              isLoading={isLoading}
            >
              Sign In to Workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
