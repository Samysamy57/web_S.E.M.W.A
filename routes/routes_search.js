import express from 'express';
import Event from '../models/eventModel.js';

const router = express.Router();
console.log('routes_search chargé');

// POST /api/search — Recherche principale des événements
router.post('/', async (req, res) => {
  try {
    const events = await Event.findEvent(req.body);
    res.json(events);
  } catch (err) {
    console.error('[POST /api/search]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/search/suggestions?keyword=xxx&city=xxx — Autocomplétion
router.get('/suggestions', async (req, res) => {
  try {
    const { keyword = '', city = '' } = req.query;
    const suggestions = await Event.getSearchSuggestions(keyword, city);
    res.json(suggestions);
  } catch (err) {
    console.error('[GET /api/search/suggestions]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;