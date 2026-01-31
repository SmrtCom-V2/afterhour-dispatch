import jwt from 'jsonwebtoken';
import { generateToken } from '../middleware/auth.js';
import { config } from '../config/index.js';

describe('Token role separation', () => {
  test('generateToken includes role when provided', () => {
    const token = generateToken(123, 'sa@example.com', { role: 'super_admin' });
    const payload = jwt.verify(token, config.jwt.secret);
    expect(payload.userId).toBe(123);
    expect(payload.email).toBe('sa@example.com');
    expect(payload.role).toBe('super_admin');
  });

  test('generateToken without role does not set role', () => {
    const token = generateToken(456, 'user@example.com');
    const payload = jwt.verify(token, config.jwt.secret);
    expect(payload.userId).toBe(456);
    expect(payload.email).toBe('user@example.com');
    expect(payload.role).toBeUndefined();
  });
});