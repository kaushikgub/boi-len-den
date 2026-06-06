export type Role = 'member' | 'librarian' | 'admin';

export interface User {
  id: string;
  email: string;
  roles: Role[];
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  totalCopies: number;
  availableCopies: number;
  coverUrl: string | null;
}

/** Richer book record owned by catalog-service. Does not include availability counts. */
export interface CatalogBook {
  id: string;
  title: string;
  author: string;
  totalCopies: number;
  isbn: string | null;
  description: string | null;
  genre: string | null;
  coverUrl: string | null;
  publishedYear: number | null;
  isHidden: boolean;
  createdAt: string;
}

export type RentalStatus = 'RESERVED' | 'ACTIVE' | 'OVERDUE' | 'RETURNED' | 'CANCELLED';

export type PaymentStatus = 'CHARGED' | 'REFUNDED';

export interface Payment {
  id: string;
  rentalId: string;
  bookId: string;
  userId: string;
  amountCents: number;
  status: PaymentStatus;
  chargedAt: string;
  refundedAt: string | null;
}

export interface Rental {
  id: string;
  bookId: string;
  userId: string;
  status: RentalStatus;
  dueAt: string;
  rentedAt: string;
  returnedAt: string | null;
}
