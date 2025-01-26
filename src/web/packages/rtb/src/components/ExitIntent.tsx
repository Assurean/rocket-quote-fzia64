import React, { useState, useEffect, useCallback, useRef } from 'react'; // ^18.2.0
import styled from '@emotion/styled'; // ^11.11.0
import { debounce } from 'lodash'; // ^4.17.21
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import { useBidding, BiddingError } from '../hooks/useBidding';
import { useTracking } from '../hooks/useTracking';
import Card from '@shared/components/layout/Card';
import { ui } from '@shared/theme/colors';
import { spacing } from '@shared/theme/spacing';

// Styled components with accessibility and animation support
const ExitIntentOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: ${ui.overlay.dark};
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  animation: fadeIn 0.3s ease forwards;
  
  @keyframes fadeIn {
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
  }

  @media (max-width: 768px) {
    padding: ${spacing.padding.sm};
  }
`;

const ExitIntentContent = styled.div`
  max-width: 600px;
  width: 90%;
  background: ${ui.background};
  border-radius: 8px;
  padding: ${spacing.padding.lg};
  position: relative;
  transform: translateY(20px);
  animation: slideUp 0.3s ease forwards;
  
  @keyframes slideUp {
    to { transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transform: none;
  }

  @media (max-width: 768px) {
    padding: ${spacing.padding.md};
    width: 95%;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: ${spacing.padding.xs};
  right: ${spacing.padding.xs};
  background: transparent;
  border: none;
  padding: ${spacing.padding.xs};
  cursor: pointer;
  color: ${ui.text.secondary};
  
  &:hover {
    color: ${ui.text.primary};
  }

  &:focus-visible {
    outline: 2px solid ${ui.primary};
    outline-offset: 2px;
  }
`;

const OffersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${spacing.padding.md};
  margin-top: ${spacing.margin.md};
`;

// Component interfaces
interface ExitIntentProps {
  leadId: string;
  vertical: string;
  leadScore: number;
  userData: Record<string, unknown>;
  isEnabled: boolean;
  onClose: () => void;
  deviceInfo: {
    isMobile: boolean;
    viewport: { width: number; height: number };
  };
  performanceConfig?: {
    sampleRate: number;
    sensitivity: number;
    debounceMs: number;
  };
}

const ExitIntent: React.FC<ExitIntentProps> = ({
  leadId,
  vertical,
  leadScore,
  userData,
  isEnabled,
  onClose,
  deviceInfo,
  performanceConfig = {
    sampleRate: 0.1,
    sensitivity: 0.8,
    debounceMs: 250
  }
}) => {
  // State management
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Initialize RTB hooks
  const {
    bids,
    isLoading,
    error,
    refreshBids,
    handleBidClick
  } = useBidding({
    leadId,
    vertical,
    leadScore,
    userData,
    refreshInterval: 30000
  });

  const {
    trackImpression,
    trackClick,
    trackPerformance
  } = useTracking({
    leadId,
    debugMode: process.env.NODE_ENV === 'development',
    performanceConfig: {
      sampleRate: performanceConfig.sampleRate,
      metricsBuffer: 100,
      flushInterval: 5000
    }
  });

  // Exit intent detection handler
  const handleExitIntent = useCallback(
    debounce((event: MouseEvent): void => {
      if (!isEnabled || hasTriggered || isVisible) return;

      const { clientY } = event;
      const { sensitivity } = performanceConfig;
      const threshold = deviceInfo.viewport.height * (1 - sensitivity);

      if (clientY <= threshold) {
        setIsVisible(true);
        setHasTriggered(true);
        previousFocusRef.current = document.activeElement as HTMLElement;
        refreshBids();
      }
    }, performanceConfig.debounceMs),
    [isEnabled, hasTriggered, isVisible, performanceConfig]
  );

  // Mobile-specific scroll detection
  const handleMobileScroll = useCallback(
    debounce(() => {
      if (!isEnabled || hasTriggered || isVisible) return;

      const scrollPosition = window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const scrollPercentage = (scrollPosition + viewportHeight) / pageHeight;

      if (scrollPercentage >= 0.7) {
        setIsVisible(true);
        setHasTriggered(true);
        previousFocusRef.current = document.activeElement as HTMLElement;
        refreshBids();
      }
    }, performanceConfig.debounceMs),
    [isEnabled, hasTriggered, isVisible, performanceConfig]
  );

  // Enhanced bid click handler
  const onBidClick = async (bidId: string, bidUrl: string) => {
    try {
      await handleBidClick({ id: bidId, targetUrl: bidUrl } as any);
      await trackClick({ id: bidId } as any, {
        vertical,
        leadScore,
        deviceType: deviceInfo.isMobile ? 'mobile' : 'desktop'
      });
      window.location.href = bidUrl;
    } catch (error) {
      console.error('Bid click failed:', error);
    }
  };

  // Setup event listeners
  useEffect(() => {
    if (!isEnabled) return;

    if (deviceInfo.isMobile) {
      window.addEventListener('scroll', handleMobileScroll, { passive: true });
    } else {
      document.addEventListener('mousemove', handleExitIntent);
    }

    return () => {
      if (deviceInfo.isMobile) {
        window.removeEventListener('scroll', handleMobileScroll);
      } else {
        document.removeEventListener('mousemove', handleExitIntent);
      }
    };
  }, [isEnabled, deviceInfo.isMobile, handleExitIntent, handleMobileScroll]);

  // Manage focus trap and accessibility
  useEffect(() => {
    if (isVisible && contentRef.current) {
      contentRef.current.focus();
    }
    return () => {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isVisible]);

  // Track impressions when modal becomes visible
  useEffect(() => {
    if (isVisible && bids.length > 0) {
      bids.forEach(bid => {
        trackImpression(bid, {
          vertical,
          leadScore,
          deviceType: deviceInfo.isMobile ? 'mobile' : 'desktop'
        });
      });
    }
  }, [isVisible, bids]);

  if (!isVisible) return null;

  return (
    <ErrorBoundary fallback={<div>Error loading offers</div>}>
      <ExitIntentOverlay
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-intent-title"
      >
        <ExitIntentContent
          ref={contentRef}
          tabIndex={-1}
        >
          <CloseButton
            onClick={onClose}
            aria-label="Close offers"
          >
            ✕
          </CloseButton>
          
          <h2 id="exit-intent-title">
            Special Insurance Offers
          </h2>

          {isLoading && <div aria-busy="true">Loading offers...</div>}
          
          {error && (
            <div role="alert">
              Unable to load offers. Please try again later.
            </div>
          )}

          <OffersGrid>
            {bids.map(bid => (
              <Card
                key={bid.id}
                elevation={2}
                padding="md"
                onClick={() => onBidClick(bid.id, bid.targetUrl)}
                role="button"
                tabIndex={0}
                ariaLabel={`View offer from ${bid.advertiserId}`}
              >
                <div dangerouslySetInnerHTML={{ __html: bid.creativeHtml }} />
              </Card>
            ))}
          </OffersGrid>
        </ExitIntentContent>
      </ExitIntentOverlay>
    </ErrorBoundary>
  );
};

export default ExitIntent;