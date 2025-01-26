import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import { useAuth } from '../hooks/useAuth';
import Input from '@shared/components/forms/Input';
import Alert from '@shared/components/feedback/Alert';

// Constants for rate limiting and validation
const RATE_LIMIT_ATTEMPTS = 3;
const RATE_LIMIT_TIMEOUT = 300000; // 5 minutes
const PASSWORD_MIN_LENGTH = 8;

// Interface for form state
interface LoginFormState {
  email: string;
  password: string;
  totpCode: string;
}

// Interface for form validation state
interface ValidationState {
  email: string;
  password: string;
  totpCode: string;
}

// Styled components with WCAG 2.1 AA compliance
const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background-color: ${props => props.theme.colors.ui.background};
  color: ${props => props.theme.colors.ui.text.primary};
`;

const LoginForm = styled.form`
  width: 100%;
  max-width: 400px;
  padding: 32px;
  background-color: ${props => props.theme.colors.ui.surface};
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;

  @media (prefers-reduced-motion: no-preference) {
    transition: transform 0.2s ease;
  }
`;

const Title = styled.h1`
  font-size: ${props => props.theme.typography.fontSize['2xl']};
  font-weight: ${props => props.theme.typography.fontWeights.bold};
  margin-bottom: 24px;
  text-align: center;
  color: ${props => props.theme.colors.ui.text.primary};
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 12px;
  margin-top: 24px;
  background-color: ${props => props.theme.colors.ui.primary};
  color: ${props => props.theme.colors.ui.background};
  border: none;
  border-radius: 4px;
  font-size: ${props => props.theme.typography.fontSize.base};
  font-weight: ${props => props.theme.typography.fontWeights.medium};
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:disabled {
    background-color: ${props => props.theme.colors.ui.text.disabled};
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.ui.primary};
    outline-offset: 2px;
  }
`;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error: authError, hasPermission } = useAuth();

  // Form state
  const [formState, setFormState] = useState<LoginFormState>({
    email: '',
    password: '',
    totpCode: '',
  });

  // Validation state
  const [validationErrors, setValidationErrors] = useState<ValidationState>({
    email: '',
    password: '',
    totpCode: '',
  });

  // Rate limiting state
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitReset, setRateLimitReset] = useState<number | null>(null);

  // Alert state
  const [alert, setAlert] = useState<{ severity: 'error' | 'info'; message: string } | null>(null);

  // Reset rate limiting after timeout
  useEffect(() => {
    if (isRateLimited && rateLimitReset) {
      const timer = setTimeout(() => {
        setIsRateLimited(false);
        setLoginAttempts(0);
        setRateLimitReset(null);
      }, RATE_LIMIT_TIMEOUT);

      return () => clearTimeout(timer);
    }
  }, [isRateLimited, rateLimitReset]);

  // Validate form input
  const validateForm = (): boolean => {
    const errors: ValidationState = {
      email: '',
      password: '',
      totpCode: '',
    };

    // Email validation
    if (!formState.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
      errors.email = 'Invalid email format';
    }

    // Password validation
    if (!formState.password) {
      errors.password = 'Password is required';
    } else if (formState.password.length < PASSWORD_MIN_LENGTH) {
      errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }

    // TOTP validation
    if (!formState.totpCode) {
      errors.totpCode = 'Authentication code is required';
    } else if (!/^\d{6}$/.test(formState.totpCode)) {
      errors.totpCode = 'Authentication code must be 6 digits';
    }

    setValidationErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRateLimited) {
      setAlert({
        severity: 'error',
        message: `Too many attempts. Please try again in ${Math.ceil(RATE_LIMIT_TIMEOUT / 60000)} minutes.`
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      await login(formState.email, formState.password, formState.totpCode);
      
      // Check user permissions and redirect accordingly
      if (hasPermission('campaign.view')) {
        navigate('/dashboard');
      } else {
        setAlert({
          severity: 'error',
          message: 'Insufficient permissions to access the portal'
        });
      }
    } catch (error) {
      setLoginAttempts(prev => prev + 1);
      
      if (loginAttempts + 1 >= RATE_LIMIT_ATTEMPTS) {
        setIsRateLimited(true);
        setRateLimitReset(Date.now() + RATE_LIMIT_TIMEOUT);
        setAlert({
          severity: 'error',
          message: `Account locked. Please try again in ${Math.ceil(RATE_LIMIT_TIMEOUT / 60000)} minutes.`
        });
      } else {
        setAlert({
          severity: 'error',
          message: 'Invalid credentials or authentication code'
        });
      }
    }
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error when user starts typing
    if (validationErrors[name as keyof ValidationState]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  return (
    <LoginContainer>
      <LoginForm 
        onSubmit={handleSubmit}
        aria-labelledby="login-title"
        noValidate
      >
        <Title id="login-title">Insurance Portal Login</Title>

        {(alert || authError) && (
          <Alert
            severity={alert?.severity || 'error'}
            message={alert?.message || authError || ''}
            onClose={() => setAlert(null)}
          />
        )}

        <Input
          id="email"
          name="email"
          type="email"
          label="Email Address"
          value={formState.email}
          onChange={handleInputChange}
          error={validationErrors.email}
          disabled={isLoading || isRateLimited}
          required
          autoComplete="email"
        />

        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          value={formState.password}
          onChange={handleInputChange}
          error={validationErrors.password}
          disabled={isLoading || isRateLimited}
          required
          autoComplete="current-password"
        />

        <Input
          id="totpCode"
          name="totpCode"
          type="text"
          label="Authentication Code"
          value={formState.totpCode}
          onChange={handleInputChange}
          error={validationErrors.totpCode}
          disabled={isLoading || isRateLimited}
          required
          autoComplete="one-time-code"
          maxLength={6}
        />

        <SubmitButton
          type="submit"
          disabled={isLoading || isRateLimited}
          aria-busy={isLoading}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </SubmitButton>
      </LoginForm>
    </LoginContainer>
  );
};

export default Login;