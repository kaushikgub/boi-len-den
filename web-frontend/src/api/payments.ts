import { api } from './client';
import { Payment } from './types';

export async function getMyPayments(): Promise<Payment[]> {
  const { data } = await api.get<Payment[]>('/payments');
  return data;
}
