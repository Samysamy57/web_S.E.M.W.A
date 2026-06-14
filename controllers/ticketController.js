// Fichier : controllers/ticketController.js
import TicketModel from '../models/TicketModel.js';

const ticketController = {

  // GET /api/tickets
  async getMyTickets(req, res) {
    try {
      const tickets = await TicketModel.getUserTickets(req.user.id);
      res.json(tickets);
    } catch (err) {
      console.error('[getMyTickets]', err);
      res.status(500).json({ error: 'Server error.' });
    }
  },

  // PATCH /api/tickets/:id/cancel
  async cancelMyTicket(req, res) {
    try {
      const { id }     = req.params;
      const { reason } = req.body;

      const result = await TicketModel.cancelTicket(id, req.user.id, reason || null);
      if (!result) {
        return res.status(404).json({ error: 'Ticket not found or already cancelled.' });
      }

      res.json({ message: 'Ticket cancelled successfully.' });
    } catch (err) {
      console.error('[cancelMyTicket]', err);
      res.status(500).json({ error: 'Server error.' });
    }
  },
};

export default ticketController;