import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { getBooks } from '../api/books';
import { queryKeys } from '../queryKeys';
import { BookCover } from '../components/BookCover';

export function CatalogPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  // Defer the query term so typing feels instant; actual fetch triggers after a paint.
  const deferredQ = useDeferredValue(q);

  const { data: books, isLoading, isError } = useQuery({
    queryKey: [...queryKeys.books, deferredQ],
    queryFn: () => getBooks(),
    staleTime: 30_000,
  });

  // Client-side filter: inventory-service books are the source of truth for
  // availability counts. Server-side FTS (catalog-service) will replace this
  // once catalog and inventory are fully merged in a later slice.
  const filtered = (() => {
    const term = deferredQ.trim().toLowerCase();
    if (!term) return books ?? [];
    return (books ?? []).filter(
      (b) => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term),
    );
  })();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Browse the library
        </Typography>
        <Typography color="text.secondary">Find a book and rent it in one click.</Typography>
      </Box>

      <TextField
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by title or author…"
        fullWidth
        sx={{ mb: 3, maxWidth: 480, bgcolor: 'background.paper' }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        }}
      />

      {isError && <Alert severity="error">Failed to load the catalog.</Alert>}

      {isLoading ? (
        <Grid container spacing={2.5}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card>
                <Skeleton variant="rectangular" height={180} />
                <CardContent>
                  <Skeleton width="80%" />
                  <Skeleton width="50%" />
                  <Skeleton width="35%" height={28} sx={{ mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <EmptyState searching={!!deferredQ.trim()} />
      ) : (
        <Grid container spacing={2.5}>
          {filtered.map((book) => {
            const out = book.availableCopies <= 0;
            return (
              <Grid item xs={12} sm={6} md={4} key={book.id}>
                <Card sx={{ height: '100%', transition: 'box-shadow .2s, transform .2s', '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' } }}>
                  <CardActionArea onClick={() => navigate(`/books/${book.id}`)} sx={{ height: '100%' }}>
                    <Box sx={{ p: 1.5, pb: 0 }}>
                      <BookCover title={book.title} />
                    </Box>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>
                        {book.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom noWrap>
                        {book.author}
                      </Typography>
                      <Chip
                        size="small"
                        label={out ? 'All copies out' : `${book.availableCopies} of ${book.totalCopies} available`}
                        color={out ? 'default' : 'success'}
                        variant={out ? 'outlined' : 'filled'}
                        sx={out ? undefined : { color: '#fff' }}
                      />
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
      <MenuBookIcon sx={{ fontSize: 56, opacity: 0.3 }} />
      <Typography sx={{ mt: 1 }}>
        {searching ? 'No books match your search.' : 'The catalog is empty.'}
      </Typography>
    </Box>
  );
}
