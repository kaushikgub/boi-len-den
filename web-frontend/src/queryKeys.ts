/** Centralized TanStack Query keys so invalidation stays consistent. */
export const queryKeys = {
  books: ['books'] as const,
  book: (id: string) => ['books', id] as const,
  catalogBooks: ['catalog-books'] as const,
  catalogBook: (id: string) => ['catalog-books', id] as const,
  myRentals: (tab: string, page: number) => ['rentals', 'mine', tab, page] as const,
  myRentalsRoot: ['rentals', 'mine'] as const,
  myPayments: (status: string, page: number) => ['payments', 'mine', status, page] as const,
  myPaymentsRoot: ['payments', 'mine'] as const,
};
