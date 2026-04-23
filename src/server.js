require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { initDb, pool } = require('./db');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors({ origin: ['http://localhost:3000', 'http://frontend:80', '*'] }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/orders', orderRoutes);

// Health Probes
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'order-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', db: 'disconnected' });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start Server
const startServer = async () => {
  await initDb();
  const server = app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      pool.end(() => {
        console.log('Database connections closed');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer();
