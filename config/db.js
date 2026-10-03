const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGO_URI ||
      'mongodb://127.0.0.1:27017/rit_placement_db';

    mongoose.set(
      'strictQuery',
      true
    );

    const conn =
      await mongoose.connect(
        mongoURI
      );

    console.log(
      `MongoDB Connected Successfully: ${conn.connection.host}`
    );

    return conn;
  } catch (error) {
    console.error(
      `MongoDB Connection Failed: ${error.message}`
    );

    throw error;
  }
};

module.exports = connectDB;