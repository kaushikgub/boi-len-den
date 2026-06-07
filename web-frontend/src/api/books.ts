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

export async function getCatalogBooks(): Promise<CatalogBook[]> {
  const { data } = await api.get<CatalogBook[]>('/catalog/books');
  return data;
}

/** Admin only — returns all books including hidden ones. */
export async function getCatalogBooksAdmin(): Promise<CatalogBook[]> {
  const { data } = await api.get<CatalogBook[]>('/catalog/books', { params: { includeHidden: 'true' } });
  return data;
}

export async function getCatalogBook(id: string): Promise<CatalogBook> {
  const { data } = await api.get<CatalogBook>(`/catalog/books/${id}`);
  return data;
}

export interface UpdateBookInput {
  title?: string;
  author?: string;
  totalCopies?: number;
  isbn?: string;
  description?: string;
  genre?: string;
  coverUrl?: string;
  publishedYear?: number;
  isHidden?: boolean;
}

export async function patchCatalogBook(id: string, patch: UpdateBookInput): Promise<CatalogBook> {
  const { data } = await api.patch<CatalogBook>(`/catalog/books/${id}`, patch);
  return data;
}

export async function deleteCatalogBook(id: string): Promise<void> {
  await api.delete(`/catalog/books/${id}`);
}

export async function deleteInventoryBook(id: string): Promise<void> {
  await api.delete(`/books/${id}`);
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
