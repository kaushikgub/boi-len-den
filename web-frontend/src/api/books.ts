import { api } from './client';
import { Book, CatalogBook } from './types';

export async function getBooks(): Promise<Book[]> {
  const { data } = await api.get<Book[]>('/books');
  return data;
}

export async function getBook(id: string): Promise<Book> {
  const { data } = await api.get<Book>(`/books/${id}`);
  return data;
}

export async function getCatalogBook(id: string): Promise<CatalogBook> {
  const { data } = await api.get<CatalogBook>(`/catalog/books/${id}`);
  return data;
}

export async function searchCatalog(q: string): Promise<CatalogBook[]> {
  const { data } = await api.get<CatalogBook[]>('/catalog/books/search', { params: { q } });
  return data;
}

export interface CreateBookInput {
  title: string;
  author: string;
  totalCopies: number;
  isbn?: string;
  description?: string;
  genre?: string;
  coverUrl?: string;
  publishedYear?: number;
}

export async function createBook(input: CreateBookInput): Promise<CatalogBook> {
  const { data } = await api.post<CatalogBook>('/catalog/books', input);
  return data;
}
