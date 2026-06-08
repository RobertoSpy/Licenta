import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { userRepository } from './userRepository';
import { sendPasswordResetEmail, sendVerificationEmail } from './emailService';
import { AuthRequest } from '../../core/middleware/authMiddleware';
import { prisma } from '../../lib/prisma';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// REGISTER

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, phone } = req.body;

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
      name,
      phone,
      isVerified: false
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    await userRepository.saveVerificationToken(
      newUser.id,
      hashedOtp,
      new Date(Date.now() + 15 * 60 * 1000)
    );

    await sendVerificationEmail(email, otp);

    res.status(201).json({
      message: 'Te rugăm să verifici emailul pentru codul de activare.',
      user: { id: newUser.id, email: newUser.email, name: newUser.name }
    });

  } catch (error) {
    console.error('Eroare la înregistrare:', error);
    res.status(500).json({ message: 'Eroare internă a serverului' });
  }
};

export const registerContractor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, phone, companyName, cui, county, specializations, coverageRadius } = req.body;

    if (!email || !password || !companyName || !cui || !county) {
      res.status(400).json({ message: 'Toate câmpurile esențiale sunt obligatorii' });
      return;
    }

    const isStrongPassword = password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password);

    if (!isStrongPassword) {
      res.status(400).json({ message: 'Parola nu este suficient de puternică.' });
      return;
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      res.status(409).json({ message: 'Un cont cu acest email există deja' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Tranzacție — creăm user + profil contractor atomic
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone,
          role: 'CONTRACTOR' as any,
          isVerified: false // Verificare email normală
        }
      });

      await tx.contractorProfile.create({
        data: {
          userId: user.id,
          companyName,
          cui,
          county,
          specializations: specializations || [],
          coverageRadius: coverageRadius || 50,
          isVerified: false // Verificare administrativă CUI separat
        }
      });

      return user;
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    await userRepository.saveVerificationToken(
      newUser.id,
      hashedOtp,
      new Date(Date.now() + 15 * 60 * 1000)
    );

    await sendVerificationEmail(email, otp);

    res.status(201).json({
      message: 'Cont de constructor creat. Te rugăm să verifici emailul.',
      user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }
    });

  } catch (error) {
    console.error('Eroare la înregistrare constructor:', error);
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

    if (!user.isVerified) {
      res.status(403).json({ message: 'Contul nu este verificat. Introdu codul trimis pe email.' });
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
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
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

        res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
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

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  // Același răspuns indiferent — nu dezvălui dacă emailul există în DB
  const genericResponse = {
    message: 'Dacă adresa există, vei primi un cod de verificare în câteva minute.'
  };

  try {
    const user = await userRepository.findByEmail(email);
    if (!user) return res.status(200).json(genericResponse);

    // Generăm un cod OTP de 6 cifre
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');

    await userRepository.saveResetToken(
      user.id,
      hashedOtp,
      new Date(Date.now() + 15 * 60 * 1000) // 15 minute
    );

    await sendPasswordResetEmail(email, otp);

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(200).json(genericResponse); // tot același răspuns
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, cod OTP și parola nouă sunt obligatorii.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'Parola trebuie să aibă minim 8 caractere.' });
  }

  const hashedOtp = crypto
    .createHash('sha256')
    .update(otp)
    .digest('hex');

  const user = await userRepository.findByResetToken(hashedOtp);

  if (!user || user.email !== email) {
    return res.status(400).json({ message: 'Cod invalid sau expirat.' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await userRepository.clearResetToken(user.id, hashedPassword);

  return res.status(200).json({ message: 'Parola a fost resetată cu succes.' });
};

export const verifyEmail = async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email și codul OTP sunt obligatorii.' });
  }

  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  const user = await userRepository.findByVerificationToken(hashedOtp);

  if (!user || user.email !== email) {
    return res.status(400).json({ message: 'Cod invalid sau expirat.' });
  }

  await userRepository.markAsVerified(user.id);

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

  return res.status(200).json({
    message: 'Cont verificat cu succes!',
    accessToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
};

export const resendVerification = async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await userRepository.findByEmail(email);
  if (!user) {
    return res.status(200).json({ message: 'Dacă emailul există, vei primi un nou cod.' });
  }

  if (user.isVerified) {
    return res.status(400).json({ message: 'Contul este deja verificat.' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  await userRepository.saveVerificationToken(
    user.id,
    hashedOtp,
    new Date(Date.now() + 15 * 60 * 1000)
  );

  await sendVerificationEmail(email, otp);

  return res.status(200).json({ message: 'Un nou cod de verificare a fost trimis.' });
};

// DELETE ACCOUNT — GDPR: Dreptul de a fi uitat
export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ message: 'Parola este obligatorie pentru confirmare.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: 'Utilizator inexistent.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ message: 'Parolă incorectă. Contul nu a fost șters.' });
      return;
    }

    // Ștergem utilizatorul — CASCADE va șterge profilul, proiectele, ofertele etc.
    await prisma.user.delete({ where: { id: userId } });

    res.clearCookie('refreshToken');
    res.status(200).json({ message: 'Contul și toate datele asociate au fost șterse permanent.' });
  } catch (error) {
    console.error('deleteAccount error:', error);
    res.status(500).json({ message: 'Eroare la ștergerea contului.' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, password } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;

    if (password) {
      const isStrongPassword = password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password);

      if (!isStrongPassword) {
        res.status(400).json({ message: 'Parola nu este suficient de puternică.' });
        return;
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, role: true }
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ message: 'Eroare la actualizarea profilului.' });
  }
};
