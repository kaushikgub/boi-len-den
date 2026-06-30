import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  Pagination,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import { getMyRentals, returnBook } from '../api/rentals';
import { queryKeys } from '../queryKeys';
import { StatusChip } from '../components/StatusChip';
import { BookCover } from '../components/BookCover';

const PAGE_SIZE = 5;
const TABS = ['active', 'returned'] as const;

export function MyRentalsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<0 | 1>(0);
  const [page, setPage] = useState(1);

  const tabKey = TABS[tab];

  const rentalsQ = useQuery({
    queryKey: queryKeys.myRentals(tabKey, page),
    queryFn: () => getMyRentals(tabKey, page, PAGE_SIZE),
  });

  const ret = useMutation({
    mutationFn: (rentalId: string) => returnBook(rentalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myRentalsRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.books });
    },
  });

  const loading = rentalsQ.isLoading;

  const rentals = rentalsQ.data?.data ?? [];
  const total = rentalsQ.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function handleTabChange(_: React.SyntheticEvent, newTab: number) {
    setTab(newTab as 0 | 1);
    setPage(1);
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Rentals
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Books you've borrowed. Return them when you're done.
      </Typography>

      {rentalsQ.isError && <Alert severity="error">Failed to load your rentals.</Alert>}

      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Active" />
        <Tab label="Returned" />
      </Tabs>

      {loading ? (
        <Stack spacing={1.5}>
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={88} />
          ))}
        </Stack>
      ) : rentals.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <LibraryBooksIcon sx={{ fontSize: 56, opacity: 0.3 }} />
          <Typography sx={{ mt: 1 }}>
            {tab === 0 ? 'You have no active rentals.' : 'No returned books yet.'}
          </Typography>
        </Box>
      ) : (
        <>
          <Stack spacing={1.5}>
            {rentals.map((r) => {
              const title = r.bookTitle ?? r.bookId;
              const coverUrl = r.bookCoverUrl;
              const outstanding = r.status === 'ACTIVE' || r.status === 'OVERDUE';
              const returning = ret.isPending && ret.variables === r.id;
              return (
                <Card key={r.id} sx={{ display: 'flex', alignItems: 'center', p: 1.5, gap: 2 }}>
                  <Box sx={{ width: 52, flexShrink: 0 }}>
                    <BookCover title={title} coverUrl={coverUrl} height={68} showTitle={false} />
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }} noWrap>
                      {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Due {new Date(r.dueAt).toLocaleDateString()}
                    </Typography>
                    {r.returnedAt && (
                      <Typography variant="body2" color="text.secondary">
                        Returned {new Date(r.returnedAt).toLocaleDateString()}
                      </Typography>
                    )}
                  </Box>
                  <StatusChip status={r.status} />
                  <Box sx={{ width: 96, textAlign: 'right' }}>
                    {outstanding && (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={returning}
                        onClick={() => ret.mutate(r.id)}
                      >
                        {returning ? 'Returning…' : 'Return'}
                      </Button>
                    )}
                  </Box>
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
