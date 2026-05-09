const express = require('express');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const router = express.Router();

// ── Middleware auth ──────────────────────────────────────────
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

// ── GET / — listar todos (admin) ─────────────────────────────
router.get('/', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                p.id_producto,
                p.nombre,
                p.descripcion,
                p.precio,
                p.costo,
                p.estado,
                p.id_categoria,
                c.nombre AS categoria,
                COALESCE(SUM(i.stock), 0) AS stock,
                MAX(i.ubicacion) AS ubicacion
            FROM producto p
            LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
            LEFT JOIN inventario i ON p.id_producto = i.id_producto
            GROUP BY p.id_producto, p.nombre, p.descripcion, p.precio,
                     p.costo, p.estado, p.id_categoria, c.nombre
            ORDER BY p.fecha DESC
        `);
        res.json({ ok: true, products: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, message: 'Error al obtener productos' });
    }
});

// ── GET /public — listar activos (index.html) ────────────────
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

// ── GET /categorias — para el select del modal ───────────────
router.get('/categorias', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id_categoria, nombre FROM categoria ORDER BY nombre');
        res.json({ ok: true, categorias: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, message: 'Error al obtener categorías' });
    }
});

// ── POST / — crear producto ──────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
    const { nombre, descripcion, id_categoria, precio, costo, estado, stock, ubicacion } = req.body;

    if (!nombre || !id_categoria || !precio) {
        return res.status(400).json({ ok: false, message: 'Nombre, categoría y precio son obligatorios' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Calcular margen
        const margen = costo ? (precio - costo).toFixed(2) : 0;

        // Insertar producto
        const [result] = await conn.query(
            `INSERT INTO producto (nombre, descripcion, id_categoria, precio, costo, margen, estado, fecha)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [nombre, descripcion || '', id_categoria, precio, costo || 0, margen, estado || 'Activo']
        );

        const id_producto = result.insertId;

        // Insertar inventario si se proporcionó stock
        if (stock !== undefined) {
            await conn.query(
                `INSERT INTO inventario (id_producto, stock, ubicacion, fecha, estado)
                 VALUES (?, ?, ?, NOW(), 'Activo')`,
                [id_producto, stock || 0, ubicacion || 'Principal']
            );
        }

        await conn.commit();
        res.json({ ok: true, message: 'Producto creado', id_producto });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ ok: false, message: 'Error al crear producto' });
    } finally {
        conn.release();
    }
});

// ── PUT /:id — actualizar producto ───────────────────────────
router.put('/:id', verifyToken, async (req, res) => {
    
    const { id } = req.params;
    const { nombre, descripcion, id_categoria, precio, costo, estado, stock, ubicacion } = req.body;
    
    if (!nombre || !id_categoria || !precio) {
        return res.status(400).json({ ok: false, message: 'Nombre, categoría y precio son obligatorios' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const margen = costo ? (precio - costo).toFixed(2) : 0;
        console.log({ precio, costo, margen, tipos: typeof precio, typeof costo });
        // Actualizar producto
        await conn.query(
            `UPDATE producto 
             SET nombre=?, descripcion=?, id_categoria=?, precio=?, costo=?, margen=?, estado=?
             WHERE id_producto=?`,
            [nombre, descripcion || '', id_categoria, precio, costo || 0, margen, estado || 'Activo', id]
        );

        // Actualizar o insertar inventario
        if (stock !== undefined) {
            const [existing] = await conn.query(
                'SELECT id_inventario FROM inventario WHERE id_producto = ?', [id]
            );
            if (existing.length) {
                await conn.query(
                    'UPDATE inventario SET stock=?, ubicacion=? WHERE id_producto=?',
                    [stock, ubicacion || 'Principal', id]
                );
            } else {
                await conn.query(
                    `INSERT INTO inventario (id_producto, stock, ubicacion, fecha, estado)
                     VALUES (?, ?, ?, NOW(), 'Activo')`,
                    [id, stock, ubicacion || 'Principal']
                );
            }
        }

        await conn.commit();
        res.json({ ok: true, message: 'Producto actualizado' });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ ok: false, message: 'Error al actualizar producto' });
    } finally {
        conn.release();
    }
});

// ── DELETE /:id — eliminar producto ─────────────────────────
router.delete('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // Eliminar inventario primero (FK)
        await conn.query('DELETE FROM inventario WHERE id_producto = ?', [id]);
        // Eliminar producto
        await conn.query('DELETE FROM producto WHERE id_producto = ?', [id]);
        await conn.commit();
        res.json({ ok: true, message: 'Producto eliminado' });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ ok: false, message: 'Error al eliminar producto' });
    } finally {
        conn.release();
    }
});

module.exports = router;