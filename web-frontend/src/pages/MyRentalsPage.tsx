import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { getBooks } from '../api/books';
import { getMyRentals, returnBook } from '../api/rentals';
import { queryKeys } from '../queryKeys';
import { StatusChip } from '../components/StatusChip';

export function MyRentalsPage() {
  const queryClient = useQueryClient();

  // Rentals carry only bookId; fetch books too and map id -> title for display.
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

  if (rentalsQ.isLoading || booksQ.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (rentalsQ.isError) return <Alert severity="error">Failed to load your rentals.</Alert>;

  const titleById = new Map((booksQ.data ?? []).map((b) => [b.id, b.title]));
  const rentals = rentalsQ.data ?? [];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        My Rentals
      </Typography>
      {rentals.length === 0 ? (
        <Alert severity="info">You haven't rented anything yet.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Book</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Due</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rentals.map((r) => {
                const outstanding = r.status === 'ACTIVE' || r.status === 'OVERDUE';
                return (
                  <TableRow key={r.id}>
                    <TableCell>{titleById.get(r.bookId) ?? r.bookId}</TableCell>
                    <TableCell>
                      <StatusChip status={r.status} />
                    </TableCell>
                    <TableCell>{new Date(r.dueAt).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      {outstanding && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={ret.isPending && ret.variables === r.id}
                          onClick={() => ret.mutate(r.id)}
                        >
                          {ret.isPending && ret.variables === r.id ? 'Returning…' : 'Return'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
