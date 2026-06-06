import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { getBook } from '../api/books';
import { rentBook } from '../api/rentals';
import { queryKeys } from '../queryKeys';

export function BookDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);

  const { data: book, isLoading, isError } = useQuery({
    queryKey: queryKeys.book(id),
    queryFn: () => getBook(id),
  });

  const rent = useMutation({
    mutationFn: () => rentBook(id),
    onSuccess: () => {
      // Renting changes availability and "my rentals" — invalidate both.
      queryClient.invalidateQueries({ queryKey: queryKeys.book(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.books });
      queryClient.invalidateQueries({ queryKey: queryKeys.myRentals });
      setToast('Rented! Check "My Rentals".');
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !book) return <Alert severity="error">Book not found.</Alert>;

  const rentError = rent.error as AxiosError<{ message?: string }> | null;
  const soldOut = book.availableCopies <= 0;

  return (
    <Box>
      <Button onClick={() => navigate('/')} sx={{ mb: 2 }}>
        ← Back to catalog
      </Button>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5">{book.title}</Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          {book.author}
        </Typography>
        <Chip
          sx={{ my: 2 }}
          label={soldOut ? 'All copies out' : `${book.availableCopies} of ${book.totalCopies} available`}
          color={soldOut ? 'default' : 'success'}
        />
        <Stack spacing={2} sx={{ mt: 2 }}>
          {rentError && (
            <Alert severity="warning">
              {rentError.response?.data?.message ?? 'Could not rent this book.'}
            </Alert>
          )}
          <Button
            variant="contained"
            size="large"
            disabled={soldOut || rent.isPending}
            onClick={() => rent.mutate()}
          >
            {rent.isPending ? 'Renting…' : soldOut ? 'Unavailable' : 'Rent this book'}
          </Button>
        </Stack>
      </Paper>
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
