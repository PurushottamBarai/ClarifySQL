import { sendContactEmail } from '../services/email.service.js';

export async function submitContact(req, res, next) {
  try {
    const { name, email, message } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message cannot exceed 5,000 characters' });
    }

    const emailSent = await sendContactEmail({
      name: name.trim().slice(0, 100),
      email: email.trim().toLowerCase(),
      message: message.trim()
    });

    if (!emailSent.success) {
      return res.status(500).json({ error: 'Could not deliver email at this time. Please try emailing directly.' });
    }

    return res.status(200).json({
      message: 'Thank you! Your message has been sent successfully.'
    });
  } catch (error) {
    next(error);
  }
}

