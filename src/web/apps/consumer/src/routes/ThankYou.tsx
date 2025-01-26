import React, { useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import Card from '@shared/components/layout/Card';
import ClickWall from '@rtb/components/ClickWall';
import { usePerformanceTracking } from '@shared/hooks'; // ^1.0.0
import { Analytics } from '@shared/analytics'; // ^1.0.0
import { colors } from '@shared/theme/colors';
import { spacing } from '@shared/theme/spacing';
import { mediaQueries } from '@shared/theme/breakpoints';

// Types
export type InsuranceVertical = 'auto' | 'home' | 'health' | 'life' | 'renters' | 'commercial';

export interface LeadData {
  id: string;
  score: number;
  userData: Record<string, unknown>;
  vertical: InsuranceVertical;
}

export interface ThankYouProps {
  className?: string;
  vertical: InsuranceVertical;
  leadData: LeadData;
  onExit: () => void;
}

// Styled components
const ThankYouContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: ${spacing.padding.lg};
  display: flex;
  flex-direction: column;
  gap: ${spacing.margin.md};

  ${mediaQueries.mobile} {
    padding: ${spacing.padding.sm};
    gap: ${spacing.margin.sm};
  }
`;

const ThankYouMessage = styled(Card)`
  text-align: center;
  padding: ${spacing.padding.lg};
  background-color: ${colors.ui.surface};
  animation: fadeIn 0.3s ease-in-out;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  h1 {
    color: ${colors.ui.text.primary};
    margin-bottom: ${spacing.margin.sm};
    font-size: 1.75rem;

    ${mediaQueries.mobile} {
      font-size: 1.5rem;
    }
  }

  p {
    color: ${colors.ui.text.secondary};
    margin-bottom: ${spacing.margin.md};
    font-size: 1.125rem;

    ${mediaQueries.mobile} {
      font-size: 1rem;
    }
  }
`;

const ProgressIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${spacing.margin.xs};
  margin: ${spacing.margin.md} 0;

  span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${colors.ui.primary};
    animation: pulse 1.5s ease-in-out infinite;

    &:nth-of-type(2) { animation-delay: 0.5s; }
    &:nth-of-type(3) { animation-delay: 1s; }
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(1.2); opacity: 1; }
  }
`;

/**
 * Custom hook for thank you page analytics
 */
const useThankYouAnalytics = (vertical: InsuranceVertical, leadData: LeadData) => {
  useEffect(() => {
    Analytics.track('thank_you_page_view', {
      leadId: leadData.id,
      vertical,
      score: leadData.score,
      timestamp: Date.now()
    });

    return () => {
      Analytics.track('thank_you_page_exit', {
        leadId: leadData.id,
        vertical,
        duration: Date.now() - performance.now()
      });
    };
  }, [vertical, leadData]);

  const handleBidClick = (bidId: string, amount: number) => {
    Analytics.track('thank_you_bid_click', {
      leadId: leadData.id,
      vertical,
      bidId,
      amount,
      timestamp: Date.now()
    });
  };

  return { handleBidClick };
};

/**
 * ThankYou component displays confirmation message and RTB-powered click wall
 * after successful lead form submission
 */
const ThankYou: React.FC<ThankYouProps> = ({
  className,
  vertical,
  leadData,
  onExit
}) => {
  // Initialize performance tracking
  const { trackPageLoad, trackUserInteraction } = usePerformanceTracking('thank_you_page');

  // Initialize analytics
  const { handleBidClick } = useThankYouAnalytics(vertical, leadData);

  // Track page load
  useEffect(() => {
    trackPageLoad();
  }, []);

  // Get vertical-specific content
  const content = useMemo(() => ({
    auto: {
      title: 'Thank You for Your Auto Insurance Quote Request',
      message: 'We\'re matching you with the best auto insurance offers.'
    },
    home: {
      title: 'Thank You for Your Home Insurance Quote Request',
      message: 'We\'re finding the best home insurance rates for you.'
    },
    health: {
      title: 'Thank You for Your Health Insurance Quote Request',
      message: 'We\'re searching for the best health insurance options.'
    },
    life: {
      title: 'Thank You for Your Life Insurance Quote Request',
      message: 'We\'re connecting you with top life insurance providers.'
    },
    renters: {
      title: 'Thank You for Your Renters Insurance Quote Request',
      message: 'We\'re finding affordable renters insurance options.'
    },
    commercial: {
      title: 'Thank You for Your Commercial Insurance Quote Request',
      message: 'We\'re matching you with business insurance experts.'
    }
  })[vertical], [vertical]);

  return (
    <ErrorBoundary
      fallback={<div>Something went wrong. Please try again later.</div>}
      onError={(error) => {
        console.error('ThankYou component error:', error);
        Analytics.track('thank_you_page_error', {
          leadId: leadData.id,
          error: error.message
        });
      }}
    >
      <ThankYouContainer className={className}>
        <ThankYouMessage
          elevation={2}
          role="status"
          aria-live="polite"
        >
          <h1>{content.title}</h1>
          <p>{content.message}</p>
          <ProgressIndicator aria-hidden="true">
            <span />
            <span />
            <span />
          </ProgressIndicator>
        </ThankYouMessage>

        <ClickWall
          leadId={leadData.id}
          vertical={vertical}
          leadScore={leadData.score}
          userData={leadData.userData}
          onBidClick={(bid) => {
            handleBidClick(bid.id, bid.amount);
            trackUserInteraction('bid_click');
          }}
          refreshInterval={30000}
        />
      </ThankYouContainer>
    </ErrorBoundary>
  );
};

export default ThankYou;