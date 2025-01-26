import axios, { AxiosInstance, AxiosError } from 'axios'; // ^1.6.0
import { jwtDecode } from 'jwt-decode'; // ^4.0.0
import { subtle } from 'crypto';

// Environment variables and constants
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const TOKEN_REFRESH_INTERVAL = 7200000; // 2 hours in milliseconds
const MAX_RETRY_ATTEMPTS = 3;
const RATE_LIMIT_BACKOFF = 1000; // Base backoff time in milliseconds

// Types
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  expiresIn: number;
}

interface JWTPayload {
  sub: string;
  role: string;
  permissions: string[];
  exp: number;
  iat: number;
}

interface Credentials {
  email: string;
  password: string;
}

class AuthService {
  private axios: AxiosInstance;
  private refreshInterval: NodeJS.Timer | null;
  private retryCount: number;
  private encryptionKey: CryptoKey | null;

  constructor() {
    this.axios = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Configure request interceptor
    this.axios.interceptors.request.use(
      async (config) => {
        const token = await this.getStoredToken('access');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Configure response interceptor with rate limiting
    this.axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '1', 10);
          await this.handleRateLimit(retryAfter);
        }
        return Promise.reject(error);
      }
    );

    this.refreshInterval = null;
    this.retryCount = 0;
    this.encryptionKey = null;
    this.initializeEncryption();
  }

  private async initializeEncryption(): Promise<void> {
    try {
      this.encryptionKey = await subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      throw new Error('Encryption initialization failed');
    }
  }

  private async encryptToken(token: string): Promise<string> {
    if (!this.encryptionKey) throw new Error('Encryption not initialized');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedData = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      this.encryptionKey,
      data
    );

    return JSON.stringify({
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encryptedData))
    });
  }

  private async decryptToken(encryptedToken: string): Promise<string> {
    if (!this.encryptionKey) throw new Error('Encryption not initialized');
    
    const { iv, data } = JSON.parse(encryptedToken);
    const decryptedData = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv)
      },
      this.encryptionKey,
      new Uint8Array(data)
    );

    return new TextDecoder().decode(decryptedData);
  }

  private async handleRateLimit(retryAfter: number): Promise<void> {
    const backoffTime = retryAfter * 1000 || RATE_LIMIT_BACKOFF;
    await new Promise(resolve => setTimeout(resolve, backoffTime));
  }

  private async storeToken(type: 'access' | 'refresh', token: string): Promise<void> {
    const encryptedToken = await this.encryptToken(token);
    localStorage.setItem(`${type}_token`, encryptedToken);
  }

  private async getStoredToken(type: 'access' | 'refresh'): Promise<string | null> {
    const encryptedToken = localStorage.getItem(`${type}_token`);
    if (!encryptedToken) return null;
    return this.decryptToken(encryptedToken);
  }

  private validateTOTPFormat(totpCode: string): boolean {
    return /^\d{6}$/.test(totpCode);
  }

  private validateCredentials(credentials: Credentials): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(credentials.email) && credentials.password.length >= 8;
  }

  public async login(credentials: Credentials, totpCode: string): Promise<AuthResponse> {
    if (!this.validateCredentials(credentials)) {
      throw new Error('Invalid credentials format');
    }

    if (!this.validateTOTPFormat(totpCode)) {
      throw new Error('Invalid TOTP code format');
    }

    try {
      const response = await this.axios.post<AuthResponse>('/auth/login', {
        ...credentials,
        totpCode
      });

      const { accessToken, refreshToken, user } = response.data;

      // Verify token format and permissions
      const decodedToken = jwtDecode<JWTPayload>(accessToken);
      if (decodedToken.role !== 'buyer') {
        throw new Error('Invalid user role');
      }

      // Store tokens securely
      await this.storeToken('access', accessToken);
      await this.storeToken('refresh', refreshToken);

      // Setup automatic token refresh
      this.setupTokenRefresh();

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid credentials or TOTP code');
        }
      }
      throw error;
    }
  }

  public async logout(): Promise<void> {
    try {
      const accessToken = await this.getStoredToken('access');
      if (accessToken) {
        await this.axios.post('/auth/logout');
      }
    } finally {
      this.clearTokenRefresh();
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  public async refreshSession(): Promise<AuthResponse> {
    const refreshToken = await this.getStoredToken('refresh');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.axios.post<AuthResponse>('/auth/refresh', {
        refreshToken
      });

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      await this.storeToken('access', accessToken);
      await this.storeToken('refresh', newRefreshToken);

      this.retryCount = 0;
      return response.data;
    } catch (error) {
      this.retryCount++;
      
      if (this.retryCount < MAX_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, this.retryCount * RATE_LIMIT_BACKOFF));
        return this.refreshSession();
      }
      
      throw error;
    }
  }

  public async verifyToken(): Promise<boolean> {
    try {
      const accessToken = await this.getStoredToken('access');
      if (!accessToken) return false;

      const decodedToken = jwtDecode<JWTPayload>(accessToken);
      
      // Check token expiration
      if (decodedToken.exp * 1000 < Date.now()) {
        return false;
      }

      // Verify role and permissions
      if (decodedToken.role !== 'buyer' || !decodedToken.permissions?.length) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private setupTokenRefresh(): void {
    this.clearTokenRefresh();
    
    // Refresh 5 minutes before expiration
    const refreshTime = TOKEN_REFRESH_INTERVAL - (5 * 60 * 1000);
    
    this.refreshInterval = setInterval(async () => {
      try {
        await this.refreshSession();
      } catch (error) {
        this.clearTokenRefresh();
        // Emit event or callback for session expiration
        window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
      }
    }, refreshTime);
  }

  private clearTokenRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

export const authService = new AuthService();