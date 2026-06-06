import { api } from './client';
import { Rental } from './types';

export async function getMyRentals(): Promise<Rental[]> {
  const { data } = await api.get<Rental[]>('/rentals');
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
