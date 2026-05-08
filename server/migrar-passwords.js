const bcrypt = require('bcrypt');
const pool = require('./db');

async function migrarPasswords() {
    const [usuarios] = await pool.query('SELECT id_usuario, password FROM usuario');

    for (const user of usuarios) {
        // Si ya tiene bcrypt, lo saltamos
        if (user.password.startsWith('$2b$')) {
            console.log(`⏭️  Usuario ${user.id_usuario} ya tiene bcrypt, se omite.`);
            continue;
        }

        const hash = await bcrypt.hash(user.password, 10);
        await pool.query('UPDATE usuario SET password = ? WHERE id_usuario = ?', [hash, user.id_usuario]);
        console.log(`✅ Usuario ${user.id_usuario} migrado correctamente.`);
    }

    console.log('🎉 Migración completa.');
    process.exit(0);
}

migrarPasswords().catch(err => {
    console.error('❌ Error en migración:', err);
    process.exit(1);
});