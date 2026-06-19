import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../lib/store.js';
import { config } from '../config/index.js';
import { AppError } from '../middleware/error.middleware.js';

function signToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) throw new AppError('Email and password are required.', 400);
    if (password.length < 6) throw new AppError('Password must be at least 6 characters.', 400);

    const existing = db.user.findByEmail(email);
    if (existing) throw new AppError('An account with this email already exists.', 409);

    const hashed = await bcrypt.hash(password, 12);
    const user = db.user.create({ email, password: hashed, name: name || null });

    const token = signToken(user.id, user.email);

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, createdAt: user.createdAt },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) throw new AppError('Email and password are required.', 400);

    const user = db.user.findByEmail(email);
    if (!user) throw new AppError('Invalid email or password.', 401);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError('Invalid email or password.', 401);

    const token = signToken(user.id, user.email);

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = db.user.findById(req.user!.id);
    if (!user) throw new AppError('User not found.', 404);

    res.json({
      success: true,
      data: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, createdAt: user.createdAt },
    });
  } catch (error) {
    next(error);
  }
};