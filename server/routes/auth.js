const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

const router = express.Router();

router.post('/login', async (req, res) => {

    try {

        const { email, password } = req.body;

        // Buscar usuario
        const [rows] = await pool.query(
            'SELECT * FROM usuario WHERE email = ?',
            [email]
        );

        // Verificar existencia
        if (rows.length === 0) {
            return res.status(401).json({
                ok: false,
                message: 'Usuario no encontrado'
            });
        }

        const user = rows[0];

        // Verificar estado
        if (user.estado !== 'Activo') {
            return res.status(403).json({
                ok: false,
                message: 'Usuario inactivo'
            });
        }

        // Verificar contraseña
        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                ok: false,
                message: 'Contraseña incorrecta'
            });
        }

        // Crear token
        const token = jwt.sign(
            {
                id_usuario: user.id_usuario,
                rol: user.rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '8h'
            }
        );

        // Respuesta
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

        console.error(error);

        return res.status(500).json({
            ok: false,
            message: 'Error interno del servidor'
        });

    }

});

module.exports = router;