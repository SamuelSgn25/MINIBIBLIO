const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Book = require('../models/Book');
const Loan = require('../models/Loan');

const router = express.Router();
const LOAN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const respondError = (res, status, message) => res.status(status).json({ message });
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function requireAdmin(req, res, next) {
	const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
	if (!token) return respondError(res, 401, 'Authentification requise.');
	if (!process.env.JWT_SECRET) return respondError(res, 500, 'Configuration JWT manquante.');
	try {
		req.admin = jwt.verify(token, process.env.JWT_SECRET);
		if (req.admin.role !== 'admin') return respondError(res, 403, 'Accès réservé aux administrateurs.');
		return next();
	} catch (_) {
		return respondError(res, 401, 'Jeton invalide ou expiré.');
	}
}

function isAdmin(user) {
	return user && (user.role === 'admin' || user.role === 'administrator');
}

function activeLoansForMember(memberId) {
	return Loan.find({ user: memberId, returnedAt: null });
}

router.post('/login', wrap(async (req, res) => {
	const email = String((req.body || {}).email || '').trim().toLowerCase();
	const password = (req.body || {}).password;
	if (!email || !password) return respondError(res, 400, 'Email et mot de passe requis.');
	if (!process.env.JWT_SECRET) return respondError(res, 500, 'Configuration JWT manquante.');

	const user = await User.findOne({ email });
	if (!user || !isAdmin(user) || !(await bcrypt.compare(password, user.password))) {
		return respondError(res, 401, 'Identifiants invalides ou compte non administrateur.');
	}
	const token = jwt.sign({ id: user._id, role: 'admin' }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN || '1d'
	});
	return res.status(200).json({ message: 'Connexion réussie.', token });
}));

router.use(requireAdmin);

router.post('/books', wrap(async (req, res) => {
	const book = await Book.create(req.body);
	return res.status(201).json(book);
}));

router.get('/books', wrap(async (req, res) => res.status(200).json(await Book.find())));

router.get('/books/:id', wrap(async (req, res) => {
	const book = await Book.findById(req.params.id);
	if (!book) return respondError(res, 404, 'Livre introuvable.');
	return res.status(200).json(book);
}));

router.put('/books/:id', wrap(async (req, res) => {
	const book = await Book.findById(req.params.id);
	if (!book) return respondError(res, 404, 'Livre introuvable.');
	if (await Loan.exists({ book: book._id, returnedAt: null })) {
		return respondError(res, 409, 'Le livre ne peut pas être modifié avant le retour des exemplaires empruntés.');
	}
	Object.assign(book, req.body);
	await book.save();
	return res.status(200).json(book);
}));

router.delete('/books/:id', wrap(async (req, res) => {
	const book = await Book.findById(req.params.id);
	if (!book) return respondError(res, 404, 'Livre introuvable.');
	if (await Loan.exists({ book: book._id, returnedAt: null })) {
		return respondError(res, 409, 'Le livre ne peut pas être supprimé avant le retour des exemplaires empruntés.');
	}
	await book.deleteOne();
	return res.status(200).json({ message: 'Livre supprimé.' });
}));

router.post('/members', wrap(async (req, res) => {
	const member = await User.create({ ...req.body, role: 'member' });
	const data = member.toObject();
	delete data.password;
	return res.status(201).json(data);
}));

router.get('/members', wrap(async (req, res) => {
	const members = await User.find({ role: { $nin: ['admin', 'administrator'] } }).select('-password');
	return res.status(200).json(members);
}));

router.get('/members/:id', wrap(async (req, res) => {
	const member = await User.findById(req.params.id).select('-password');
	if (!member || isAdmin(member)) return respondError(res, 404, 'Membre introuvable.');
	return res.status(200).json(member);
}));

router.put('/members/:id', wrap(async (req, res) => {
	const member = await User.findById(req.params.id);
	if (!member || isAdmin(member)) return respondError(res, 404, 'Membre introuvable.');
	const updates = { ...req.body };
	delete updates.role;
	delete updates.password;
	Object.assign(member, updates);
	await member.save();
	const data = member.toObject();
	delete data.password;
	return res.status(200).json(data);
}));

router.delete('/members/:id', wrap(async (req, res) => {
	const member = await User.findById(req.params.id);
	if (!member || isAdmin(member)) return respondError(res, 404, 'Membre introuvable.');
	if (await Loan.exists({ user: member._id, returnedAt: null })) {
		return respondError(res, 409, 'Un membre ayant un emprunt en cours ne peut pas être supprimé.');
	}
	await member.deleteOne();
	return res.status(200).json({ message: 'Membre supprimé.' });
}));

router.get('/loans', wrap(async (req, res) => {
	const loans = await Loan.find({ returnedAt: null }).populate('user').populate('book');
	return res.status(200).json(loans);
}));

router.post('/loans', wrap(async (req, res) => {
	const { userId, memberId, bookId } = req.body || {};
	if (!bookId || !(userId || memberId)) return respondError(res, 400, 'Identifiants du membre et du livre requis.');
	const member = await User.findById(userId || memberId);
	if (!member || isAdmin(member)) return respondError(res, 404, 'Membre introuvable.');
	const book = await Book.findById(bookId);
	if (!book) return respondError(res, 404, 'Livre introuvable.');

	const loans = await activeLoansForMember(member._id);
	const now = Date.now();
	if (loans.some((loan) => loan.dueDate && new Date(loan.dueDate).getTime() < now)) {
		return respondError(res, 409, 'Un emprunt en retard empêche tout nouvel emprunt.');
	}
	if (loans.length >= 3) return respondError(res, 409, 'Un membre ne peut pas dépasser trois emprunts en cours.');
	if (!Number.isFinite(Number(book.availableCopies)) || Number(book.availableCopies) <= 0) {
		return respondError(res, 409, 'Aucun exemplaire disponible.');
	}

	const borrowedAt = new Date();
	const loan = await Loan.create({
		user: member._id,
		book: book._id,
		borrowedAt,
		dueDate: new Date(borrowedAt.getTime() + LOAN_DAYS * DAY_MS),
		returnedAt: null
	});
	book.availableCopies -= 1;
	await book.save();
	return res.status(201).json(loan);
}));

router.patch('/loans/:id/return', wrap(async (req, res) => {
	const loan = await Loan.findById(req.params.id);
	if (!loan) return respondError(res, 404, 'Emprunt introuvable.');
	if (loan.returnedAt) return respondError(res, 409, 'Cet emprunt est déjà clôturé.');
	loan.returnedAt = new Date();
	await loan.save();
	const book = await Book.findById(loan.book);
	if (book) {
		book.availableCopies = Number(book.availableCopies || 0) + 1;
		await book.save();
	}
	return res.status(200).json({ message: 'Retour enregistré.', loan });
}));

router.use((err, req, res, next) => {
	if (res.headersSent) return next(err);
	if (err.name === 'ValidationError' || err.name === 'CastError' || err instanceof SyntaxError) {
		return respondError(res, 400, err.message);
	}
	if (err.code === 11000) return respondError(res, 409, 'Une ressource avec cette valeur existe déjà.');
	return respondError(res, 500, 'Erreur interne du serveur.');
});

module.exports = router;
