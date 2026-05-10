
import express from 'express';
import Event from '../models/eventModel.js';


const router = express.Router();
console.log('routes_search chargé');

// user connecté
router.post('/', async (req, res) => {
    console.log('eventis')
  try {
    
    const Events=await Event.findEvent(req.body)
    console.log('reopnse')
    res.json(Events);
  } catch (err) {
    console.error('[GET /]', err);
    res.status(500).json({ error: 'Server error' });
  }
});


export default router;