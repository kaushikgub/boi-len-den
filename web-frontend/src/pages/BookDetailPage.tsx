import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { getBook, getCatalogBook } from '../api/books';
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

  const { data: catalogBook } = useQuery({
    queryKey: queryKeys.catalogBook(id),
    queryFn: () => getCatalogBook(id),
    enabled: !!id,
    retry: false,
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

  const coverUrl = catalogBook?.coverUrl ?? book?.coverUrl ?? null;
  const genre = catalogBook?.genre ?? null;
  const publishedYear = catalogBook?.publishedYear ?? null;
  const isbn = catalogBook?.isbn ?? null;
  const description = catalogBook?.description ?? null;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mb: 2 }}>
        Back to catalog
      </Button>

      {isLoading ? (
        <Paper sx={{ p: { xs: 2, md: 4 } }}>
          <Grid container spacing={4}>
            <Grid item xs={12} sm={4} md={3}>
              <Skeleton variant="rectangular" height={340} sx={{ borderRadius: 2 }} />
            </Grid>
            <Grid item xs={12} sm={8} md={9}>
              <Skeleton width="30%" height={24} sx={{ mb: 1 }} />
              <Skeleton width="72%" height={52} />
              <Skeleton width="44%" height={34} sx={{ mb: 2 }} />
              <Skeleton width="26%" height={32} sx={{ mb: 3 }} />
              <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1.5, maxWidth: 220 }} />
              <Divider sx={{ my: 3 }} />
              <Skeleton width="18%" height={18} sx={{ mb: 1 }} />
              <Skeleton width="100%" />
              <Skeleton width="94%" />
              <Skeleton width="88%" />
            </Grid>
          </Grid>
        </Paper>
      ) : isError || !book ? (
        <Alert severity="error">Book not found.</Alert>
      ) : (
        <Paper sx={{ p: { xs: 2, md: 4 }, overflow: 'hidden' }}>
          <Grid container spacing={4}>
            {/* Cover */}
            <Grid item xs={12} sm={4} md={3}>
              <BookCover title={book.title} coverUrl={coverUrl} height={340} showTitle={false} />
            </Grid>

            {/* Info */}
            <Grid item xs={12} sm={8} md={9}>
              {/* Genre / year / ISBN chips */}
              {(genre || publishedYear || isbn) && (
                <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 0.75 }}>
                  {genre && (
                    <Chip
                      icon={<LocalOfferIcon sx={{ fontSize: '13px !important' }} />}
                      label={genre}
                      size="small"
                      sx={{ bgcolor: 'rgba(79,70,229,0.1)', color: '#4f46e5', fontWeight: 700 }}
                    />
                  )}
                  {publishedYear && (
                    <Chip
                      icon={<CalendarTodayIcon sx={{ fontSize: '13px !important' }} />}
                      label={String(publishedYear)}
                      size="small"
                      variant="outlined"
                      sx={{ color: 'text.secondary' }}
                    />
                  )}
                  {isbn && (
                    <Chip
                      icon={<FingerprintIcon sx={{ fontSize: '13px !important' }} />}
                      label={`ISBN ${isbn}`}
                      size="small"
                      variant="outlined"
                      sx={{ color: 'text.secondary' }}
                    />
                  )}
                </Stack>
              )}

              <Typography variant="h4" gutterBottom sx={{ lineHeight: 1.15, mt: 0.5 }}>
                {book.title}
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, mb: 2.5 }}>
                {book.author}
              </Typography>

              <Chip
                sx={book.availableCopies > 0 ? { color: '#fff', mb: 3 } : { mb: 3 }}
                label={
                  book.availableCopies > 0
                    ? `${book.availableCopies} of ${book.totalCopies} copies available`
                    : 'All copies out'
                }
                color={book.availableCopies > 0 ? 'success' : 'default'}
                variant={book.availableCopies > 0 ? 'filled' : 'outlined'}
              />

              <Stack spacing={1.5} sx={{ maxWidth: 300 }}>
                {rentError && (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    {rentError.response?.data?.message ?? 'Could not rent this book.'}
                  </Alert>
                )}
                <Button
                  variant="contained"
                  size="large"
                  disabled={book.availableCopies <= 0 || rent.isPending}
                  onClick={() => rent.mutate()}
                  sx={{ py: 1.25 }}
                >
                  {rent.isPending
                    ? 'Renting…'
                    : book.availableCopies <= 0
                      ? 'Unavailable'
                      : 'Rent this book'}
                </Button>
              </Stack>

              {description && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Typography
                    variant="overline"
                    sx={{ color: 'text.secondary', letterSpacing: '0.1em', fontSize: 11, fontWeight: 700 }}
                  >
                    About this book
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.primary"
                    sx={{ mt: 1, lineHeight: 1.8, maxWidth: 680, color: 'text.secondary' }}
                  >
                    {description}
                  </Typography>
                </>
              )}
            </Grid>
          </Grid>
        </Paper>
      )}

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
