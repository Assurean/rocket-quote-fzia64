/**
 * @fileoverview Campaign management page component for the buyer portal
 * Provides comprehensive interface for managing insurance lead generation campaigns
 * Implements WCAG 2.1 AA accessibility standards
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { styled } from '@mui/material/styles';
import {
  Box,
  Button,
  Card,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import Table from '@shared/components/data/Table';
import { useCampaign } from '../hooks/useCampaign';
import type { ICampaign, InsuranceVertical } from '../../../backend/services/campaign-service/src/interfaces/campaign.interface';

// Constants
const CAMPAIGN_TABLE_COLUMNS = [
  {
    id: 'name',
    label: 'Campaign Name',
    align: 'left',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    id: 'vertical',
    label: 'Insurance Type',
    align: 'left',
    sortable: true,
    filterable: true,
    filterType: 'select',
  },
  {
    id: 'dailyBudget',
    label: 'Daily Budget',
    align: 'right',
    sortable: true,
    filterable: true,
    filterType: 'number',
    format: (value: number) => `$${value.toLocaleString()}`,
  },
  {
    id: 'status',
    label: 'Status',
    align: 'left',
    sortable: true,
    filterable: true,
    filterType: 'select',
  },
  {
    id: 'actions',
    label: 'Actions',
    align: 'right',
    sortable: false,
    filterable: false,
  },
];

// Styled components
const StyledCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
}));

const HeaderContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
}));

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary,
}) => (
  <StyledCard>
    <Typography variant="h6" color="error" gutterBottom>
      Error Loading Campaigns
    </Typography>
    <Typography variant="body2" paragraph>
      {error.message}
    </Typography>
    <Button variant="contained" onClick={resetErrorBoundary}>
      Retry
    </Button>
  </StyledCard>
);

const Campaigns: React.FC = () => {
  // Campaign management hook
  const {
    campaigns,
    loading,
    error,
    pagination,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    updatePagination,
  } = useCampaign();

  // Local state
  const [selectedCampaign, setSelectedCampaign] = useState<ICampaign | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');

  // Initial data fetch
  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Memoized handlers
  const handlePageChange = useCallback(
    async (page: number) => {
      updatePagination(page);
      await fetchCampaigns();
    },
    [updatePagination, fetchCampaigns]
  );

  const handleCreateClick = useCallback(() => {
    setSelectedCampaign(null);
    setDialogMode('create');
    setIsDialogOpen(true);
  }, []);

  const handleEditClick = useCallback((campaign: ICampaign) => {
    setSelectedCampaign(campaign);
    setDialogMode('edit');
    setIsDialogOpen(true);
  }, []);

  const handleDeleteClick = useCallback(
    async (campaign: ICampaign) => {
      if (window.confirm(`Are you sure you want to delete campaign "${campaign.name}"?`)) {
        await deleteCampaign(campaign.id);
        await fetchCampaigns();
      }
    },
    [deleteCampaign, fetchCampaigns]
  );

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setSelectedCampaign(null);
  }, []);

  const handleDialogSubmit = useCallback(
    async (formData: Partial<ICampaign>) => {
      try {
        if (dialogMode === 'create') {
          await createCampaign(formData as any);
        } else if (selectedCampaign) {
          await updateCampaign(selectedCampaign.id, formData);
        }
        handleDialogClose();
        await fetchCampaigns();
      } catch (error) {
        console.error('Failed to save campaign:', error);
      }
    },
    [dialogMode, selectedCampaign, createCampaign, updateCampaign, handleDialogClose, fetchCampaigns]
  );

  // Memoized table actions renderer
  const renderActions = useCallback(
    (campaign: ICampaign) => (
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Tooltip title="Edit Campaign">
          <IconButton
            onClick={() => handleEditClick(campaign)}
            aria-label={`Edit campaign ${campaign.name}`}
            size="small"
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Campaign">
          <IconButton
            onClick={() => handleDeleteClick(campaign)}
            aria-label={`Delete campaign ${campaign.name}`}
            size="small"
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    ),
    [handleEditClick, handleDeleteClick]
  );

  // Enhanced table data with actions
  const tableData = useMemo(
    () =>
      campaigns.map((campaign) => ({
        ...campaign,
        actions: renderActions(campaign),
      })),
    [campaigns, renderActions]
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={fetchCampaigns}>
      <StyledCard>
        <HeaderContainer>
          <Typography variant="h5" component="h1">
            Campaign Management
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              aria-label="Filter campaigns"
            >
              Filter
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateClick}
              aria-label="Create new campaign"
            >
              Create Campaign
            </Button>
          </Stack>
        </HeaderContainer>

        <Table
          columns={CAMPAIGN_TABLE_COLUMNS}
          data={tableData}
          loading={loading.list}
          pagination
          rowKey="id"
          ariaLabel="Campaign management table"
          onPageChange={handlePageChange}
        />
      </StyledCard>

      <Dialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        aria-labelledby="campaign-dialog-title"
        maxWidth="md"
        fullWidth
      >
        <DialogTitle id="campaign-dialog-title">
          {dialogMode === 'create' ? 'Create Campaign' : 'Edit Campaign'}
        </DialogTitle>
        <DialogContent>
          {/* Campaign form implementation */}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button variant="contained" onClick={() => handleDialogSubmit({})}>
            {dialogMode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </ErrorBoundary>
  );
};

export default Campaigns;