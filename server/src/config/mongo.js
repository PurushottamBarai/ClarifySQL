import mongoose from 'mongoose';
import dns from 'dns';

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[mongo] MONGODB_URI is not set in .env. Skipping MongoDB Atlas connection.');
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[mongo] Connected to MongoDB Atlas (${conn.connection.host})`);
    return true;
  } catch (err) {
    // If local Windows DNS fails to resolve SRV records (querySrv ECONNREFUSED)
    if (err.message && (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED'))) {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        const conn = await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 6000,
        });
        console.log(`[mongo] Connected to MongoDB Atlas via DNS fallback (${conn.connection.host})`);
        return true;
      } catch (retryErr) {
        console.error('[mongo] Connection error after DNS fallback:', retryErr.message);
        return false;
      }
    }

    console.error('[mongo] Connection error:', err.message);
    return false;
  }
}
