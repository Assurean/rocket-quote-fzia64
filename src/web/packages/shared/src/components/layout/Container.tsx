/**
 * @fileoverview A responsive container component that provides consistent max-width and padding
 * constraints for content layout across different screen sizes. Implements mobile-first design
 * principles and supports both fluid and fixed-width layouts.
 * @version 1.0.0
 */

import React from 'react';
import styled from 'styled-components'; // v5.3.0
import { spacing } from '../theme/spacing';
import { mediaQueries } from '../theme/breakpoints';

/**
 * Default maximum width for container on desktop screens.
 * Chosen to ensure optimal readability and content layout.
 */
const DEFAULT_MAX_WIDTH = '1200px';

/**
 * Props interface for the Container component defining its configuration options
 */
interface ContainerProps {
  /** Content to be rendered inside the container */
  children: React.ReactNode;
  /** Optional maximum width override for the container */
  maxWidth?: string;
  /** Whether container should be full-width without max-width constraints */
  fluid?: boolean;
  /** Whether to remove default padding */
  noPadding?: boolean;
  /** Optional ARIA role for the container element */
  role?: string;
}

/**
 * Styled container component with responsive padding and width constraints
 */
const StyledContainer = styled.div<ContainerProps>`
  box-sizing: border-box;
  position: relative;
  width: 100%;
  min-width: 320px; /* Minimum supported mobile width */
  margin: 0 auto;
  overflow: hidden;
  
  /* Base mobile padding */
  padding: ${props => props.noPadding ? 0 : spacing.padding.md};
  
  /* Max width handling */
  max-width: ${props => props.fluid ? '100%' : (props.maxWidth || DEFAULT_MAX_WIDTH)};
  
  /* Tablet styles */
  ${mediaQueries.tablet} {
    padding: ${props => props.noPadding ? 0 : spacing.padding.lg};
  }
  
  /* Desktop styles */
  ${mediaQueries.desktop} {
    padding: ${props => props.noPadding ? 0 : spacing.padding.lg};
  }
  
  /* Large desktop styles */
  ${mediaQueries.largeDesktop} {
    padding: ${props => props.noPadding ? 0 : spacing.padding.xl};
  }
`;

/**
 * A responsive container component that provides consistent max-width and padding
 * constraints with support for fluid layouts and padding customization.
 * 
 * @param props - Container configuration props
 * @returns Rendered container component with applied styles and constraints
 */
const Container: React.FC<ContainerProps> = React.memo(({
  children,
  maxWidth,
  fluid = false,
  noPadding = false,
  role,
}) => {
  return (
    <StyledContainer
      maxWidth={maxWidth}
      fluid={fluid}
      noPadding={noPadding}
      role={role}
    >
      {children}
    </StyledContainer>
  );
});

// Display name for debugging purposes
Container.displayName = 'Container';

export default Container;