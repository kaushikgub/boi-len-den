import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import { getBooks } from '../api/books';
import { getMyRentals, returnBook } from '../api/rentals';
import { queryKeys } from '../queryKeys';
import { StatusChip } from '../components/StatusChip';
import { BookCover } from '../components/BookCover';

export function MyRentalsPage() {
  const queryClient = useQueryClient();

  const [rentalsQ, booksQ] = useQueries({
    queries: [
      { queryKey: queryKeys.myRentals, queryFn: getMyRentals },
      { queryKey: queryKeys.books, queryFn: getBooks },
    ],
  });

  const ret = useMutation({
    mutationFn: (rentalId: string) => returnBook(rentalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myRentals });
      queryClient.invalidateQueries({ queryKey: queryKeys.books });
    },
  });

  const loading = rentalsQ.isLoading || booksQ.isLoading;
  const titleById = new Map((booksQ.data ?? []).map((b) => [b.id, b.title]));
  const rentals = rentalsQ.data ?? [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Rentals
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Books you've borrowed. Return them when you're done.
      </Typography>

      {rentalsQ.isError && <Alert severity="error">Failed to load your rentals.</Alert>}

      {loading ? (
        <Stack spacing={1.5}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={88} />
          ))}
        </Stack>
      ) : rentals.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <LibraryBooksIcon sx={{ fontSize: 56, opacity: 0.3 }} />
          <Typography sx={{ mt: 1 }}>You haven't rented anything yet.</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {rentals.map((r) => {
            const title = titleById.get(r.bookId) ?? r.bookId;
            const outstanding = r.status === 'ACTIVE' || r.status === 'OVERDUE';
            const returning = ret.isPending && ret.variables === r.id;
            return (
              <Card key={r.id} sx={{ display: 'flex', alignItems: 'center', p: 1.5, gap: 2 }}>
                <Box sx={{ width: 52, flexShrink: 0 }}>
                  <BookCover title={title} height={68} showTitle={false} />
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Due {new Date(r.dueAt).toLocaleDateString()}
                  </Typography>
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
      )}
    </Box>
  );
}
