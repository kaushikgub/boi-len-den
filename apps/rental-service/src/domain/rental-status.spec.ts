import {
  assertTransition,
  canTransition,
  IllegalRentalTransitionError,
  isOutstanding,
  RentalStatus,
} from './rental-status';

describe('rental state machine', () => {
  it('allows the happy-path transitions', () => {
    expect(canTransition('RESERVED', 'ACTIVE')).toBe(true);
    expect(canTransition('ACTIVE', 'RETURNED')).toBe(true);
    expect(canTransition('ACTIVE', 'OVERDUE')).toBe(true);
    expect(canTransition('OVERDUE', 'RETURNED')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('RETURNED', 'ACTIVE')).toBe(false);
    expect(canTransition('RETURNED', 'RETURNED')).toBe(false); // no double-return
    expect(canTransition('ACTIVE', 'RESERVED')).toBe(false);
    expect(canTransition('CANCELLED', 'ACTIVE')).toBe(false);
  });

  it('assertTransition throws on an illegal move', () => {
    expect(() => assertTransition('RETURNED', 'RETURNED')).toThrow(IllegalRentalTransitionError);
  });

  it('assertTransition is silent on a legal move', () => {
    expect(() => assertTransition('ACTIVE', 'RETURNED')).not.toThrow();
  });

  it('isOutstanding is true only while the book is held', () => {
    const expected: Record<RentalStatus, boolean> = {
      RESERVED: false,
      ACTIVE: true,
      OVERDUE: true,
      RETURNED: false,
      CANCELLED: false,
    };
    (Object.keys(expected) as RentalStatus[]).forEach((s) =>
      expect(isOutstanding(s)).toBe(expected[s]),
    );
  });
});
