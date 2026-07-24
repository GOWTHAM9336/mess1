const mongoose = require("mongoose");

// Reuses the existing connection on serverless "warm" invocations (Vercel etc.)
// instead of opening a new one on every request.
let connectionPromise = null;

function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve();
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB_NAME || "gowtham_mess"
      })
      .then(() => {
        console.log("MongoDB connected:", mongoose.connection.name);
      })
      .catch((err) => {
        connectionPromise = null;
        console.error("MongoDB connection error:", err);
        throw err;
      });
  }

  return connectionPromise;
}

module.exports = connectDB;
