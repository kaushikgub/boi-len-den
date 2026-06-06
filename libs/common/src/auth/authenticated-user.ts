export type Role = 'member' | 'librarian' | 'admin';

/** The trusted identity extracted from a validated access token. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: Role[];
  jti: string;
}
