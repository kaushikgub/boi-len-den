import { useQueries } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { getBooks } from '../api/books';
import { getMyPayments } from '../api/payments';
import { queryKeys } from '../queryKeys';
import { PaymentStatus } from '../api/types';

const STATUS_COLOR: Record<PaymentStatus, 'success' | 'default'> = {
  CHARGED: 'success',
  REFUNDED: 'default',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PaymentsPage() {
  const [paymentsQ, booksQ] = useQueries({
    queries: [
      { queryKey: queryKeys.myPayments, queryFn: getMyPayments },
      { queryKey: queryKeys.books, queryFn: getBooks },
    ],
  });

  const loading = paymentsQ.isLoading || booksQ.isLoading;
  const titleById = new Map((booksQ.data ?? []).map((b) => [b.id, b.title]));
  const payments = paymentsQ.data ?? [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Payment History
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Charges and refunds for your rentals. Each rental costs {formatCents(500)}.
      </Typography>

      {paymentsQ.isError && <Alert severity="error">Failed to load payment history.</Alert>}

      {loading ? (
        <Stack spacing={1.5}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Stack>
      ) : payments.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <ReceiptLongIcon sx={{ fontSize: 56, opacity: 0.3 }} />
          <Typography sx={{ mt: 1 }}>No payments yet.</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {payments.map((p) => {
            const title = titleById.get(p.bookId) ?? p.bookId;
            return (
              <Card key={p.id} sx={{ display: 'flex', alignItems: 'center', p: 2, gap: 2 }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Charged {new Date(p.chargedAt).toLocaleDateString()}
                    {p.refundedAt && ` · Refunded ${new Date(p.refundedAt).toLocaleDateString()}`}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', minWidth: 56, textAlign: 'right' }}>
                  {formatCents(p.amountCents)}
                </Typography>
                <Chip
                  label={p.status}
                  color={STATUS_COLOR[p.status]}
                  size="small"
                  sx={{ minWidth: 80, justifyContent: 'center' }}
                />
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
