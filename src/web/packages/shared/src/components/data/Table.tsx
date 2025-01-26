/**
 * @fileoverview Reusable data table component with sorting, pagination, and selection
 * Implements WCAG 2.1 AA compliance with proper table semantics and accessibility
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Checkbox
} from '@mui/material';
import { ui } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import Spinner from '../feedback/Spinner';

// Interfaces
interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

interface Column {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  format?: (value: any) => string;
  width?: string;
}

interface TableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  pagination?: boolean;
  selection?: boolean;
  defaultSort?: SortState;
  rowKey: string;
  ariaLabel: string;
  onSort?: (sortState: SortState) => void;
  onRowSelect?: (selectedIds: string[]) => void;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
}

// Constants
const DEFAULT_ROWS_PER_PAGE = 10;
const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50];
const SORT_DELAY_MS = 150;

// Styled Components
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
  position: 'relative',
  backgroundColor: ui.background,
  border: `1px solid ${ui.border}`
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  padding: spacing.padding.sm,
  borderBottom: `1px solid ${ui.border}`,
  color: ui.text.primary,
  '&.header': {
    backgroundColor: ui.surface,
    fontWeight: 500
  }
}));

const LoadingOverlay = styled('div')({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: ui.overlay.light,
  zIndex: 1
});

const Table: React.FC<TableProps> = ({
  columns,
  data,
  loading = false,
  pagination = true,
  selection = false,
  defaultSort,
  rowKey,
  ariaLabel,
  onSort,
  onRowSelect,
  onPageChange,
  onRowsPerPageChange
}) => {
  // State
  const [sortState, setSortState] = useState<SortState>(defaultSort || { column: '', direction: 'asc' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Memoized sorted and paginated data
  const sortedData = useMemo(() => {
    if (!sortState.column) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortState.column];
      const bValue = b[sortState.column];
      const modifier = sortState.direction === 'asc' ? 1 : -1;

      if (typeof aValue === 'string') {
        return aValue.localeCompare(bValue) * modifier;
      }
      return (aValue - bValue) * modifier;
    });
  }, [data, sortState]);

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = page * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, page, rowsPerPage, pagination]);

  // Handlers
  const handleSort = useCallback((columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    if (!column?.sortable) return;

    setSortState(prev => ({
      column: columnId,
      direction: prev.column === columnId && prev.direction === 'asc' ? 'desc' : 'asc'
    }));

    if (onSort) {
      const newSort = {
        column: columnId,
        direction: sortState.column === columnId && sortState.direction === 'asc' ? 'desc' : 'asc'
      };
      setTimeout(() => onSort(newSort), SORT_DELAY_MS);
    }

    if (pagination) {
      setPage(0);
    }
  }, [columns, onSort, pagination, sortState]);

  const handleSelectAll = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = new Set(paginatedData.map(row => row[rowKey]));
      setSelected(newSelected);
      onRowSelect?.(Array.from(newSelected));
    } else {
      setSelected(new Set());
      onRowSelect?.([]);
    }
  }, [paginatedData, rowKey, onRowSelect]);

  const handleSelectRow = useCallback((id: string) => {
    setSelected(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      onRowSelect?.(Array.from(newSelected));
      return newSelected;
    });
  }, [onRowSelect]);

  const handlePageChange = useCallback((event: unknown, newPage: number) => {
    setPage(newPage);
    onPageChange?.(newPage);
  }, [onPageChange]);

  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    onRowsPerPageChange?.(newRowsPerPage);
  }, [onRowsPerPageChange]);

  return (
    <StyledTableContainer>
      {loading && (
        <LoadingOverlay>
          <Spinner size="large" color="primary" />
        </LoadingOverlay>
      )}
      
      <MuiTable aria-label={ariaLabel}>
        <TableHead>
          <TableRow>
            {selection && (
              <StyledTableCell padding="checkbox" className="header">
                <Checkbox
                  indeterminate={selected.size > 0 && selected.size < paginatedData.length}
                  checked={paginatedData.length > 0 && selected.size === paginatedData.length}
                  onChange={handleSelectAll}
                  inputProps={{
                    'aria-label': 'select all rows'
                  }}
                />
              </StyledTableCell>
            )}
            {columns.map(column => (
              <StyledTableCell
                key={column.id}
                align={column.align || 'left'}
                className="header"
                style={{ width: column.width }}
              >
                {column.sortable ? (
                  <TableSortLabel
                    active={sortState.column === column.id}
                    direction={sortState.column === column.id ? sortState.direction : 'asc'}
                    onClick={() => handleSort(column.id)}
                  >
                    {column.label}
                  </TableSortLabel>
                ) : column.label}
              </StyledTableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedData.map(row => (
            <TableRow
              hover
              key={row[rowKey]}
              selected={selected.has(row[rowKey])}
              onClick={() => selection && handleSelectRow(row[rowKey])}
              role="checkbox"
              aria-checked={selected.has(row[rowKey])}
              tabIndex={-1}
            >
              {selection && (
                <StyledTableCell padding="checkbox">
                  <Checkbox
                    checked={selected.has(row[rowKey])}
                    inputProps={{
                      'aria-labelledby': row[rowKey]
                    }}
                  />
                </StyledTableCell>
              )}
              {columns.map(column => (
                <StyledTableCell key={column.id} align={column.align || 'left'}>
                  {column.format ? column.format(row[column.id]) : row[column.id]}
                </StyledTableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </MuiTable>

      {pagination && (
        <TablePagination
          rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          component="div"
          count={data.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      )}
    </StyledTableContainer>
  );
};

export default Table;