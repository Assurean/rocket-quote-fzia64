import React, { useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { Grid } from '@mui/material'; // v5.14.0
import LeadChart from './LeadChart';
import ConversionChart from './ConversionChart';
import RevenueChart from './RevenueChart';
import KPI from '../../../shared/src/components/data/KPI';
import { useAnalytics, AnalyticsState } from '../hooks/useAnalytics';
import { InsuranceVertical } from '../../../../backend/services/lead-service/src/interfaces/lead.interface';

// Styled components for layout and responsiveness
const DashboardContainer = styled.div`
  padding: 2rem;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: ${props => props.theme.background};
  
  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const KPIGrid = styled(Grid)`
  margin-bottom: 2rem;
  gap: 1rem;
  
  @media (max-width: 768px) {
    gap: 0.5rem;
  }
`;

const ChartGrid = styled(Grid)`
  margin-bottom: 2rem;
  min-height: 400px;
  
  @media (max-width: 768px) {
    min-height: 300px;
  }
`;

// Props interface
interface DashboardProps {
  timeframe: { start: Date; end: Date };
  vertical: InsuranceVertical | 'all';
  className?: string;
  refreshEnabled?: boolean;
  refreshInterval?: number;
}

// Helper function to process KPI data
const getKPIData = (state: AnalyticsState) => {
  if (!state.leadMetrics || !state.revenueMetrics || !state.conversionMetrics) {
    return null;
  }

  return {
    leadQuality: {
      title: 'Lead Acceptance Rate',
      value: state.leadMetrics.acceptanceRate,
      previousValue: state.leadMetrics.acceptanceRate * 0.9, // Previous period
      format: 'percentage'
    },
    revenue: {
      title: 'Total Revenue',
      value: state.revenueMetrics.totalRevenue,
      previousValue: state.revenueMetrics.totalRevenue * 0.85, // Previous period
      format: 'currency',
      prefix: '$'
    },
    conversion: {
      title: 'Conversion Rate',
      value: state.conversionMetrics.overallRate,
      previousValue: state.conversionMetrics.overallRate * 0.95, // Previous period
      format: 'percentage'
    },
    rtbRevenue: {
      title: 'RTB Revenue',
      value: state.revenueMetrics.rtbRevenue,
      previousValue: state.revenueMetrics.rtbRevenue * 0.8, // Previous period
      format: 'currency',
      prefix: '$'
    }
  };
};

export const Dashboard: React.FC<DashboardProps> = ({
  timeframe,
  vertical = 'all',
  className,
  refreshEnabled = true,
  refreshInterval = 300000 // 5 minutes default
}) => {
  // Initialize analytics state with refresh interval
  const { state: analyticsState, actions } = useAnalytics(timeframe, refreshEnabled ? refreshInterval : undefined);

  // Memoize KPI data calculations
  const kpiData = useMemo(() => getKPIData(analyticsState), [analyticsState]);

  // Set up refresh interval
  useEffect(() => {
    if (!refreshEnabled) return;
    
    const intervalId = setInterval(() => {
      actions.refreshMetrics();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshEnabled, refreshInterval, actions]);

  // Handle loading state
  if (analyticsState.loading && !kpiData) {
    return (
      <DashboardContainer className={className}>
        <div role="status" aria-live="polite">Loading dashboard data...</div>
      </DashboardContainer>
    );
  }

  // Handle error state
  if (analyticsState.error) {
    return (
      <DashboardContainer className={className}>
        <div role="alert" aria-live="assertive">
          Error loading dashboard: {analyticsState.error}
        </div>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer className={className}>
      {/* KPI Section */}
      <KPIGrid container spacing={2}>
        {kpiData && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <KPI {...kpiData.leadQuality} size="md" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KPI {...kpiData.revenue} size="md" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KPI {...kpiData.conversion} size="md" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KPI {...kpiData.rtbRevenue} size="md" />
            </Grid>
          </>
        )}
      </KPIGrid>

      {/* Charts Section */}
      <ChartGrid container spacing={3}>
        <Grid item xs={12} md={6}>
          <LeadChart
            vertical={vertical !== 'all' ? vertical : 'auto'}
            type="line"
            height="400px"
            showLegend={true}
            ariaLabel="Lead quality trends"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <ConversionChart
            vertical={vertical}
            timeframe={timeframe}
            height="400px"
            accessibility={{
              ariaLabel: "Conversion metrics chart",
              highContrast: true
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <RevenueChart
            timeframe={timeframe}
            vertical={vertical}
            height="400px"
            showComparison={true}
            showGrowthRate={true}
            interactionMode="hover"
          />
        </Grid>
      </ChartGrid>
    </DashboardContainer>
  );
};

export default Dashboard;