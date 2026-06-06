import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { createBook } from '../api/books';
import { queryKeys } from '../queryKeys';

export function AdminBooksPage() {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalCopies, setTotalCopies] = useState(1);
  const [isbn, setIsbn] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [publishedYear, setPublishedYear] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () =>
      createBook({
        title,
        author,
        totalCopies,
        isbn: isbn || undefined,
        description: description || undefined,
        genre: genre || undefined,
        coverUrl: coverUrl || undefined,
        publishedYear: publishedYear ? parseInt(publishedYear, 10) : undefined,
      }),
    onSuccess: (book) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books });
      setToast(`Added "${book.title}" — inventory updating via event stream`);
      setTitle('');
      setAuthor('');
      setTotalCopies(1);
      setIsbn('');
      setDescription('');
      setGenre('');
      setCoverUrl('');
      setPublishedYear('');
    },
  });

  const error = add.error as AxiosError<{ message?: string }> | null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    add.mutate();
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Add a Book
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Creates the book in the catalog and notifies inventory via event stream.
      </Typography>
      <Paper sx={{ p: 4, maxWidth: 540 }}>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            {error && (
              <Alert severity="error">
                {error.response?.status === 403
                  ? 'Your account is not allowed to add books.'
                  : (error.response?.data?.message ?? 'Could not add the book.')}
              </Alert>
            )}

            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Total copies"
              type="number"
              inputProps={{ min: 1 }}
              value={totalCopies}
              onChange={(e) => setTotalCopies(Math.max(1, Number(e.target.value)))}
              required
            />

            <Divider
              component="button"
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              sx={{
                cursor: 'pointer',
                fontSize: 13,
                color: 'text.secondary',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                '&:hover': { color: 'text.primary' },
              }}
            >
              {showOptional ? '▾ Hide optional fields' : '▸ Add ISBN, description, genre…'}
            </Divider>

            <Collapse in={showOptional}>
              <Stack spacing={2}>
                <TextField
                  label="ISBN"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Published year"
                  type="number"
                  inputProps={{ min: 1000, max: 2099 }}
                  value={publishedYear}
                  onChange={(e) => setPublishedYear(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Cover image URL"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  fullWidth
                  helperText="Leave blank to use a generated gradient cover"
                />
                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                />
              </Stack>
            </Collapse>

            <Button type="submit" variant="contained" size="large" disabled={add.isPending}>
              {add.isPending ? 'Adding…' : 'Add book'}
            </Button>
          </Stack>
        </form>
      </Paper>
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
