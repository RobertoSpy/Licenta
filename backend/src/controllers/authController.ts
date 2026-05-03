import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/userRepository';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// REGISTER

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email și parola sunt obligatorii' });
      return;
    }

    // Server-side password strength validation
    const isStrongPassword = password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password);

    if (!isStrongPassword) {
      res.status(400).json({ message: 'Parola nu este suficient de puternică. Trebuie să conțină minim 8 caractere, o majusculă, o cifră și un caracter special.' });
      return;
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      res.status(409).json({ message: 'Un cont cu acest email există deja' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await userRepository.create({
      email,
      password: hashedPassword,
      name
    });

    res.status(201).json({
      message: 'Cont creat cu succes',
      user: { id: newUser.id, email: newUser.email, name: newUser.name }
    });

  } catch (error) {
    console.error('Eroare la înregistrare:', error);
    res.status(500).json({ message: 'Eroare internă a serverului' });
  }
};

// LOGIN

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email și parola sunt obligatorii' });
      return;
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      res.status(401).json({ message: 'Credențiale invalide' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Credențiale invalide' });
      return;
    }

    // Generăm token-urile
    const accessToken = jwt.sign(
      { id: user.id },
      JWT_ACCESS_SECRET as string,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET as string,
      { expiresIn: '7d' }
    );

    await userRepository.updateRefreshToken(user.id, refreshToken);

    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name }
    });

  } catch (error) {
    console.error('Eroare la login:', error);
    res.status(500).json({ message: 'Eroare internă a serverului' });
  }
};

// REHIDRATARE
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const cookies = req.cookies;

    if (!cookies?.jwt) {
      res.status(401).json({ message: 'Neautorizat - Nu există cookie de refresh' });
      return;
    }

    const refreshToken = cookies.jwt;

    const user = await userRepository.findByRefreshToken(refreshToken);

    if (!user) {
      res.status(403).json({ message: 'Acces interzis - Token invalid pe server' });
      return;
    }

    jwt.verify(
      refreshToken,
      JWT_REFRESH_SECRET as string,
      (err: any, decoded: any) => {
        if (err || user.id !== decoded.id) {
          return res.status(403).json({ message: 'Acces interzis - Token manipulat sau expirat' });
        }


        const accessToken = jwt.sign(
          { id: user.id },
          JWT_ACCESS_SECRET as string,
          { expiresIn: '15m' }
        );

        res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
      }
    );

  } catch (error) {
    console.error('Eroare la refresh:', error);
    res.status(500).json({ message: 'Eroare internă a serverului' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const cookies = req.cookies;
    if (!cookies?.jwt) {
      res.sendStatus(204);
      return;
    }

    const refreshToken = cookies.jwt;

    await userRepository.clearRefreshToken(refreshToken);

    res.clearCookie('jwt', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
    res.sendStatus(204);

  } catch (error) {
    console.error('Eroare la logout:', error);
    res.status(500).json({ message: 'Eroare internă a serverului' });
  }
};
