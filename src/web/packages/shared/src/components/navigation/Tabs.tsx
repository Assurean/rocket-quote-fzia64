/**
 * @fileoverview Accessible, responsive navigation tabs component for insurance lead generation platform
 * Supports vertical-specific styling and WCAG 2.1 AA compliance
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { Tabs as MuiTabs, Tab as MuiTab } from '@mui/material'; // v5.0+
import { styled } from '@mui/material/styles'; // v5.0+
import { theme } from '../../theme';

/**
 * Interface defining the structure of individual tab items
 */
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Props interface for the NavigationTabs component
 */
export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  vertical?: 'auto' | 'home' | 'health' | 'life' | 'renters' | 'commercial';
  className?: string;
}

/**
 * Gets the appropriate color based on insurance vertical
 */
const getTabColor = (vertical?: string): string => {
  if (!vertical) return theme.colors.ui.primary;
  return theme.colors.verticals[vertical as keyof typeof theme.colors.verticals]?.primary;
};

/**
 * Styled wrapper for Material-UI Tabs with vertical-specific styling
 */
const StyledTabs = styled(MuiTabs, {
  shouldForwardProp: (prop) => prop !== 'vertical',
})<{ vertical?: string }>(({ vertical, theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  minHeight: '48px', // Ensures minimum touch target size
  
  // Indicator styling
  '& .MuiTabs-indicator': {
    backgroundColor: getTabColor(vertical),
    height: 3,
  },

  // Tab styling
  '& .MuiTab-root': {
    textTransform: 'none',
    minHeight: '48px',
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    fontWeight: theme.typography.fontWeights?.medium || 500,
    color: theme.palette.text.secondary,
    
    '&.Mui-selected': {
      color: getTabColor(vertical),
      fontWeight: theme.typography.fontWeights?.bold || 700,
    },

    '&.Mui-disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },

    // Focus visible styles for keyboard navigation
    '&.Mui-focusVisible': {
      outline: `3px solid ${getTabColor(vertical)}`,
      outlineOffset: '2px',
    },

    // Icon styling
    '& .MuiTab-iconWrapper': {
      marginRight: theme.spacing(1),
    },
  },

  // Responsive styles
  [theme.breakpoints.down('tablet')]: {
    '& .MuiTab-root': {
      minWidth: 'auto',
      padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
      fontSize: theme.typography.body2.fontSize,
      
      '& .MuiTab-iconWrapper': {
        marginRight: theme.spacing(0.5),
      },
    },
  },

  // Touch device optimizations
  '@media (hover: none)': {
    '& .MuiTab-root': {
      '&:hover': {
        backgroundColor: theme.palette.action?.hover,
      },
    },
  },
}));

/**
 * NavigationTabs component providing accessible, responsive tab navigation
 */
export const NavigationTabs: React.FC<TabsProps> = ({
  items,
  value,
  onChange,
  vertical,
  className,
}) => {
  const handleChange = useCallback((_: React.SyntheticEvent, newValue: string) => {
    onChange(newValue);
  }, [onChange]);

  return (
    <StyledTabs
      value={value}
      onChange={handleChange}
      vertical={vertical}
      className={className}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      aria-label="Navigation tabs"
    >
      {items.map((item) => (
        <MuiTab
          key={item.id}
          value={item.id}
          label={item.label}
          icon={item.icon}
          disabled={item.disabled}
          iconPosition="start"
          aria-controls={`tabpanel-${item.id}`}
          id={`tab-${item.id}`}
        />
      ))}
    </StyledTabs>
  );
};

export default NavigationTabs;