import dotenv from "dotenv";
dotenv.config();

const config = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "90d",
  NODE_ENV: process.env.NODE_ENV || "development",
};

// Debug: Check if JWT_SECRET is loaded
console.log('🔐 JWT_SECRET loaded:', config.JWT_SECRET ? 'YES' : 'NO');
if (!config.JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set in environment variables!');
}

export default config; 