import { useDeferredValue, useMemo, useState } from 'react';
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
import { getCatalogBooks } from '../api/books';
import { queryKeys } from '../queryKeys';
import { BookCover } from '../components/BookCover';

export function CatalogPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);

  const { data: catalogBooks, isLoading, isError } = useQuery({
    queryKey: queryKeys.catalogBooks,
    queryFn: () => getCatalogBooks(),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const term = deferredQ.trim().toLowerCase();
    if (!term) return catalogBooks ?? [];
    return (catalogBooks ?? []).filter(
      (b) => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term),
    );
  }, [catalogBooks, deferredQ]);

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
                <Skeleton variant="rectangular" height={220} />
                <CardContent>
                  <Skeleton width="40%" height={22} sx={{ mb: 0.5 }} />
                  <Skeleton width="85%" height={26} />
                  <Skeleton width="55%" />
                  <Skeleton width="95%" sx={{ mt: 1 }} />
                  <Skeleton width="80%" />
                  <Skeleton width="35%" height={28} sx={{ mt: 1.5 }} />
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
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'box-shadow .2s, transform .2s',
                    '&:hover': { boxShadow: 6, transform: 'translateY(-3px)' },
                  }}
                >
                  <CardActionArea
                    onClick={() => navigate(`/books/${book.id}`)}
                    sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                  >
                    <Box sx={{ p: 1.5, pb: 0 }}>
                      <BookCover title={book.title} coverUrl={book.coverUrl} height={210} />
                    </Box>
                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {/* Genre + year row */}
                      {(book.genre || book.publishedYear) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25, flexWrap: 'wrap' }}>
                          {book.genre && (
                            <Chip
                              label={book.genre}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: 11,
                                fontWeight: 700,
                                bgcolor: 'rgba(79,70,229,0.1)',
                                color: '#4f46e5',
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                          )}
                          {book.publishedYear && (
                            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 500 }}>
                              {book.publishedYear}
                            </Typography>
                          )}
                        </Box>
                      )}

                      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.25 }} noWrap>
                        {book.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 0.25 }}>
                        {book.author}
                      </Typography>

                      {book.description && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.55,
                            flexGrow: 1,
                          }}
                        >
                          {book.description}
                        </Typography>
                      )}

                      <Box sx={{ mt: 'auto', pt: 1 }}>
                        <Chip
                          size="small"
                          label={out ? 'All copies out' : `${book.availableCopies} of ${book.totalCopies} available`}
                          color={out ? 'default' : 'success'}
                          variant={out ? 'outlined' : 'filled'}
                          sx={out ? undefined : { color: '#fff' }}
                        />
                      </Box>
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
