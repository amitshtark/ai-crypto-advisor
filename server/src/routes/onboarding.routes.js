import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/onboarding
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { assets, investorType, contentTypes } = req.body;
    const userId = req.user.id;

    if (!assets || !investorType || !contentTypes) {
      return res.status(400).json({ error: 'assets, investorType, and contentTypes are required' });
    }

    if (!Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ error: 'Please select at least one asset' });
    }

    if (!Array.isArray(contentTypes) || contentTypes.length === 0) {
      return res.status(400).json({ error: 'Please select at least one content type' });
    }

    // Upsert preferences
    await prisma.preference.upsert({
      where: { userId },
      update: { assets: JSON.stringify(assets), investorType, contentTypes: JSON.stringify(contentTypes) },
      create: { userId, assets: JSON.stringify(assets), investorType, contentTypes: JSON.stringify(contentTypes) },
    });

    // Mark user as onboarded
    await prisma.user.update({
      where: { id: userId },
      data: { hasOnboarded: true },
    });

    res.json({ success: true, message: 'Onboarding complete!' });
  } catch (err) {
    console.error('Onboarding error:', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// GET /api/onboarding/preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const pref = await prisma.preference.findUnique({
      where: { userId: req.user.id },
    });
    if (pref) {
      pref.assets = JSON.parse(pref.assets);
      pref.contentTypes = JSON.parse(pref.contentTypes);
    }

    res.json(pref || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PUT /api/onboarding/preferences/assets
router.put('/preferences/assets', authenticateToken, async (req, res) => {
  try {
    const { assets } = req.body;
    
    if (!Array.isArray(assets)) {
      return res.status(400).json({ error: 'Assets must be an array' });
    }

    const updated = await prisma.preference.update({
      where: { userId: req.user.id },
      data: { assets: JSON.stringify(assets) },
    });

    updated.assets = JSON.parse(updated.assets);
    updated.contentTypes = JSON.parse(updated.contentTypes);

    res.json({ success: true, preferences: updated });
  } catch (err) {
    console.error('Update assets error:', err);
    res.status(500).json({ error: 'Failed to update assets' });
  }
});

export default router;
