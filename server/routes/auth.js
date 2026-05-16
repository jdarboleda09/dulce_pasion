// ============================================================
//  routes/auth.js — Login con correo/contraseña + Google OAuth
//  DulcePasión
// ============================================================

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library'); // npm install google-auth-library
const pool = require('../db');
require('dotenv').config();

const router = express.Router();

// Cliente de Google para verificar tokens
// Asegúrate de tener en tu .env:  GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ──────────────────────────────────────────────────────────────
//  POST /api/auth/login  — Login con correo y contraseña
// ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ ok: false, message: 'Correo y contraseña son obligatorios.' });
        }

        // Buscar usuario
        const [rows] = await pool.query(
            'SELECT * FROM usuario WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ ok: false, message: 'Usuario no encontrado.' });
        }

        const user = rows[0];

        // Verificar estado
        if (user.estado !== 'Activo') {
            return res.status(403).json({ ok: false, message: 'Tu cuenta está inactiva. Contacta al administrador.' });
        }

        // Usuarios registrados con Google no tienen contraseña local
        if (!user.password) {
            return res.status(401).json({
                ok: false,
                message: 'Esta cuenta fue creada con Google. Usa el botón "Continuar con Google".'
            });
        }

        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ ok: false, message: 'Contraseña incorrecta.' });
        }

        // Generar token JWT
        const token = jwt.sign(
            { id_usuario: user.id_usuario, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            ok: true,
            token,
            user: {
                id_usuario: user.id_usuario,
                nombre: user.nombre,
                email: user.email,
                rol: user.rol
            }
        });

    } catch (error) {
        console.error('[LOGIN ERROR]', error);
        return res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
    }
});

// ──────────────────────────────────────────────────────────────
//  POST /api/auth/google  — Login / Registro con Google
// ──────────────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ ok: false, message: 'Token de Google no proporcionado.' });
        }

        // ── Verificar el token con Google ──────────────────────
        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            payload = ticket.getPayload();
        } catch (verifyErr) {
            console.error('[GOOGLE TOKEN ERROR]', verifyErr);
            return res.status(401).json({ ok: false, message: 'Token de Google inválido o expirado.' });
        }

        // Datos del usuario provenientes de Google
        const { email, name, sub: googleId } = payload;

        // ── Buscar si el usuario ya existe en la BD ────────────
        const [rows] = await pool.query(
            'SELECT * FROM usuario WHERE email = ?',
            [email]
        );

        let user;
        let esNuevo = false;

        if (rows.length > 0) {
            // ── Usuario existente ──────────────────────────────
            user = rows[0];

            if (user.estado !== 'Activo') {
                return res.status(403).json({
                    ok: false,
                    message: 'Tu cuenta está inactiva. Contacta al administrador.'
                });
            }

        } else {
            // ── Usuario nuevo — registrar automáticamente ──────
            esNuevo = true;

            const [result] = await pool.query(
                `INSERT INTO usuario (nombre, email, password, rol, estado, fecha)
                 VALUES (?, ?, NULL, 'cliente', 'Activo', NOW())`,
                [name, email]
            );

            // Recuperar el usuario recién insertado
            const [newRows] = await pool.query(
                'SELECT * FROM usuario WHERE id_usuario = ?',
                [result.insertId]
            );

            user = newRows[0];
        }

        // ── Generar token JWT propio ──────────────────────────
        const token = jwt.sign(
            { id_usuario: user.id_usuario, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            ok: true,
            nuevo: esNuevo,   // el front puede mostrar "Registro exitoso" vs "Bienvenido"
            token,
            user: {
                id_usuario: user.id_usuario,
                nombre: user.nombre,
                email: user.email,
                rol: user.rol
            }
        });

    } catch (error) {
        console.error('[GOOGLE LOGIN ERROR]', error);
        return res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
    }
});

module.exports = router;