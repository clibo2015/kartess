import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { z } from 'zod';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import FormField from '../components/FormField';
import Logo from '../components/Logo';
import { authAPI } from '../lib/api';
import { setAuth } from '../lib/auth';

const registerSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'Username must be alphanumeric'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one symbol'),
});

type FormData = z.infer<typeof registerSchema>;

export default function Register() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    email: '',
    username: '',
    password: '',
  });

  // Extract QR token from query params
  useEffect(() => {
    const { qr_token } = router.query;
    if (qr_token && typeof qr_token === 'string') {
      setQrToken(qr_token);
    }
  }, [router.query]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Validate form data
      const validatedData = registerSchema.parse(formData);

      // Register user (include QR token if present)
      const response = await authAPI.register({
        ...validatedData,
        qr_token: qrToken || undefined,
      });

      // Store auth data
      setAuth(response);

      // Show success message if contact was auto-created via QR
      if (response.qrContact) {
        alert(`Successfully registered and connected with ${response.qrContact.user?.full_name || response.qrContact.user?.username || 'user'}!`);
      }

      // Redirect to profile completion
      router.push('/profile-complete');
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else if (error.response?.data) {
        const errorMessage = error.response.data.error || 'Registration failed';
        if (errorMessage.includes('Email')) {
          setErrors({ email: errorMessage });
        } else if (errorMessage.includes('Username')) {
          setErrors({ username: errorMessage });
        } else {
          setErrors({ general: errorMessage });
        }
      } else {
        setErrors({ general: 'An error occurred. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Register - Kartess">
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo size="lg" showText={false} onClick={() => {}} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Create Account
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Join Kartess and start connecting today
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {errors.general}
              </div>
            )}

            <FormField label="Full Name" error={errors.full_name} required>
              <Input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                error={errors.full_name}
                placeholder="John Doe"
              />
            </FormField>

            <FormField label="Email" error={errors.email} required>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="john@example.com"
              />
            </FormField>

            <FormField label="Username" error={errors.username} required>
              <Input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                error={errors.username}
                placeholder="johndoe"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                3+ characters, alphanumeric only
              </p>
            </FormField>

            <FormField label="Password" error={errors.password} required>
              <Input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                8+ characters, must include uppercase, lowercase, number, and symbol
              </p>
            </FormField>

            <Button
              type="submit"
              loading={loading}
              className="w-full mt-6"
            >
              Create Account
            </Button>

            <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                Login
              </button>
            </p>
          </form>
        </div>
      </div>
    </Layout>
  );
}
