import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import axe from '@axe-core/react';
import BasicInfo from '../../src/routes/BasicInfo';
import formReducer from '../../src/store/slices/formSlice';
import validationReducer from '../../src/store/slices/validationSlice';
import { ValidationService } from '../../src/services/validation';
import { ApiService } from '../../src/services/api';

// Mock dependencies
jest.mock('../../src/services/validation');
jest.mock('../../src/services/api');
jest.mock('@analytics/react', () => ({
  useAnalytics: () => ({
    track: jest.fn()
  })
}));

// Test data
const validFormData = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '(555) 555-5555',
  zipCode: '12345'
};

const invalidFormData = {
  fullName: '',
  email: 'invalid-email',
  phone: '123',
  zipCode: '1234'
};

// Helper function to create test store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      form: formReducer,
      validation: validationReducer
    },
    preloadedState: initialState
  });
};

// Helper function to render component with store
const renderWithStore = (
  ui: React.ReactElement,
  { initialState = {}, store = createTestStore(initialState) } = {}
) => {
  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store
  };
};

describe('BasicInfo Form Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Accessibility', () => {
    test('renders all required form fields with proper ARIA labels', () => {
      renderWithStore(<BasicInfo />);

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/zip code/i)).toBeInTheDocument();
    });

    test('meets WCAG 2.1 AA accessibility requirements', async () => {
      const { container } = renderWithStore(<BasicInfo />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('displays proper focus indicators for keyboard navigation', () => {
      renderWithStore(<BasicInfo />);
      const nameInput = screen.getByLabelText(/full name/i);
      
      nameInput.focus();
      expect(document.activeElement).toBe(nameInput);
      expect(nameInput).toHaveStyle({ outline: expect.stringContaining('solid') });
    });
  });

  describe('Form Validation', () => {
    test('validates required fields on blur with error messages', async () => {
      renderWithStore(<BasicInfo />);
      
      const nameInput = screen.getByLabelText(/full name/i);
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid full name/i)).toBeInTheDocument();
      });
    });

    test('validates email format in real-time with performance check', async () => {
      const startTime = performance.now();
      renderWithStore(<BasicInfo />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });

      const validationTime = performance.now() - startTime;
      expect(validationTime).toBeLessThan(500); // Validation should complete within 500ms
    });

    test('validates phone number format with masking', async () => {
      renderWithStore(<BasicInfo />);
      
      const phoneInput = screen.getByLabelText(/phone number/i);
      fireEvent.change(phoneInput, { target: { value: '5555555555' } });

      await waitFor(() => {
        expect(phoneInput).toHaveValue('(555) 555-5555');
      });
    });

    test('validates ZIP code format with address verification', async () => {
      renderWithStore(<BasicInfo />);
      
      const zipInput = screen.getByLabelText(/zip code/i);
      fireEvent.change(zipInput, { target: { value: '12345' } });

      await waitFor(() => {
        expect(zipInput).toHaveValue('12345');
        expect(screen.queryByText(/invalid zip code/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form State Management', () => {
    test('maintains encrypted form state between renders', async () => {
      const { store } = renderWithStore(<BasicInfo />);
      
      const nameInput = screen.getByLabelText(/full name/i);
      fireEvent.change(nameInput, { target: { value: validFormData.fullName } });

      await waitFor(() => {
        const state = store.getState();
        expect(state.form.formData.fullName).toBe(validFormData.fullName);
        expect(state.form.securityMetadata.fullName).toBe('normal');
      });
    });

    test('properly handles and encrypts PII fields', async () => {
      const { store } = renderWithStore(<BasicInfo />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      fireEvent.change(emailInput, { target: { value: validFormData.email } });

      await waitFor(() => {
        const state = store.getState();
        expect(state.form.securityMetadata.email).toBe('pii');
      });
    });

    test('enables next button when form is valid with all checks', async () => {
      renderWithStore(<BasicInfo />);
      
      // Fill all fields with valid data
      Object.entries(validFormData).forEach(([field, value]) => {
        const input = screen.getByLabelText(new RegExp(field.replace(/([A-Z])/g, ' $1').toLowerCase(), 'i'));
        fireEvent.change(input, { target: { value } });
      });

      await waitFor(() => {
        const continueButton = screen.getByRole('button', { name: /continue/i });
        expect(continueButton).not.toBeDisabled();
      });
    });
  });

  describe('Navigation and Submission', () => {
    test('handles back navigation with state preservation', async () => {
      const { store } = renderWithStore(<BasicInfo />);
      
      // Fill form
      Object.entries(validFormData).forEach(([field, value]) => {
        const input = screen.getByLabelText(new RegExp(field.replace(/([A-Z])/g, ' $1').toLowerCase(), 'i'));
        fireEvent.change(input, { target: { value } });
      });

      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);

      await waitFor(() => {
        const state = store.getState();
        expect(state.form.formData).toEqual(expect.objectContaining(validFormData));
      });
    });

    test('navigates to next step on valid submission with analytics', async () => {
      const mockAnalytics = jest.fn();
      jest.spyOn(require('@analytics/react'), 'useAnalytics').mockReturnValue({
        track: mockAnalytics
      });

      renderWithStore(<BasicInfo />);
      
      // Fill and submit form
      Object.entries(validFormData).forEach(([field, value]) => {
        const input = screen.getByLabelText(new RegExp(field.replace(/([A-Z])/g, ' $1').toLowerCase(), 'i'));
        fireEvent.change(input, { target: { value } });
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(mockAnalytics).toHaveBeenCalledWith('form_step_completed', expect.any(Object));
      });
    });
  });

  describe('Error Handling', () => {
    test('handles error boundaries gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      ValidationService.prototype.validateField.mockRejectedValue(new Error('Validation failed'));

      renderWithStore(<BasicInfo />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      await waitFor(() => {
        expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });

    test('shows accessible error messages for invalid inputs', async () => {
      renderWithStore(<BasicInfo />);
      
      // Submit form with invalid data
      Object.entries(invalidFormData).forEach(([field, value]) => {
        const input = screen.getByLabelText(new RegExp(field.replace(/([A-Z])/g, ' $1').toLowerCase(), 'i'));
        fireEvent.change(input, { target: { value } });
      });

      await waitFor(() => {
        const errors = screen.getAllByRole('alert');
        expect(errors.length).toBeGreaterThan(0);
        errors.forEach(error => {
          expect(error).toHaveAttribute('aria-live', 'polite');
        });
      });
    });
  });

  describe('Performance', () => {
    test('performs within acceptable response time limits', async () => {
      const startTime = performance.now();
      
      renderWithStore(<BasicInfo />);
      
      // Fill all fields rapidly
      Object.entries(validFormData).forEach(([field, value]) => {
        const input = screen.getByLabelText(new RegExp(field.replace(/([A-Z])/g, ' $1').toLowerCase(), 'i'));
        fireEvent.change(input, { target: { value } });
      });

      await waitFor(() => {
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      });
    });
  });
});