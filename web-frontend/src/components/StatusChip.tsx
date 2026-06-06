import { Chip } from '@mui/material';
import { RentalStatus } from '../api/types';

const COLOR: Record<RentalStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  RESERVED: 'info',
  ACTIVE: 'success',
  OVERDUE: 'error',
  RETURNED: 'default',
  CANCELLED: 'warning',
};

/** Shared status pill for a rental's state. */
export function StatusChip({ status }: { status: RentalStatus }) {
  return <Chip label={status} color={COLOR[status]} size="small" />;
}
