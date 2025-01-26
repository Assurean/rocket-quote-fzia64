import React, { useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import DOMPurify from 'dompurify';
import { analytics } from '@analytics/react';
import Card from '@shared/components/layout/Card';
import { formatBidAmount } from '../utils/bid';
import useBidding from '../hooks/useBidding';

// Interfaces
export interface Bid {
  id: string;
  amount: number;
  title: string;
  description: string;
  imageUrl: string;
  targetUrl: string;
  advertiserName: string;
  creativeHtml: string;
}

export interface ClickCardProps {
  bid: Bid;
  onBidClick: (bid: Bid) => void;
  className?: string;
  isHighlighted?: boolean;
  testId?: string;
}

// Styled components with enterprise-grade styling and animations
const StyledClickCard = styled(Card)<{ isHighlighted: boolean }>`
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
  background-color: ${({ theme, isHighlighted }) => 
    isHighlighted ? theme.colors.ui.surface : '#ffffff'};
  border: 1px solid ${({ theme }) => theme.colors.ui.border};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.ui.primary};
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    margin: 8px 0;
  }
`;

const BidContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;

  @media (max-width: 768px) {
    padding: 12px;
  }
`;

const BidHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const BidTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.ui.text.primary};
`;

const BidAmount = styled.span`
  font-size: 1.25rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.feedback.success.main};
`;

const BidDescription = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.ui.text.secondary};
  font-size: 0.875rem;
  line-height: 1.5;
`;

const BidImage = styled.img`
  width: 100%;
  height: auto;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: 4px;
`;

const AdvertiserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.ui.text.secondary};
`;

/**
 * ClickCard component for displaying RTB advertisements with enhanced features
 * Implements accessibility, tracking, and security measures
 */
export const ClickCard: React.FC<ClickCardProps> = React.memo(({
  bid,
  onBidClick,
  className,
  isHighlighted = false,
  testId
}) => {
  // Sanitize HTML content for security
  const sanitizedCreativeHtml = useMemo(() => {
    return DOMPurify.sanitize(bid.creativeHtml, {
      ALLOWED_TAGS: ['p', 'span', 'strong', 'em', 'br'],
      ALLOWED_ATTR: ['class', 'id']
    });
  }, [bid.creativeHtml]);

  // Format bid amount with locale support
  const formattedAmount = useMemo(() => {
    return formatBidAmount(bid.amount, navigator.language);
  }, [bid.amount]);

  // Enhanced click handler with tracking
  const handleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    
    // Track click event
    analytics.track('rtb_card_click', {
      bidId: bid.id,
      amount: bid.amount,
      advertiser: bid.advertiserName,
      timestamp: Date.now()
    });

    onBidClick(bid);
  }, [bid, onBidClick]);

  // Keyboard interaction handler
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(event as unknown as React.MouseEvent);
    }
  }, [handleClick]);

  // Lazy load image with loading state
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const handleImageLoad = () => setImageLoaded(true);

  return (
    <StyledClickCard
      elevation={isHighlighted ? 2 : 1}
      padding="none"
      className={className}
      isHighlighted={isHighlighted}
      onClick={handleClick}
      onKeyPress={handleKeyPress}
      role="button"
      tabIndex={0}
      aria-label={`Advertisement from ${bid.advertiserName}: ${bid.title}`}
      data-testid={testId}
    >
      <BidContent>
        <BidHeader>
          <BidTitle>{bid.title}</BidTitle>
          <BidAmount aria-label={`Bid amount: ${formattedAmount}`}>
            {formattedAmount}
          </BidAmount>
        </BidHeader>

        {bid.imageUrl && (
          <BidImage
            src={bid.imageUrl}
            alt=""
            loading="lazy"
            onLoad={handleImageLoad}
            style={{ opacity: imageLoaded ? 1 : 0 }}
            aria-hidden="true"
          />
        )}

        <BidDescription>
          {bid.description}
          <div 
            dangerouslySetInnerHTML={{ __html: sanitizedCreativeHtml }}
            aria-hidden="true"
          />
        </BidDescription>

        <AdvertiserInfo>
          <span aria-label="Advertiser">
            {bid.advertiserName}
          </span>
        </AdvertiserInfo>
      </BidContent>
    </StyledClickCard>
  );
});

ClickCard.displayName = 'ClickCard';

export default ClickCard;