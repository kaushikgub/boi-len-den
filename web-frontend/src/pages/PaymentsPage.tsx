import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  Chip,
  Pagination,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { getBooks } from '../api/books';
import { getMyPayments } from '../api/payments';
import { queryKeys } from '../queryKeys';
import { PaymentStatus } from '../api/types';

const PAGE_SIZE = 5;
const TABS: Array<PaymentStatus | undefined> = [undefined, 'CHARGED', 'REFUNDED'];
const TAB_LABELS = ['All', 'Charged', 'Refunded'];

const STATUS_COLOR: Record<PaymentStatus, 'success' | 'default'> = {
  CHARGED: 'success',
  REFUNDED: 'default',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PaymentsPage() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);

  const status = TABS[tab];

  const paymentsQ = useQuery({
    queryKey: queryKeys.myPayments(status ?? 'all', page),
    queryFn: () => getMyPayments(status, page, PAGE_SIZE),
  });

  const booksQ = useQuery({
    queryKey: queryKeys.books,
    queryFn: getBooks,
  });

  const loading = paymentsQ.isLoading || booksQ.isLoading;
  const bookById = new Map((booksQ.data ?? []).map((b) => [b.id, b]));
  const payments = paymentsQ.data?.data ?? [];
  const total = paymentsQ.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function handleTabChange(_: React.SyntheticEvent, newTab: number) {
    setTab(newTab);
    setPage(1);
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Payment History
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Charges and refunds for your rentals. Each rental costs {formatCents(500)}.
      </Typography>

      {paymentsQ.isError && <Alert severity="error">Failed to load payment history.</Alert>}

      <Tabs
        value={tab}
        onChange={handleTabChange}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {TAB_LABELS.map((label) => (
          <Tab key={label} label={label} />
        ))}
      </Tabs>

      {loading ? (
        <Stack spacing={1.5}>
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Stack>
      ) : payments.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <ReceiptLongIcon sx={{ fontSize: 56, opacity: 0.3 }} />
          <Typography sx={{ mt: 1 }}>
            {tab === 0 ? 'No payments yet.' : `No ${TAB_LABELS[tab].toLowerCase()} payments.`}
          </Typography>
        </Box>
      ) : (
        <>
          <Stack spacing={1.5}>
            {payments.map((p) => {
              const book = bookById.get(p.bookId);
              const title = book?.title ?? p.bookId;
              return (
                <Card key={p.id} sx={{ display: 'flex', alignItems: 'center', p: 2, gap: 2 }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }} noWrap>
                      {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Charged {new Date(p.chargedAt).toLocaleDateString()}
                      {p.refundedAt &&
                        ` · Refunded ${new Date(p.refundedAt).toLocaleDateString()}`}
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

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
