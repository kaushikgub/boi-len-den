import { api } from './client';
import { PaginatedRentals, Rental } from './types';

export async function getMyRentals(
  tab: 'active' | 'returned',
  page: number,
  limit = 5,
): Promise<PaginatedRentals> {
  const { data } = await api.get<PaginatedRentals>('/rentals', { params: { tab, page, limit } });
  return data;
}

export async function rentBook(bookId: string): Promise<Rental> {
  const { data } = await api.post<Rental>('/rentals', { bookId });
  return data;
}

export async function returnBook(rentalId: string): Promise<Rental> {
  const { data } = await api.post<Rental>(`/rentals/${rentalId}/return`);
  return data;
}
