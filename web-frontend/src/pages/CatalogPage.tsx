import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material';
import { getBooks } from '../api/books';
import { queryKeys } from '../queryKeys';

export function CatalogPage() {
  const navigate = useNavigate();
  const { data: books, isLoading, isError } = useQuery({
    queryKey: queryKeys.books,
    queryFn: getBooks,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError) return <Alert severity="error">Failed to load the catalog.</Alert>;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Catalog
      </Typography>
      <Grid container spacing={2}>
        {books?.map((book) => (
          <Grid item xs={12} sm={6} key={book.id}>
            <Card>
              <CardActionArea onClick={() => navigate(`/books/${book.id}`)}>
                <CardContent>
                  <Typography variant="h6">{book.title}</Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {book.author}
                  </Typography>
                  <Chip
                    size="small"
                    label={
                      book.availableCopies > 0
                        ? `${book.availableCopies} of ${book.totalCopies} available`
                        : 'All copies out'
                    }
                    color={book.availableCopies > 0 ? 'success' : 'default'}
                  />
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
