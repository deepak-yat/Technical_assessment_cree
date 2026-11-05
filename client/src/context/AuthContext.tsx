import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserDto, UserRole } from '../types/api.js';
import { authApi, LoginInput, RegisterInput } from '../api/auth.api.js';
import { setOnAuthFailed, setAccessToken } from '../api/client.js';

interface AuthContextValue {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleAuthFailed = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  // Initialize session on mount: attempt silent refresh, then /me
  useEffect(() => {
    setOnAuthFailed(handleAuthFailed);

    let isMounted = true;

    async function initAuth() {
      try {
        await authApi.refresh();
        const me = await authApi.getMe();
        if (isMounted) {
          setUser(me);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void initAuth();

    return () => {
      isMounted = false;
    };
  }, [handleAuthFailed]);

  const login = async (input: LoginInput): Promise<void> => {
    const data = await authApi.login(input);
    setUser(data.user);
  };

  const register = async (input: RegisterInput): Promise<void> => {
    const data = await authApi.register(input);
    setUser(data.user);
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    const allowed = Array.isArray(roles) ? roles : [roles];
    // ADMIN automatically inherits STAFF permissions
    if (user.role === 'ADMIN') return true;
    return allowed.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
