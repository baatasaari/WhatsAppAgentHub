import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users, sessions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    status: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
  };
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly TOKEN_EXPIRY_HOURS = 24;

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static async createSession(userId: number): Promise<string> {
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

    await db.insert(sessions).values({
      userId,
      token,
      expiresAt,
    });

    return token;
  }

  static async validateSession(token: string) {
    const [session] = await db
      .select({
        session: sessions,
        user: users,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(
        eq(sessions.token, token),
        eq(users.status, 'approved')
      ))
      .limit(1);

    if (!session || session.session.expiresAt < new Date()) {
      return null;
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, session.user.id));

    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      status: session.user.status,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      companyName: session.user.companyName,
    };
  }

  static async revokeSession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  static async cleanupExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(
      // Comparison with current timestamp
      eq(sessions.expiresAt, new Date())
    );
  }
}

// Authentication middleware
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication token required' });
    }

    const user = await AuthService.validateSession(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
};

// Authorization middleware for admin only
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
};

// Authorization middleware for approved users only
export const requireApproved = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.status !== 'approved') {
    return res.status(403).json({ message: 'Account approval required' });
  }

  next();
};

// Combined middleware for approved business users or admins
export const requireApprovedUser = [authenticate, requireApproved];

// Combined middleware for admin access
export const requireAdminAccess = [authenticate, requireAdmin];