import React, { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { analytics } from '@segment/analytics-next'; // ^1.51.0
import Card from '@shared/components/layout/Card';
import Select from '@shared/components/forms/Select';
import { formActions } from '../store/slices/formSlice';
import { InsuranceVertical } from '../../../backend/services/lead-service/src/interfaces/lead.interface';

// Constants for security levels and vertical labels
const SECURITY_LEVELS = {
  HIGH: 'pii_encrypted',
  MEDIUM: 'pii_masked',
  LOW: 'public'
} as const;

const VERTICAL_LABELS = {
  AUTO: 'Auto Insurance',
  HOME: 'Home Insurance',
  RENTERS: 'Renters Insurance',
  HEALTH: 'Health Insurance',
  LIFE: 'Life Insurance',
  COMMERCIAL: 'Commercial Insurance'
} as const;

// Interface for cross-sell offers with security and accessibility
interface CrossSellOffer {
  vertical: InsuranceVertical;
  title: string;
  description: string;
  savingsEstimate: number;
  mlScore: number;
  securityLevel: keyof typeof SECURITY_LEVELS;
  accessibilityLabels: {
    offer: string;
    savings: string;
    action: string;
  };
}

// Secure component for cross-sell opportunities
const CrossSell: React.FC = () => {
  const dispatch = useDispatch();

  // Get form state with memoization
  const currentVertical = useSelector((state: any) => state.form.currentVertical);
  const crossSellOpportunities = useSelector((state: any) => state.form.crossSellOpportunities);
  const formData = useSelector((state: any) => state.form.formData);

  // Memoize filtered and sorted cross-sell offers
  const sortedOffers = useMemo(() => {
    return crossSellOpportunities
      .filter((offer: CrossSellOffer) => offer.vertical !== currentVertical)
      .sort((a: CrossSellOffer, b: CrossSellOffer) => b.mlScore - a.mlScore);
  }, [crossSellOpportunities, currentVertical]);

  // Secure handler for cross-sell selection
  const handleCrossSellSelect = useCallback(async (vertical: InsuranceVertical) => {
    try {
      // Track selection with anonymized data
      analytics.track('Cross Sell Selected', {
        from_vertical: currentVertical,
        to_vertical: vertical,
        ml_score: sortedOffers.find(o => o.vertical === vertical)?.mlScore,
        timestamp: new Date().toISOString()
      });

      // Encrypt PII fields before state transition
      await dispatch(formActions.encryptPiiFields());

      // Update form state
      dispatch(formActions.setCurrentVertical(vertical));
      dispatch(formActions.setCurrentStep('vertical-specific'));

    } catch (error) {
      console.error('Cross-sell transition failed:', error);
      // Handle error appropriately without exposing sensitive data
    }
  }, [dispatch, currentVertical, sortedOffers]);

  // Handle secure skip of cross-sell
  const handleSkip = useCallback(() => {
    analytics.track('Cross Sell Skipped', {
      from_vertical: currentVertical,
      timestamp: new Date().toISOString()
    });
    dispatch(formActions.setCurrentStep('thank-you'));
  }, [dispatch, currentVertical]);

  // Render cross-sell opportunities with security and accessibility
  return (
    <div 
      role="region" 
      aria-label="Additional Insurance Opportunities"
      className="cross-sell-container"
    >
      <h2>Save More on Insurance Bundles</h2>
      <p>Based on your profile, we've found these additional savings opportunities:</p>

      <div className="offers-grid">
        {sortedOffers.map((offer: CrossSellOffer) => (
          <Card
            key={offer.vertical}
            elevation={2}
            padding="lg"
            role="button"
            tabIndex={0}
            ariaLabel={offer.accessibilityLabels.offer}
            onClick={() => handleCrossSellSelect(offer.vertical)}
          >
            <h3>{VERTICAL_LABELS[offer.vertical]}</h3>
            <p>{offer.description}</p>
            <div className="savings-estimate" aria-label={offer.accessibilityLabels.savings}>
              Estimated Savings: ${offer.savingsEstimate}
            </div>
          </Card>
        ))}
      </div>

      <div className="actions-container">
        <Select
          options={sortedOffers.map(offer => ({
            value: offer.vertical,
            label: VERTICAL_LABELS[offer.vertical]
          }))}
          onChange={(vertical: InsuranceVertical) => handleCrossSellSelect(vertical)}
          label="Select Additional Insurance"
          placeholder="Choose an insurance type"
          testId="cross-sell-select"
          fullWidth
        />

        <button
          onClick={handleSkip}
          className="skip-button"
          aria-label="Skip additional insurance offers"
        >
          Continue without additional coverage
        </button>
      </div>
    </div>
  );
};

export default CrossSell;