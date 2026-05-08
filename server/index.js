const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes     = require('./routes/auth');
const productRoutes  = require('./routes/products');  // nuevo
const clientRoutes   = require('./routes/clients');   // nuevo

const app = express();

app.use(cors({ origin: 'http://localhost:5500' }));
app.use(express.json());
app.use(express.static('../public'));

app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);  // nuevo
app.use('/api/clients',  clientRoutes);   // nuevo

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));