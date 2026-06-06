/** Header carrying the trace id across every service hop. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** Header the gateway uses to forward the authenticated user id downstream. */
export const USER_ID_HEADER = 'x-user-id';

/** Header the gateway uses to forward the authenticated user's roles downstream. */
export const USER_ROLES_HEADER = 'x-user-roles';
