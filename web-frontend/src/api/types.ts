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
}

export type RentalStatus = 'RESERVED' | 'ACTIVE' | 'OVERDUE' | 'RETURNED' | 'CANCELLED';

export interface Rental {
  id: string;
  bookId: string;
  userId: string;
  status: RentalStatus;
  dueAt: string;
  rentedAt: string;
  returnedAt: string | null;
}
