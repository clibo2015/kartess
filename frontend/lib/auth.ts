import { AuthResponse, User, Profile } from '../types';

const TOKEN_KEY = 'kartess_token';
const REFRESH_TOKEN_KEY = 'kartess_refresh_token';

/**
 * Store JWT token in localStorage
 */
export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Get JWT token from localStorage
 */
export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

/**
 * Remove JWT token from localStorage
 */
export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Store refresh token in localStorage
 */
export function setRefreshToken(refreshToken: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

/**
 * Get refresh token from localStorage
 */
export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return null;
}

/**
 * Remove refresh token from localStorage
 */
export function removeRefreshToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

/**
 * Check if user is authenticated (has valid token)
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Store auth response (token and user data)
 */
export function setAuth(authResponse: AuthResponse): void {
  setToken(authResponse.token);
  if (authResponse.refreshToken) {
    setRefreshToken(authResponse.refreshToken);
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem('kartess_user', JSON.stringify(authResponse.user));
    if (authResponse.profileComplete !== undefined) {
      localStorage.setItem(
        'kartess_profile_complete',
        String(authResponse.profileComplete)
      );
    }
  }
}

/**
 * Get stored user data
 */
export function getUser(): User | null {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('kartess_user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Clear all auth data
 */
export function clearAuth(): void {
  removeToken();
  removeRefreshToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kartess_user');
    localStorage.removeItem('kartess_profile_complete');
    sessionStorage.removeItem('kartess_auth_verified');
  }
}

/**
 * Check if profile is complete (from localStorage or API)
 */
export function isProfileComplete(): boolean {
  if (typeof window !== 'undefined') {
    const profileComplete = localStorage.getItem('kartess_profile_complete');
    return profileComplete === 'true';
  }
  return false;
}
