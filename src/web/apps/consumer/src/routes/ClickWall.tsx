import React, { useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import { useIntersectionObserver } from 'react-intersection-observer';
import { useSelector } from 'react-redux';
import { ErrorBoundary } from 'react-error-boundary';
import ClickWall from '@rtb/components/ClickWall';
import { sessionActions } from '../store/slices/sessionSlice';

// Styled components with responsive design
const StyledContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  background-color: ${({ theme }) => theme.colors.ui.background};
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: ${({ theme }) => theme.spacing(2)};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing(1)};
  }
`;

const Header = styled.h1`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.colors.ui.text.primary};
  font-size: ${({ theme }) => theme.typography.h4.fontSize};
  font-weight: ${({ theme }) => theme.typography.fontWeightMedium};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    font-size: ${({ theme }) => theme.typography.h5.fontSize};
  }
`;

const ThankYouMessage = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  color: ${({ theme }) => theme.colors.feedback.success.main};
  font-size: ${({ theme }) => theme.typography.h6.fontSize};
`;

// Error fallback component
const ErrorFallback = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  color: ${({ theme }) => theme.colors.feedback.error.main};
  text-align: center;
  border: 1px solid ${({ theme }) => theme.colors.feedback.error.light};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  margin: ${({ theme }) => theme.spacing(2)};
`;

// Performance tracking decorator
const withPerformanceTracking = (WrappedComponent: React.ComponentType) => {
  return function PerformanceTrackedComponent(props: any) {
    useEffect(() => {
      const startTime = performance.now();
      
      return () => {
        sessionActions.trackPerformance({
          pageType: 'click_wall',
          loadTime: performance.now() - startTime,
          timestamp: Date.now()
        });
      };
    }, []);

    return <WrappedComponent {...props} />;
  };
};

const ClickWallRoute: React.FC = () => {
  const navigate = useNavigate();
  const { ref, inView } = useIntersectionObserver();

  // Memoized selectors
  const formData = useSelector((state: any) => state.form.data);
  const sessionData = useSelector((state: any) => state.session);

  // Exit intent detection
  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        sessionActions.trackExitIntent({
          pageType: 'click_wall',
          timestamp: Date.now(),
          mousePosition: { x: e.clientX, y: e.clientY }
        });
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  // Redirect if no form data
  useEffect(() => {
    if (!formData?.leadId) {
      navigate('/', { replace: true });
    }
  }, [formData, navigate]);

  // Enhanced click handler with security and tracking
  const handleAdClick = useCallback(async (clickId: string, targetUrl: string, metadata: any) => {
    try {
      // Update behavior data
      sessionActions.updateBehaviorData({
        lastInteraction: Date.now(),
        clickData: {
          clickId,
          targetUrl,
          metadata
        }
      });

      // Track click event
      sessionActions.trackPerformance({
        eventType: 'ad_click',
        clickId,
        timestamp: Date.now(),
        metadata
      });

      // Validate URL before navigation
      const url = new URL(targetUrl);
      if (url.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }

      // Execute navigation
      window.location.href = targetUrl;
    } catch (error) {
      console.error('Click handling error:', error);
    }
  }, []);

  // Memoized user data for RTB
  const userData = useMemo(() => ({
    sessionId: sessionData.sessionId,
    deviceInfo: sessionData.deviceInfo,
    behaviorData: sessionData.behaviorData,
    leadScore: formData?.leadScore,
    vertical: formData?.vertical
  }), [sessionData, formData]);

  if (!formData?.leadId) {
    return null;
  }

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <ErrorFallback>
          <p>Something went wrong displaying insurance offers.</p>
          <p>{error.message}</p>
        </ErrorFallback>
      )}
    >
      <StyledContainer ref={ref}>
        <Header>Thank You!</Header>
        <ThankYouMessage>
          We're finding the best insurance offers for you...
        </ThankYouMessage>

        <ClickWall
          leadId={formData.leadId}
          vertical={formData.vertical}
          leadScore={formData.leadScore}
          userData={userData}
          onBidClick={handleAdClick}
          refreshInterval={30000}
          className={inView ? 'in-viewport' : ''}
        />
      </StyledContainer>
    </ErrorBoundary>
  );
};

// Export enhanced component with performance tracking
export default withPerformanceTracking(ClickWallRoute);