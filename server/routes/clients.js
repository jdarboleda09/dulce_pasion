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

// GET /api/clients
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

module.exports = router;