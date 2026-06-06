import { KafkaService } from '@app/common';
import { BookRentedEvent, BookReturnedEvent } from '@app/contracts';
import { InventoryConsumer } from './inventory.consumer';
import { InventoryService } from './inventory.service';

describe('InventoryConsumer routing', () => {
  let inventory: { confirm: jest.Mock; applyReturn: jest.Mock };
  let consumer: InventoryConsumer;

  beforeEach(() => {
    inventory = { confirm: jest.fn(), applyReturn: jest.fn() };
    consumer = new InventoryConsumer(
      {} as KafkaService,
      inventory as unknown as InventoryService,
    );
  });

  it('routes BookRented to confirm(reservationId, rentalId) — never re-decrements', async () => {
    const event = {
      eventId: 'e1',
      eventType: 'BookRented',
      correlationId: 'c1',
      payload: { reservationId: 'res-1', rentalId: 'rent-1', bookId: 'b1', userId: 'u1', dueAt: '' },
    } as unknown as BookRentedEvent;

    await consumer.handleEvent('book-rented', event);

    expect(inventory.confirm).toHaveBeenCalledWith('res-1', 'rent-1');
    expect(inventory.applyReturn).not.toHaveBeenCalled();
  });

  it('routes BookReturned to applyReturn(eventId, bookId, rentalId) — deduped by eventId', async () => {
    const event = {
      eventId: 'e2',
      eventType: 'BookReturned',
      correlationId: 'c2',
      payload: { rentalId: 'rent-2', bookId: 'b2', userId: 'u2', returnedAt: '', wasOverdue: false },
    } as unknown as BookReturnedEvent;

    await consumer.handleEvent('book-returned', event);

    expect(inventory.applyReturn).toHaveBeenCalledWith('e2', 'b2', 'rent-2');
    expect(inventory.confirm).not.toHaveBeenCalled();
  });
});
