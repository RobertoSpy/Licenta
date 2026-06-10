"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.deleteAccount = exports.resendVerification = exports.verifyEmail = exports.resetPassword = exports.forgotPassword = exports.logout = exports.refresh = exports.login = exports.registerContractor = exports.register = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const userRepository_1 = require("./userRepository");
const emailService_1 = require("./emailService");
const prisma_1 = require("../../lib/prisma");
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
// REGISTER
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const existingUser = yield userRepository_1.userRepository.findByEmail(email);
        if (existingUser) {
            res.status(409).json({ message: 'Un cont cu acest email există deja' });
            return;
        }
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        const newUser = yield userRepository_1.userRepository.create({
            email,
            password: hashedPassword,
            name,
            phone,
            isVerified: false
        });
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto_1.default.createHash('sha256').update(otp).digest('hex');
        yield userRepository_1.userRepository.saveVerificationToken(newUser.id, hashedOtp, new Date(Date.now() + 15 * 60 * 1000));
        yield (0, emailService_1.sendVerificationEmail)(email, otp);
        res.status(201).json({
            message: 'Te rugăm să verifici emailul pentru codul de activare.',
            user: { id: newUser.id, email: newUser.email, name: newUser.name }
        });
    }
    catch (error) {
        console.error('Eroare la înregistrare:', error);
        res.status(500).json({ message: 'Eroare internă a serverului' });
    }
});
exports.register = register;
const registerContractor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const existingUser = yield userRepository_1.userRepository.findByEmail(email);
        if (existingUser) {
            res.status(409).json({ message: 'Un cont cu acest email există deja' });
            return;
        }
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        // Tranzacție — creăm user + profil contractor atomic
        const newUser = yield prisma_1.prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const user = yield tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    phone,
                    role: 'CONTRACTOR',
                    isVerified: false // Verificare email normală
                }
            });
            yield tx.contractorProfile.create({
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
        }));
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto_1.default.createHash('sha256').update(otp).digest('hex');
        yield userRepository_1.userRepository.saveVerificationToken(newUser.id, hashedOtp, new Date(Date.now() + 15 * 60 * 1000));
        yield (0, emailService_1.sendVerificationEmail)(email, otp);
        res.status(201).json({
            message: 'Cont de constructor creat. Te rugăm să verifici emailul.',
            user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }
        });
    }
    catch (error) {
        console.error('Eroare la înregistrare constructor:', error);
        res.status(500).json({ message: 'Eroare internă a serverului' });
    }
});
exports.registerContractor = registerContractor;
// LOGIN
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: 'Email și parola sunt obligatorii' });
            return;
        }
        const user = yield userRepository_1.userRepository.findByEmail(email);
        if (!user) {
            res.status(401).json({ message: 'Credențiale invalide' });
            return;
        }
        const isMatch = yield bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ message: 'Credențiale invalide' });
            return;
        }
        if (!user.isVerified) {
            res.status(403).json({ message: 'Contul nu este verificat. Introdu codul trimis pe email.' });
            return;
        }
        // Generăm token-urile
        const accessToken = jsonwebtoken_1.default.sign({ id: user.id }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
        yield userRepository_1.userRepository.updateRefreshToken(user.id, refreshToken);
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
    }
    catch (error) {
        console.error('Eroare la login:', error);
        res.status(500).json({ message: 'Eroare internă a serverului' });
    }
});
exports.login = login;
// REHIDRATARE
const refresh = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cookies = req.cookies;
        if (!(cookies === null || cookies === void 0 ? void 0 : cookies.jwt)) {
            res.status(401).json({ message: 'Neautorizat - Nu există cookie de refresh' });
            return;
        }
        const refreshToken = cookies.jwt;
        const user = yield userRepository_1.userRepository.findByRefreshToken(refreshToken);
        if (!user) {
            res.status(403).json({ message: 'Acces interzis - Token invalid pe server' });
            return;
        }
        jsonwebtoken_1.default.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
            if (err || user.id !== decoded.id) {
                return res.status(403).json({ message: 'Acces interzis - Token manipulat sau expirat' });
            }
            const accessToken = jsonwebtoken_1.default.sign({ id: user.id }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
            res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
        });
    }
    catch (error) {
        console.error('Eroare la refresh:', error);
        res.status(500).json({ message: 'Eroare internă a serverului' });
    }
});
exports.refresh = refresh;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cookies = req.cookies;
        if (!(cookies === null || cookies === void 0 ? void 0 : cookies.jwt)) {
            res.sendStatus(204);
            return;
        }
        const refreshToken = cookies.jwt;
        yield userRepository_1.userRepository.clearRefreshToken(refreshToken);
        res.clearCookie('jwt', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
        res.sendStatus(204);
    }
    catch (error) {
        console.error('Eroare la logout:', error);
        res.status(500).json({ message: 'Eroare internă a serverului' });
    }
});
exports.logout = logout;
const forgotPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    // Același răspuns indiferent — nu dezvălui dacă emailul există în DB
    const genericResponse = {
        message: 'Dacă adresa există, vei primi un cod de verificare în câteva minute.'
    };
    try {
        const user = yield userRepository_1.userRepository.findByEmail(email);
        if (!user)
            return res.status(200).json(genericResponse);
        // Generăm un cod OTP de 6 cifre
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto_1.default
            .createHash('sha256')
            .update(otp)
            .digest('hex');
        yield userRepository_1.userRepository.saveResetToken(user.id, hashedOtp, new Date(Date.now() + 15 * 60 * 1000) // 15 minute
        );
        yield (0, emailService_1.sendPasswordResetEmail)(email, otp);
        return res.status(200).json(genericResponse);
    }
    catch (err) {
        console.error('forgotPassword error:', err);
        return res.status(200).json(genericResponse); // tot același răspuns
    }
});
exports.forgotPassword = forgotPassword;
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
        return res.status(400).json({ message: 'Email, cod OTP și parola nouă sunt obligatorii.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Parola trebuie să aibă minim 8 caractere.' });
    }
    const hashedOtp = crypto_1.default
        .createHash('sha256')
        .update(otp)
        .digest('hex');
    const user = yield userRepository_1.userRepository.findByResetToken(hashedOtp);
    if (!user || user.email !== email) {
        return res.status(400).json({ message: 'Cod invalid sau expirat.' });
    }
    const hashedPassword = yield bcrypt_1.default.hash(newPassword, 12);
    yield userRepository_1.userRepository.clearResetToken(user.id, hashedPassword);
    return res.status(200).json({ message: 'Parola a fost resetată cu succes.' });
});
exports.resetPassword = resetPassword;
const verifyEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ message: 'Email și codul OTP sunt obligatorii.' });
    }
    const hashedOtp = crypto_1.default.createHash('sha256').update(otp).digest('hex');
    const user = yield userRepository_1.userRepository.findByVerificationToken(hashedOtp);
    if (!user || user.email !== email) {
        return res.status(400).json({ message: 'Cod invalid sau expirat.' });
    }
    yield userRepository_1.userRepository.markAsVerified(user.id);
    const accessToken = jsonwebtoken_1.default.sign({ id: user.id }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    yield userRepository_1.userRepository.updateRefreshToken(user.id, refreshToken);
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
});
exports.verifyEmail = verifyEmail;
const resendVerification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    const user = yield userRepository_1.userRepository.findByEmail(email);
    if (!user) {
        return res.status(200).json({ message: 'Dacă emailul există, vei primi un nou cod.' });
    }
    if (user.isVerified) {
        return res.status(400).json({ message: 'Contul este deja verificat.' });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto_1.default.createHash('sha256').update(otp).digest('hex');
    yield userRepository_1.userRepository.saveVerificationToken(user.id, hashedOtp, new Date(Date.now() + 15 * 60 * 1000));
    yield (0, emailService_1.sendVerificationEmail)(email, otp);
    return res.status(200).json({ message: 'Un nou cod de verificare a fost trimis.' });
});
exports.resendVerification = resendVerification;
// DELETE ACCOUNT — GDPR: Dreptul de a fi uitat
const deleteAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { password } = req.body;
        if (!password) {
            res.status(400).json({ message: 'Parola este obligatorie pentru confirmare.' });
            return;
        }
        const user = yield prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ message: 'Utilizator inexistent.' });
            return;
        }
        const isValid = yield bcrypt_1.default.compare(password, user.password);
        if (!isValid) {
            res.status(401).json({ message: 'Parolă incorectă. Contul nu a fost șters.' });
            return;
        }
        // Ștergem utilizatorul — CASCADE va șterge profilul, proiectele, ofertele etc.
        yield prisma_1.prisma.user.delete({ where: { id: userId } });
        res.clearCookie('refreshToken');
        res.status(200).json({ message: 'Contul și toate datele asociate au fost șterse permanent.' });
    }
    catch (error) {
        console.error('deleteAccount error:', error);
        res.status(500).json({ message: 'Eroare la ștergerea contului.' });
    }
});
exports.deleteAccount = deleteAccount;
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { name, password } = req.body;
        const updateData = {};
        if (name)
            updateData.name = name;
        if (password) {
            const isStrongPassword = password.length >= 8 &&
                /[A-Z]/.test(password) &&
                /[0-9]/.test(password) &&
                /[^A-Za-z0-9]/.test(password);
            if (!isStrongPassword) {
                res.status(400).json({ message: 'Parola nu este suficient de puternică.' });
                return;
            }
            updateData.password = yield bcrypt_1.default.hash(password, 10);
        }
        const updatedUser = yield prisma_1.prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: { id: true, email: true, name: true, role: true }
        });
        res.status(200).json(updatedUser);
    }
    catch (error) {
        console.error('updateProfile error:', error);
        res.status(500).json({ message: 'Eroare la actualizarea profilului.' });
    }
});
exports.updateProfile = updateProfile;
