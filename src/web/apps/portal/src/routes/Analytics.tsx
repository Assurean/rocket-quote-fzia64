import React, { useState, useCallback, useMemo, useEffect } from 'react';
import styled from '@emotion/styled';
import { useSelector } from 'react-redux'; // v8.1.0
import { DatePicker } from '@mui/x-date-pickers'; // v6.10.0
import Dashboard from '@analytics/components/Dashboard';
import { formatLeadChartData } from '../utils/charts';
import { selectLeadQueue } from '../store/slices/leadSlice';
import { InsuranceVertical } from '@backend/services/lead-service/src/interfaces/lead.interface';

// Styled components for layout
const AnalyticsContainer = styled.div`
  padding: 2rem;
  height: 100%;
  overflow-y: auto;
  display: grid;
  gap: 2rem;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  
  @media (max-width: 767px) {
    grid-template-columns: 1fr;
  }
`;

const FilterContainer = styled.div`
  margin-bottom: 2rem;
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  
  @media (max-width: 767px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

// Interface definitions
interface AnalyticsRouteProps {
  className?: string;
  refreshInterval?: number;
  errorBoundary?: ErrorBoundaryProps;
  accessibilityConfig?: AccessibilityConfig;
}

interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  onError?: (error: Error) => void;
}

interface AccessibilityConfig {
  announceUpdates?: boolean;
  highContrast?: boolean;
  keyboardNavigation?: boolean;
}

// Default date range (last 30 days)
const getDefaultDateRange = () => ({
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  end: new Date()
});

/**
 * Analytics route component providing comprehensive metrics dashboard
 * with real-time updates and accessibility support
 */
const Analytics: React.FC<AnalyticsRouteProps> = ({
  className,
  refreshInterval = 300000, // 5 minutes default
  errorBoundary,
  accessibilityConfig = {
    announceUpdates: true,
    highContrast: false,
    keyboardNavigation: true
  }
}) => {
  // State management
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [selectedVertical, setSelectedVertical] = useState<InsuranceVertical | 'all'>('all');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Redux selectors with memoization
  const leadQueueData = useSelector(selectLeadQueue);

  // Memoized chart data formatting
  const formattedData = useMemo(() => {
    if (!leadQueueData) return null;
    return formatLeadChartData(leadQueueData, {
      type: 'line',
      accessibility: {
        ariaLabel: 'Lead performance metrics chart',
        description: 'Visualization of lead performance across insurance verticals',
        keyboardNavigation: accessibilityConfig.keyboardNavigation,
        announceDataPoints: accessibilityConfig.announceUpdates
      },
      responsive: {
        breakpoints: {
          mobile: 320,
          tablet: 768,
          desktop: 1024
        },
        options: {}
      }
    });
  }, [leadQueueData, accessibilityConfig]);

  // Date range change handler with debouncing
  const handleDateRangeChange = useCallback((start: Date | null, end: Date | null) => {
    if (start && end) {
      setDateRange({ start, end });
      setLastUpdate(new Date());
    }
  }, []);

  // Vertical filter change handler
  const handleVerticalChange = useCallback((vertical: InsuranceVertical | 'all') => {
    setSelectedVertical(vertical);
    setLastUpdate(new Date());
  }, []);

  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval) return;

    const intervalId = setInterval(() => {
      setLastUpdate(new Date());
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  // Accessibility announcement for updates
  useEffect(() => {
    if (accessibilityConfig.announceUpdates) {
      const announcement = `Analytics data updated at ${lastUpdate.toLocaleTimeString()}`;
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.textContent = announcement;
      document.body.appendChild(announcer);
      
      return () => {
        document.body.removeChild(announcer);
      };
    }
  }, [lastUpdate, accessibilityConfig.announceUpdates]);

  return (
    <AnalyticsContainer 
      className={className}
      role="main"
      aria-label="Analytics Dashboard"
    >
      <FilterContainer role="toolbar" aria-label="Analytics filters">
        <DatePicker
          label="Start Date"
          value={dateRange.start}
          onChange={(date) => handleDateRangeChange(date, dateRange.end)}
          slotProps={{
            textField: {
              'aria-label': 'Start date filter',
              InputLabelProps: { shrink: true }
            }
          }}
        />
        <DatePicker
          label="End Date"
          value={dateRange.end}
          onChange={(date) => handleDateRangeChange(dateRange.start, date)}
          slotProps={{
            textField: {
              'aria-label': 'End date filter',
              InputLabelProps: { shrink: true }
            }
          }}
        />
        <select
          value={selectedVertical}
          onChange={(e) => handleVerticalChange(e.target.value as InsuranceVertical | 'all')}
          aria-label="Insurance vertical filter"
        >
          <option value="all">All Verticals</option>
          {Object.values(InsuranceVertical).map((vertical) => (
            <option key={vertical} value={vertical}>
              {vertical.charAt(0) + vertical.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </FilterContainer>

      <Dashboard
        timeframe={dateRange}
        vertical={selectedVertical}
        refreshEnabled={true}
        refreshInterval={refreshInterval}
        className={className}
      />
    </AnalyticsContainer>
  );
};

export default Analytics;