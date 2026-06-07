import { api } from './client';
import { PaginatedPayments, PaymentStatus } from './types';

export async function getMyPayments(
  status: PaymentStatus | undefined,
  page: number,
  limit = 5,
): Promise<PaginatedPayments> {
  const params: Record<string, string | number> = { page, limit };
  if (status) params.status = status;
  const { data } = await api.get<PaginatedPayments>('/payments', { params });
  return data;
}
