const express = require('express');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const router = express.Router();

function verifyToken(req, res, next) {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (!token) return res.status(401).json({ ok: false, message: 'Sin token' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(403).json({ ok: false, message: 'Token inválido' });
    }
}

// ── GET / — listar todos ─────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT id_cliente, empresa, contacto, email,
                   telefono, direccion, tipo, estado, fecha
            FROM cliente
            ORDER BY fecha DESC
        `);
        res.json({ ok: true, clients: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, message: 'Error al obtener clientes' });
    }
});

// ── POST / — crear cliente ───────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
    const { empresa, contacto, email, telefono, direccion, tipo, estado } = req.body;

    if (!contacto || !email) {
        return res.status(400).json({ ok: false, message: 'Contacto y email son obligatorios' });
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO cliente (empresa, contacto, email, telefono, direccion, tipo, estado, fecha)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [empresa || '', contacto, email, telefono || '', direccion || '',
            tipo || 'Minorista', estado || 'Activo']
        );
        res.json({ ok: true, message: 'Cliente creado', id_cliente: result.insertId });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ ok: false, message: 'El email ya está registrado' });
        }
        res.status(500).json({ ok: false, message: 'Error al crear cliente' });
    }
});

// ── PUT /:id — actualizar cliente ────────────────────────────
router.put('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { empresa, contacto, email, telefono, direccion, tipo, estado } = req.body;

    if (!contacto || !email) {
        return res.status(400).json({ ok: false, message: 'Contacto y email son obligatorios' });
    }

    try {
        await pool.query(
            `UPDATE cliente 
             SET empresa=?, contacto=?, email=?, telefono=?, direccion=?, tipo=?, estado=?
             WHERE id_cliente=?`,
            [empresa || '', contacto, email, telefono || '', direccion || '',
            tipo || 'Minorista', estado || 'Activo', id]
        );
        res.json({ ok: true, message: 'Cliente actualizado' });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ ok: false, message: 'El email ya está registrado' });
        }
        res.status(500).json({ ok: false, message: 'Error al actualizar cliente' });
    }
});

// ── DELETE /:id — eliminar cliente ───────────────────────────
router.delete('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM cliente WHERE id_cliente = ?', [id]);
        res.json({ ok: true, message: 'Cliente eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, message: 'Error al eliminar cliente' });
    }
});

module.exports = router;