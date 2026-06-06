import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getBook } from '../api/books';
import { rentBook } from '../api/rentals';
import { queryKeys } from '../queryKeys';
import { BookCover } from '../components/BookCover';

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
      queryClient.invalidateQueries({ queryKey: queryKeys.book(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.books });
      queryClient.invalidateQueries({ queryKey: queryKeys.myRentals });
      setToast('Rented! Check "My Rentals".');
    },
  });

  const rentError = rent.error as AxiosError<{ message?: string }> | null;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mb: 2 }}>
        Back to catalog
      </Button>
      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        {isLoading ? (
          <Grid container spacing={4}>
            <Grid item xs={12} sm={4}>
              <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 2 }} />
            </Grid>
            <Grid item xs={12} sm={8}>
              <Skeleton width="70%" height={40} />
              <Skeleton width="40%" />
              <Skeleton width="30%" height={32} sx={{ mt: 2 }} />
            </Grid>
          </Grid>
        ) : isError || !book ? (
          <Alert severity="error">Book not found.</Alert>
        ) : (
          <Grid container spacing={4}>
            <Grid item xs={12} sm={4}>
              <BookCover title={book.title} coverUrl={book.coverUrl} height={260} showTitle={false} />
            </Grid>
            <Grid item xs={12} sm={8}>
              <Typography variant="h4" gutterBottom>
                {book.title}
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, mb: 2 }}>
                {book.author}
              </Typography>
              <Chip
                sx={book.availableCopies > 0 ? { color: '#fff', mb: 3 } : { mb: 3 }}
                label={
                  book.availableCopies > 0
                    ? `${book.availableCopies} of ${book.totalCopies} available`
                    : 'All copies out'
                }
                color={book.availableCopies > 0 ? 'success' : 'default'}
                variant={book.availableCopies > 0 ? 'filled' : 'outlined'}
              />
              <Stack spacing={2} sx={{ maxWidth: 320 }}>
                {rentError && (
                  <Alert severity="warning">
                    {rentError.response?.data?.message ?? 'Could not rent this book.'}
                  </Alert>
                )}
                <Button
                  variant="contained"
                  size="large"
                  disabled={book.availableCopies <= 0 || rent.isPending}
                  onClick={() => rent.mutate()}
                >
                  {rent.isPending
                    ? 'Renting…'
                    : book.availableCopies <= 0
                      ? 'Unavailable'
                      : 'Rent this book'}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        )}
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
