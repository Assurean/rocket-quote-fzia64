import React from 'react'; // v18.2+
import { Breadcrumbs, Link, Typography } from '@mui/material'; // v5.0+
import { styled, useTheme } from '@mui/material/styles'; // v5.0+
import { ui, verticalColors } from '../theme/colors';
import { fontSize, fontWeight, lineHeight } from '../theme/typography';
import { padding, margin } from '../theme/spacing';

/**
 * Type definition for supported insurance verticals
 */
type InsuranceVertical = 'auto' | 'home' | 'health' | 'life' | 'renters' | 'commercial';

/**
 * Interface for individual breadcrumb items
 */
interface BreadcrumbItem {
  label: string;
  path: string;
  active: boolean;
  vertical?: InsuranceVertical;
  icon?: React.ReactNode;
}

/**
 * Props interface for the Breadcrumb component
 */
interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: string;
  maxItems?: number;
  itemsBeforeCollapse?: number;
  itemsAfterCollapse?: number;
  onItemClick?: (item: BreadcrumbItem) => void;
}

/**
 * Styled wrapper for MUI Breadcrumbs with responsive design
 */
const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
  padding: padding.xs,
  marginBottom: margin.sm,
  whiteSpace: 'nowrap',
  [theme.breakpoints.down('sm')]: {
    padding: padding.xs,
    fontSize: fontSize.sm,
  },
  '& .MuiBreadcrumbs-separator': {
    marginLeft: margin.xs,
    marginRight: margin.xs,
    color: ui.text.secondary,
  },
  '& .MuiBreadcrumbs-li': {
    display: 'flex',
    alignItems: 'center',
  }
}));

/**
 * Styled link component with vertical-specific theming
 */
const StyledLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== 'vertical'
})<{ vertical?: InsuranceVertical }>(({ theme, vertical }) => ({
  color: vertical ? verticalColors[vertical].primary : ui.text.primary,
  textDecoration: 'none',
  fontSize: fontSize.base,
  fontWeight: fontWeight.medium,
  lineHeight: lineHeight.normal,
  display: 'flex',
  alignItems: 'center',
  gap: padding.xs,
  
  '&:hover': {
    color: vertical ? verticalColors[vertical].dark : ui.text.secondary,
    textDecoration: 'underline',
  },
  
  '&:focus': {
    outline: `2px solid ${ui.primary}`,
    outlineOffset: '2px',
  },
  
  [theme.breakpoints.down('sm')]: {
    fontSize: fontSize.sm,
  }
}));

/**
 * Breadcrumb component providing hierarchical navigation with accessibility support
 */
const Breadcrumb: React.FC<BreadcrumbProps> = React.memo(({
  items,
  className,
  separator = '/',
  maxItems = 8,
  itemsBeforeCollapse = 1,
  itemsAfterCollapse = 1,
  onItemClick
}) => {
  const theme = useTheme();

  // Handle item click with keyboard support
  const handleItemClick = (item: BreadcrumbItem) => (event: React.MouseEvent | React.KeyboardEvent) => {
    if (
      event.type === 'click' ||
      (event.type === 'keydown' && ((event as React.KeyboardEvent).key === 'Enter' || (event as React.KeyboardEvent).key === ' '))
    ) {
      event.preventDefault();
      onItemClick?.(item);
    }
  };

  return (
    <nav aria-label="Breadcrumb navigation">
      <StyledBreadcrumbs
        className={className}
        separator={separator}
        maxItems={maxItems}
        itemsBeforeCollapse={itemsBeforeCollapse}
        itemsAfterCollapse={itemsAfterCollapse}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return isLast ? (
            <Typography
              key={item.path}
              color="textPrimary"
              aria-current="page"
              sx={{
                color: item.vertical ? verticalColors[item.vertical].primary : ui.text.primary,
                fontWeight: fontWeight.medium,
                display: 'flex',
                alignItems: 'center',
                gap: padding.xs,
              }}
            >
              {item.icon}
              {item.label}
            </Typography>
          ) : (
            <StyledLink
              key={item.path}
              href={item.path}
              vertical={item.vertical}
              onClick={handleItemClick(item)}
              onKeyDown={handleItemClick(item)}
              tabIndex={0}
              role="link"
            >
              {item.icon}
              {item.label}
            </StyledLink>
          );
        })}
      </StyledBreadcrumbs>
    </nav>
  );
});

Breadcrumb.displayName = 'Breadcrumb';

export default Breadcrumb;