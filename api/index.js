import app from '../server/src/index.js';
import { connectMongo } from '../server/src/config/mongo.js';

export default async function handler(req, res) {
  await connectMongo();
  return app(req, res);
}

