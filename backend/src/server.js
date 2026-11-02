require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.use(async (req, _res, next) => {
  if (req.path === '/' || req.path === '/health') return next();
  try {
    await connectDB();
    return next();
  } catch (error) {
    return next(error);
  }
});

const liveness = (_req, res) => res.json({ status: 'ok', app: 'Tasxity' });
app.get('/', liveness);
app.get('/health', liveness);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'Tasxity', database: 'connected' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/focus', require('./routes/focus'));

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
  res.status(status).json({ message: err.message || 'Server error' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  connectDB()
    .then(() => app.listen(PORT, () => console.log(`Tasxity API on :${PORT}`)))
    .catch((error) => {
      console.error('MongoDB connection failed:', error.message);
      process.exitCode = 1;
    });
}

module.exports = app;
