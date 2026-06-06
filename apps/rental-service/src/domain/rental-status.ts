/**
 * The rental lifecycle as a pure state machine — no I/O, fully unit-testable.
 * This is the single source of truth for which transitions are legal; the
 * service layer asks here before mutating a rental.
 *
 *   RESERVED ─▶ ACTIVE ─▶ RETURNED
 *        │         └─────▶ OVERDUE ─▶ RETURNED
 *        └─▶ CANCELLED
 *
 * Slice 1 creates rentals directly in ACTIVE (the copy is secured synchronously
 * before the rental is written). RESERVED/CANCELLED/OVERDUE exist for later
 * slices (async confirmation, overdue handling) and are encoded here now so the
 * transition rules stay in one place.
 */
export type RentalStatus = 'RESERVED' | 'ACTIVE' | 'OVERDUE' | 'RETURNED' | 'CANCELLED';

const TRANSITIONS: Record<RentalStatus, readonly RentalStatus[]> = {
  RESERVED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['RETURNED', 'OVERDUE'],
  OVERDUE: ['RETURNED'],
  RETURNED: [],
  CANCELLED: [],
};

export function canTransition(from: RentalStatus, to: RentalStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class IllegalRentalTransitionError extends Error {
  constructor(
    readonly from: RentalStatus,
    readonly to: RentalStatus,
  ) {
    super(`Illegal rental transition: ${from} -> ${to}`);
    this.name = 'IllegalRentalTransitionError';
  }
}

export function assertTransition(from: RentalStatus, to: RentalStatus): void {
  if (!canTransition(from, to)) throw new IllegalRentalTransitionError(from, to);
}

/** Whether a rental is currently in the borrower's hands (returnable). */
export function isOutstanding(status: RentalStatus): boolean {
  return status === 'ACTIVE' || status === 'OVERDUE';
}
