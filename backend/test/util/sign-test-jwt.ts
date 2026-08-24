import * as jwt from 'jsonwebtoken';

export interface TestJwtPayload {
  sub: string; // <-- change to `id`/`userId` if your JwtStrategy.validate() expects that instead
  role: 'USER' | 'ADMIN';
  email?: string;
}

/**
 * Signs a JWT for use in integration/e2e tests, using the same secret the
 * running app's JwtStrategy verifies against. Requires JWT_SECRET to be
 * loaded (via .env.test / dotenv-cli) before the test process starts.
 */
export function signTestJwt(payload: TestJwtPayload): string {
  const secret = process.env.JWT_SECRET; // <-- change env var name if yours differs
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Make sure .env.test is loaded (dotenv-cli) before running this test.',
    );
  }
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}
