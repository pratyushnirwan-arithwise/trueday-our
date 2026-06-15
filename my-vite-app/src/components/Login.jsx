import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from './contexts/UserContext';
import './login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useUser();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Login: Attempting login with email:', email);
      
      const response = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin
        },
        credentials: 'include',
        mode: 'cors',
        body: JSON.stringify({ email, password }),
      });

      console.log('Login: Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Login: Server error response:', errorText);
        throw new Error('Login failed: ' + (errorText || response.statusText));
      }

      const data = await response.json();
      console.log('Login: Full response data:', JSON.stringify(data, null, 2));

      // Check the structure of the response
      if (!data || typeof data !== 'object') {
        console.error('Login: Invalid response format:', data);
        throw new Error('Invalid response format from server');
      }

      // Check if we have a user object
      if (!data.user) {
        console.error('Login: No user object in response:', data);
        throw new Error('No user data in server response');
      }

      // Log the user object structure
      console.log('Login: User object structure:', {
        id: data.user.user_id,
        username: data.user.name,
        has_id: !!data.user.user_id,
        has_username: !!data.user.name
      });

      if (!data.user.user_id || !data.user.name) {
        console.error('Login: Missing required user fields:', data.user);
        throw new Error('Invalid user data received from server');
      }

      // Parse and validate user ID
      const userId = parseInt(data.user.user_id, 10);
      if (isNaN(userId)) {
        console.error('Login: Invalid user ID format:', data.user.user_id);
        throw new Error('Invalid user ID format received from server');
      }

      // Use the UserContext's setUser function to properly set user data
      setUser({
        id: userId,
        username: data.user.name
      });
      
      console.log('Login: Successfully logged in, navigating to dashboard');
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link 
              to="/register" 
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login; 