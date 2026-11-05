import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Input } from '../../components/common/Input.js';
import { Button } from '../../components/common/Button.js';
import { Hotel, KeyRound } from 'lucide-react';
import { ApiError } from '../../types/api.js';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      await login(data);
      success('Logged in successfully', 'Welcome back');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toastError(apiErr.message || 'Invalid email or password', 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemo = (email: string, pass: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', pass, { shouldValidate: true });
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="text-center mb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-3">
            <Hotel className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sign in to your account
          </h2>
          <p className="mt-1 text-sm text-slate-500">Access your bookings and hotel management</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="alice@example.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
            Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Create an account
          </Link>
        </p>

        {/* Quick Demo Fill Buttons for Reviewers */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-3">
            <KeyRound className="h-3.5 w-3.5 text-indigo-600" />
            <span>Demo Reviewer Quick-Fill:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => fillDemo('alice@example.com', 'Guest@123456')}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition-colors"
            >
              <div className="font-semibold text-slate-800">Alice (Guest)</div>
              <div className="text-[11px] text-slate-400">alice@example.com</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('bob@example.com', 'Guest@123456')}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition-colors"
            >
              <div className="font-semibold text-slate-800">Bob (Guest)</div>
              <div className="text-[11px] text-slate-400">bob@example.com</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('staff@grandhorizon.com', 'Staff@123456')}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition-colors"
            >
              <div className="font-semibold text-slate-800">Staff Member</div>
              <div className="text-[11px] text-slate-400">staff@grandhorizon.com</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('admin@grandhorizon.com', 'Admin@123456')}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition-colors"
            >
              <div className="font-semibold text-slate-800">Admin</div>
              <div className="text-[11px] text-slate-400">admin@grandhorizon.com</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
