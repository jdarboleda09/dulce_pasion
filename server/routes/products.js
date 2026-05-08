const express = require('express');
const pool = require('../db');
const router = express.Router();

// Middleware para verificar token
const jwt = require('jsonwebtoken');
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

// Ruta protegida (admin)
router.get('/', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                p.id_producto,
                p.nombre,
                p.descripcion,
                p.precio,
                p.estado,
                c.nombre AS categoria,
                COALESCE(SUM(i.stock), 0) AS stock,
                i.ubicacion
            FROM producto p
            LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
            LEFT JOIN inventario i ON p.id_producto = i.id_producto
            GROUP BY p.id_producto, p.nombre, p.descripcion, p.precio,
                     p.estado, c.nombre, i.ubicacion
            ORDER BY p.fecha DESC
        `);
        res.json({ ok: true, products: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, message: 'Error al obtener productos' });
    }
});

// Ruta pública (index.html)
router.get('/public', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                p.id_producto,
                p.nombre,
                p.descripcion,
                p.precio,
                p.estado,
                c.nombre AS categoria,
                COALESCE(SUM(i.stock), 0) AS stock
            FROM producto p
            LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
            LEFT JOIN inventario i ON p.id_producto = i.id_producto
            WHERE p.estado = 'Activo'
            GROUP BY p.id_producto, p.nombre, p.descripcion,
                     p.precio, p.estado, c.nombre
            ORDER BY p.fecha DESC
        `);
        res.json({ ok: true, products: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, message: 'Error al obtener productos' });
    }
});


module.exports = router;