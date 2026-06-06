import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  Alert,
  Box,
  Button,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { createBook } from '../api/books';
import { queryKeys } from '../queryKeys';

/** Librarian/admin-only form to add a book. Route is role-gated; the backend
 *  enforces the role independently on POST /api/books. */
export function AdminBooksPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalCopies, setTotalCopies] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => createBook({ title, author, totalCopies }),
    onSuccess: (book) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.books });
      setToast(`Added "${book.title}" (${book.totalCopies} copies)`);
      setTitle('');
      setAuthor('');
      setTotalCopies(1);
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
      <Paper sx={{ p: 4, maxWidth: 520 }}>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            {error && (
              <Alert severity="error">
                {error.response?.status === 403
                  ? 'Your account is not allowed to add books.'
                  : (error.response?.data?.message ?? 'Could not add the book.')}
              </Alert>
            )}
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth autoFocus />
            <TextField label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} required fullWidth />
            <TextField
              label="Total copies"
              type="number"
              inputProps={{ min: 1 }}
              value={totalCopies}
              onChange={(e) => setTotalCopies(Math.max(1, Number(e.target.value)))}
              required
            />
            <Button type="submit" variant="contained" size="large" disabled={add.isPending}>
              {add.isPending ? 'Adding…' : 'Add book'}
            </Button>
          </Stack>
        </form>
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
