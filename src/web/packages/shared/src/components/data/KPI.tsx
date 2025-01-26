import React, { useMemo } from 'react'; // ^18.2.0
import styled from '@emotion/styled'; // ^11.11.0
import CountUp from 'react-countup'; // ^6.4.2
import { ui, feedback } from '../../theme/colors';
import { typography } from '../../theme/typography';
import Card from '../layout/Card';

// Props interface for the KPI component
interface KPIProps {
  title: string;
  value: number;
  previousValue: number;
  format: 'number' | 'currency' | 'percentage';
  prefix?: string;
  suffix?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
}

// Styled components
const StyledKPICard = styled(Card)<{ size?: 'sm' | 'md' | 'lg' }>`
  min-width: 200px;
  text-align: center;
  padding: ${props => props.size === 'sm' ? '1rem' : '1.5rem'};
  transition: transform 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
  }
  
  @media (max-width: 767px) {
    min-width: 150px;
    padding: 1rem;
  }
  
  outline: none;
  &:focus-visible {
    box-shadow: 0 0 0 2px ${ui.primary};
  }
`;

const Title = styled.div`
  color: ${ui.text.secondary};
  font-size: ${typography.fontSize.sm};
  margin-bottom: 0.5rem;
  font-weight: ${typography.fontWeight.medium};
  
  @media (max-width: 767px) {
    font-size: ${typography.fontSize.xs};
  }
`;

const Value = styled.div<{ size?: 'sm' | 'md' | 'lg' }>`
  color: ${ui.text.primary};
  font-size: ${props => getFontSize(props.size)};
  font-weight: ${typography.fontWeight.bold};
  line-height: 1.2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const TrendIndicator = styled.span<{ trend: 'up' | 'down' | 'neutral' }>`
  color: ${props => getTrendColor(props.trend)};
  font-size: ${typography.fontSize.sm};
  display: inline-flex;
  align-items: center;
  transition: transform 0.2s ease;
  
  &[data-trend='up'] {
    transform: rotate(-45deg);
  }
  
  &[data-trend='down'] {
    transform: rotate(45deg);
  }
`;

// Helper functions
const getFontSize = (size?: 'sm' | 'md' | 'lg'): string => {
  switch (size) {
    case 'sm':
      return typography.fontSize.xl;
    case 'lg':
      return typography.fontSize['3xl'];
    case 'md':
    default:
      return typography.fontSize['2xl'];
  }
};

const getTrendColor = (trend: 'up' | 'down' | 'neutral'): string => {
  switch (trend) {
    case 'up':
      return feedback.success.main;
    case 'down':
      return feedback.error.main;
    default:
      return ui.text.secondary;
  }
};

const formatValue = (value: number, format: 'number' | 'currency' | 'percentage'): string => {
  const locale = navigator.language || 'en-US';
  
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
      
    case 'percentage':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(value / 100);
      
    default:
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
  }
};

const KPI: React.FC<KPIProps> = ({
  title,
  value,
  previousValue,
  format,
  prefix,
  suffix,
  size = 'md',
  className,
  ariaLabel
}) => {
  const trend = useMemo(() => {
    if (value === previousValue) return 'neutral';
    return value > previousValue ? 'up' : 'down';
  }, [value, previousValue]);

  const formattedValue = useMemo(() => {
    const formatted = formatValue(value, format);
    return `${prefix || ''}${formatted}${suffix || ''}`;
  }, [value, format, prefix, suffix]);

  const trendSymbol = trend === 'neutral' ? '•' : trend === 'up' ? '↗' : '↘';
  
  const percentChange = useMemo(() => {
    if (previousValue === 0) return 0;
    return ((value - previousValue) / previousValue) * 100;
  }, [value, previousValue]);

  return (
    <StyledKPICard
      size={size}
      className={className}
      elevation={1}
      role="status"
      aria-label={ariaLabel || `${title}: ${formattedValue}`}
    >
      <Title>{title}</Title>
      <Value size={size}>
        <CountUp
          end={value}
          formattingFn={(val) => formatValue(val, format)}
          prefix={prefix}
          suffix={suffix}
          duration={1}
          separator=","
        />
        <TrendIndicator
          trend={trend}
          data-trend={trend}
          aria-label={`${Math.abs(percentChange).toFixed(1)}% ${trend === 'up' ? 'increase' : trend === 'down' ? 'decrease' : 'no change'}`}
        >
          {trendSymbol}
        </TrendIndicator>
      </Value>
    </StyledKPICard>
  );
};

export default KPI;