// External imports with versions
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react'; // ^18.2.0
import { Box, Container, Typography, Skeleton, Paper, IconButton, Tooltip, Alert } from '@mui/material'; // ^5.0.0
import { useTheme } from '@mui/material/styles'; // ^5.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^2.10.4
import { DataGrid, GridColDef, GridFilterModel, GridSortModel } from '@mui/x-data-grid'; // ^5.0.0
import { format } from 'date-fns'; // ^2.29.3

// Internal imports
import { useLeadQueue } from '../hooks/useLeadQueue';

// Constants
const ROWS_PER_PAGE = 25;
const DEBOUNCE_DELAY = 300;
const VIRTUAL_ROW_HEIGHT = 48;
const ERROR_MESSAGES = {
  FETCH_ERROR: 'Unable to load leads. Please try again.',
  UPDATE_ERROR: 'Failed to update lead status. Please retry.',
  FILTER_ERROR: 'Invalid filter selection.'
};

// Types
interface LeadQueueProps {}

const LeadQueue: React.FC<LeadQueueProps> = memo(() => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Lead queue state management
  const {
    leads,
    updateStatus,
    isLoading,
    error,
    metrics,
    refresh,
    startPolling,
    stopPolling
  } = useLeadQueue();

  // Virtual scroll configuration
  const rowVirtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => VIRTUAL_ROW_HEIGHT,
    overscan: 5
  });

  // Column definitions with accessibility support
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'id',
      headerName: 'Lead ID',
      width: 130,
      renderCell: (params) => (
        <Tooltip title={`Lead ID: ${params.value}`}>
          <span>{params.value}</span>
        </Tooltip>
      )
    },
    {
      field: 'vertical',
      headerName: 'Insurance Type',
      width: 150,
      renderCell: (params) => (
        <Box sx={{ 
          color: theme.palette[params.value.toLowerCase()]?.main 
        }}>
          {params.value}
        </Box>
      )
    },
    {
      field: 'contactInfo',
      headerName: 'Contact Info',
      width: 250,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2">{params.value.name}</Typography>
          <Typography variant="caption" color="textSecondary">
            {params.value.email}
          </Typography>
        </Box>
      )
    },
    {
      field: 'mlScore',
      headerName: 'Quality Score',
      width: 130,
      renderCell: (params) => (
        <Box sx={{
          backgroundColor: params.value >= 0.7 ? 'success.light' :
                          params.value >= 0.4 ? 'warning.light' : 'error.light',
          padding: '4px 8px',
          borderRadius: '4px'
        }}>
          {(params.value * 100).toFixed(0)}%
        </Box>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      renderCell: (params) => (
        <Box sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center'
        }}>
          <Typography>{params.value}</Typography>
          <IconButton
            aria-label={`Update ${params.row.id} status`}
            onClick={() => handleStatusUpdate(params.row.id, 'accepted')}
            disabled={params.value === 'accepted'}
          >
            ✓
          </IconButton>
          <IconButton
            aria-label={`Reject ${params.row.id}`}
            onClick={() => handleStatusUpdate(params.row.id, 'rejected')}
            disabled={params.value === 'rejected'}
          >
            ✕
          </IconButton>
        </Box>
      )
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 180,
      valueFormatter: (params) => format(new Date(params.value), 'PPp')
    }
  ], [theme]);

  // Handlers
  const handleStatusUpdate = useCallback(async (leadId: string, newStatus: string) => {
    try {
      await updateStatus(leadId, newStatus);
    } catch (err) {
      console.error('Status update failed:', err);
      // Show error notification
    }
  }, [updateStatus]);

  const handleFilterChange = useCallback((model: GridFilterModel) => {
    // Implementation handled by DataGrid
  }, []);

  const handleSortChange = useCallback((model: GridSortModel) => {
    // Implementation handled by DataGrid
  }, []);

  // Effects
  useEffect(() => {
    // Set up keyboard navigation
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'r') refresh();
    };
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [refresh]);

  // Performance monitoring
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 200) {
          console.warn('Lead queue render performance issue:', entry);
        }
      });
    });
    observer.observe({ entryTypes: ['measure'] });
    return () => observer.disconnect();
  }, []);

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        {/* Header */}
        <Typography variant="h4" component="h1" gutterBottom>
          Lead Queue
        </Typography>

        {/* Metrics */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <Box>
              <Typography variant="subtitle2">Acceptance Rate</Typography>
              <Typography variant="h6">
                {(metrics.acceptanceRate * 100).toFixed(1)}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Response Time</Typography>
              <Typography variant="h6">
                {metrics.averageResponseTime.toFixed(0)}ms
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Error handling */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {ERROR_MESSAGES.FETCH_ERROR}
          </Alert>
        )}

        {/* Lead queue table */}
        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={leads}
            columns={columns}
            loading={isLoading}
            disableRowSelectionOnClick
            filterMode="server"
            sortingMode="server"
            onFilterModelChange={handleFilterChange}
            onSortModelChange={handleSortChange}
            initialState={{
              pagination: { paginationModel: { pageSize: ROWS_PER_PAGE } }
            }}
            slots={{
              loadingOverlay: () => (
                <Box sx={{ p: 2 }}>
                  <Skeleton variant="rectangular" height={400} />
                </Box>
              )
            }}
            aria-label="Lead queue table"
            getRowId={(row) => row.id}
          />
        </Paper>
      </Box>
    </Container>
  );
});

LeadQueue.displayName = 'LeadQueue';

export default LeadQueue;