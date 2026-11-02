const mongoose = require('mongoose');

let connectionPromise;

module.exports = async function connectDB() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured');
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise || mongoose.connection.readyState === 0) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI)
      .then(() => {
        console.log('MongoDB connected');
        return mongoose.connection;
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }
  return connectionPromise;
};
