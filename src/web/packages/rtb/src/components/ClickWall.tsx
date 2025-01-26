import React, { useCallback, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { analytics } from '@analytics/react'; // ^0.1.0
import ClickCard from './ClickCard';
import Grid from '@shared/components/layout/Grid';
import useBidding from '../hooks/useBidding';

// Types
export type InsuranceVertical = 'auto' | 'home' | 'health' | 'life' | 'renters' | 'commercial';

export interface UserData {
  sessionId?: string;
  deviceId?: string;
  ipAddress?: string;
  [key: string]: unknown;
}

export interface ClickWallProps {
  leadId: string;
  vertical: InsuranceVertical;
  leadScore: number;
  userData: UserData;
  className?: string;
  onBidClick?: (bid: Bid) => void;
  refreshInterval?: number;
}

// Styled components with vertical-specific theming
const StyledClickWall = styled.div<{ vertical: InsuranceVertical }>`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing(3)};
  background: ${({ theme, vertical }) => theme.verticals[vertical].background};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  min-height: 200px;

  @media (max-width: ${({ theme }) => theme.breakpoints.md}px) {
    padding: ${({ theme }) => theme.spacing(2)};
  }
`;

const LoadingOverlay = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  background: ${({ theme }) => theme.palette.background.default};
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.palette.error.main};
  text-align: center;
  padding: ${({ theme }) => theme.spacing(2)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
  border: 1px solid ${({ theme }) => theme.palette.error.light};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
`;

/**
 * ClickWall component for displaying RTB advertisements with enhanced features
 * Implements performance optimization, accessibility, and responsive design
 */
export const ClickWall: React.FC<ClickWallProps> = React.memo(({
  leadId,
  vertical,
  leadScore,
  userData,
  className,
  onBidClick,
  refreshInterval = 30000
}) => {
  // Initialize RTB functionality with useBidding hook
  const {
    bids,
    isLoading,
    error,
    refreshBids,
    handleBidClick,
    isStale,
    resetError
  } = useBidding({
    leadId,
    vertical,
    leadScore,
    userData,
    refreshInterval
  });

  // Set up analytics tracking
  useEffect(() => {
    analytics.track('click_wall_view', {
      leadId,
      vertical,
      leadScore,
      timestamp: Date.now()
    });
  }, [leadId, vertical, leadScore]);

  // Handle bid click with tracking
  const handleClick = useCallback((bid: Bid) => {
    handleBidClick(bid);
    onBidClick?.(bid);
    
    analytics.track('click_wall_interaction', {
      leadId,
      vertical,
      bidId: bid.id,
      advertiserId: bid.advertiserId,
      amount: bid.amount,
      timestamp: Date.now()
    });
  }, [leadId, vertical, handleBidClick, onBidClick]);

  // Memoized grid configuration based on vertical
  const gridConfig = useMemo(() => ({
    auto: { columns: 3, spacing: 2 },
    home: { columns: 2, spacing: 3 },
    health: { columns: 2, spacing: 2 },
    life: { columns: 1, spacing: 3 },
    renters: { columns: 2, spacing: 2 },
    commercial: { columns: 3, spacing: 2 }
  })[vertical], [vertical]);

  // Error retry handler
  const handleRetry = useCallback(() => {
    resetError();
    refreshBids();
  }, [resetError, refreshBids]);

  return (
    <StyledClickWall
      vertical={vertical}
      className={className}
      role="complementary"
      aria-label={`Insurance offers for ${vertical} insurance`}
      data-testid="click-wall"
    >
      {isLoading && (
        <LoadingOverlay role="progressbar" aria-label="Loading insurance offers">
          <span>Loading offers...</span>
        </LoadingOverlay>
      )}

      {error && (
        <ErrorMessage role="alert">
          <p>Unable to load insurance offers</p>
          <button onClick={handleRetry}>Retry</button>
        </ErrorMessage>
      )}

      {!isLoading && !error && (
        <Grid
          container
          spacing={gridConfig.spacing}
          role="list"
          aria-label="Insurance offers"
        >
          {bids.map((bid, index) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={12 / gridConfig.columns}
              key={bid.id}
              role="listitem"
            >
              <ClickCard
                bid={bid}
                onBidClick={handleClick}
                isHighlighted={index === 0}
                testId={`click-card-${index}`}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {isStale && (
        <div role="status" aria-live="polite" className="sr-only">
          Updating insurance offers...
        </div>
      )}
    </StyledClickWall>
  );
});

ClickWall.displayName = 'ClickWall';

export default ClickWall;