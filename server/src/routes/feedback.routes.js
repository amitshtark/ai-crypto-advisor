import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/feedback
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { section, itemId, vote, metadata } = req.body;
    const userId = req.user.id;

    if (!section || !vote) {
      return res.status(400).json({ error: 'Section and vote are required' });
    }

    if (vote !== 'up' && vote !== 'down') {
      return res.status(400).json({ error: 'Vote must be "up" or "down"' });
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        section,
        itemId: itemId || null,
        vote,
        metadata: JSON.stringify(metadata),
      },
    });

    res.status(201).json({ success: true, feedback });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

export default router;
