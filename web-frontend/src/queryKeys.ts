/** Centralized TanStack Query keys so invalidation stays consistent. */
export const queryKeys = {
  books: ['books'] as const,
  book: (id: string) => ['books', id] as const,
  myRentals: ['rentals', 'mine'] as const,
};
