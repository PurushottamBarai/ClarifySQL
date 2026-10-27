import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ClarifySQL Backend',
    timestamp: new Date().toISOString()
  });
});

export default router;
