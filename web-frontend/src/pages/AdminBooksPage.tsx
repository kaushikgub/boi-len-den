import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import {
  createBook,
  deleteCatalogBook,
  deleteInventoryBook,
  getCatalogBooksAdmin,
  patchCatalogBook,
} from '../api/books';
import { CatalogBook } from '../api/types';
import { queryKeys } from '../queryKeys';

const ADMIN_BOOKS_KEY = ['catalog-books-admin'];

export function AdminBooksPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Book Management
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Add new books to the catalog or manage existing ones.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Add Book" icon={<AddIcon />} iconPosition="start" />
        <Tab label="Manage Books" icon={<MenuBookIcon />} iconPosition="start" />
      </Tabs>

      {tab === 0 && <AddBookForm />}
      {tab === 1 && <ManageBooks />}
    </Box>
  );
}

/* ─── Add Book Form ────────────────────────────────────────────────────────── */

function AddBookForm() {
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
      queryClient.invalidateQueries({ queryKey: queryKeys.catalogBooks });
      queryClient.invalidateQueries({ queryKey: ADMIN_BOOKS_KEY });
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
    <>
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
    </>
  );
}

/* ─── Manage Books ──────────────────────────────────────────────────────────── */

function ManageBooks() {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmBook, setConfirmBook] = useState<CatalogBook | null>(null);
  const [editBook, setEditBook] = useState<CatalogBook | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data: books, isLoading, isError } = useQuery({
    queryKey: ADMIN_BOOKS_KEY,
    queryFn: () => getCatalogBooksAdmin(),
    staleTime: 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ADMIN_BOOKS_KEY });
    queryClient.invalidateQueries({ queryKey: queryKeys.catalogBooks });
    queryClient.invalidateQueries({ queryKey: queryKeys.books });
  };

  const toggleHide = useMutation({
    mutationFn: ({ id, isHidden }: { id: string; isHidden: boolean }) =>
      patchCatalogBook(id, { isHidden }),
    onMutate: ({ id }) => setPendingId(id),
    onSuccess: (book) => {
      setToast(book.isHidden ? `"${book.title}" hidden from catalog.` : `"${book.title}" visible again.`);
      invalidate();
    },
    onSettled: () => setPendingId(null),
  });

  const deleteBook = useMutation({
    mutationFn: async (id: string) => {
      await deleteCatalogBook(id);
      // Best-effort: also remove from inventory (may 404 if not there)
      await deleteInventoryBook(id).catch(() => undefined);
    },
    onMutate: (id) => setPendingId(id),
    onSuccess: () => {
      setToast('Book deleted.');
      setConfirmBook(null);
      invalidate();
    },
    onSettled: () => setPendingId(null),
  });

  if (isError) return <Alert severity="error">Failed to load books.</Alert>;

  return (
    <>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 56 }} />
              <TableCell>Title / Author</TableCell>
              <TableCell>Genre</TableCell>
              <TableCell align="center">Copies</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton variant="rectangular" width={40} height={56} sx={{ borderRadius: 1 }} /></TableCell>
                    <TableCell><Skeleton width="70%" /><Skeleton width="40%" /></TableCell>
                    <TableCell><Skeleton width="60%" /></TableCell>
                    <TableCell><Skeleton width={32} sx={{ mx: 'auto' }} /></TableCell>
                    <TableCell><Skeleton width={64} sx={{ mx: 'auto' }} /></TableCell>
                    <TableCell><Skeleton width={80} sx={{ ml: 'auto' }} /></TableCell>
                  </TableRow>
                ))
              : (books ?? []).map((book) => {
                  const busy = pendingId === book.id;
                  return (
                    <TableRow
                      key={book.id}
                      sx={{ opacity: book.isHidden ? 0.55 : 1, transition: 'opacity .2s' }}
                    >
                      {/* Cover thumbnail */}
                      <TableCell sx={{ py: 1 }}>
                        <BookThumb book={book} />
                      </TableCell>

                      {/* Title + author */}
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 220 }}>
                          {book.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {book.author}
                        </Typography>
                      </TableCell>

                      {/* Genre */}
                      <TableCell>
                        {book.genre ? (
                          <Chip
                            label={book.genre}
                            size="small"
                            sx={{
                              fontSize: 11,
                              height: 20,
                              bgcolor: 'rgba(79,70,229,0.1)',
                              color: '#4f46e5',
                              fontWeight: 700,
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </TableCell>

                      {/* Copies */}
                      <TableCell align="center">
                        <Typography variant="body2">{book.totalCopies}</Typography>
                      </TableCell>

                      {/* Visibility status */}
                      <TableCell align="center">
                        <Chip
                          label={book.isHidden ? 'Hidden' : 'Visible'}
                          size="small"
                          color={book.isHidden ? 'default' : 'success'}
                          variant={book.isHidden ? 'outlined' : 'filled'}
                          sx={book.isHidden ? undefined : { color: '#fff' }}
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Edit book">
                            <span>
                              <IconButton size="small" disabled={busy} onClick={() => setEditBook(book)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={book.isHidden ? 'Make visible' : 'Hide from catalog'}>
                            <span>
                              <IconButton
                                size="small"
                                disabled={busy}
                                onClick={() => toggleHide.mutate({ id: book.id, isHidden: !book.isHidden })}
                              >
                                {book.isHidden
                                  ? <VisibilityIcon fontSize="small" />
                                  : <VisibilityOffIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Delete permanently">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={busy}
                                onClick={() => setConfirmBook(book)}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit dialog */}
      {editBook && (
        <EditBookDialog
          book={editBook}
          onClose={() => setEditBook(null)}
          onSaved={(title) => {
            setToast(`"${title}" updated.`);
            setEditBook(null);
            invalidate();
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmBook} onClose={() => setConfirmBook(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete book?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>"{confirmBook?.title}"</strong> will be permanently removed from the catalog and
            inventory. Active rentals will not be affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmBook(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteBook.isPending}
            onClick={() => confirmBook && deleteBook.mutate(confirmBook.id)}
          >
            {deleteBook.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}

/* ─── Edit Book Dialog ──────────────────────────────────────────────────────── */

function EditBookDialog({
  book,
  onClose,
  onSaved,
}: {
  book: CatalogBook;
  onClose: () => void;
  onSaved: (title: string) => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [totalCopies, setTotalCopies] = useState(book.totalCopies);
  const [isbn, setIsbn] = useState(book.isbn ?? '');
  const [description, setDescription] = useState(book.description ?? '');
  const [genre, setGenre] = useState(book.genre ?? '');
  const [coverUrl, setCoverUrl] = useState(book.coverUrl ?? '');
  const [publishedYear, setPublishedYear] = useState(
    book.publishedYear ? String(book.publishedYear) : '',
  );
  const [showOptional, setShowOptional] = useState(
    !!(book.isbn || book.description || book.genre || book.coverUrl || book.publishedYear),
  );

  const save = useMutation({
    mutationFn: () =>
      patchCatalogBook(book.id, {
        title: title.trim() || undefined,
        author: author.trim() || undefined,
        totalCopies: totalCopies || undefined,
        isbn: isbn.trim() || undefined,
        description: description.trim() || undefined,
        genre: genre.trim() || undefined,
        coverUrl: coverUrl.trim() || undefined,
        publishedYear: publishedYear ? parseInt(publishedYear, 10) : undefined,
      }),
    onSuccess: (updated) => onSaved(updated.title),
  });

  const error = save.error as AxiosError<{ message?: string }> | null;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit book</DialogTitle>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {error && (
              <Alert severity="error">
                {(error.response?.data?.message as string) ?? 'Could not save changes.'}
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
              {showOptional ? '▾ Hide optional fields' : '▸ ISBN, description, genre…'}
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
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/* ─── Book thumbnail ────────────────────────────────────────────────────────── */

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function BookThumb({ book }: { book: CatalogBook }) {
  const h = hashHue(book.title);
  const h2 = (h + 45) % 360;

  if (book.coverUrl) {
    return (
      <Avatar
        src={book.coverUrl}
        variant="rounded"
        sx={{ width: 40, height: 56 }}
        imgProps={{ onError: (e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; } }}
      />
    );
  }

  return (
    <Avatar
      variant="rounded"
      sx={{
        width: 40,
        height: 56,
        background: `linear-gradient(135deg, hsl(${h} 62% 52%), hsl(${h2} 68% 38%))`,
        fontSize: 10,
        fontWeight: 700,
        color: '#fff',
      }}
    >
      {book.title.slice(0, 2).toUpperCase()}
    </Avatar>
  );
}
