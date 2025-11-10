import { useState } from 'react';
import { useRouter } from 'next/router';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import FormField from '../components/FormField';
import Logo from '../components/Logo';
import { authAPI } from '../lib/api';
import { setAuth } from '../lib/auth';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof loginSchema>;

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate form data
      const validatedData = loginSchema.parse(formData);

      // Login user
      const response = await authAPI.login(validatedData);

      // Store auth data
      setAuth(response);

      // Redirect based on profile completeness
      if (response.profileComplete) {
        router.push('/home');
      } else {
        router.push('/profile-complete');
      }
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        setError(error.issues[0]?.message || 'Invalid input.');
      } else if (isAxiosError(error) && error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Login - Kartess">
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo size="lg" showText={false} onClick={() => {}} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h1>
            <p className="text-gray-600">
              Sign in to your Kartess account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <FormField label="Email" required>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john@example.com"
              />
            </FormField>

            <FormField label="Password" required>
              <Input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
              />
            </FormField>

            <Button
              type="submit"
              loading={loading}
              className="w-full mt-6"
            >
              Sign In
            </Button>

            <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/register')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                Create Account
              </button>
            </p>
          </form>
        </div>
      </div>
    </Layout>
  );
}
