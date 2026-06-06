import { api } from './client';
import { Book } from './types';

export async function getBooks(): Promise<Book[]> {
  const { data } = await api.get<Book[]>('/books');
  return data;
}

export async function getBook(id: string): Promise<Book> {
  const { data } = await api.get<Book>(`/books/${id}`);
  return data;
}

export interface CreateBookInput {
  title: string;
  author: string;
  totalCopies: number;
}

export async function createBook(input: CreateBookInput): Promise<Book> {
  const { data } = await api.post<Book>('/books', input);
  return data;
}
