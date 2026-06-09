// api/send-announcement.js
// POST /api/send-announcement
// Body: { admin_secret, subject, message, emails, tournament_data? }

const { sendAnnouncement } = require('./_mailer');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://torneos-rescue.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { admin_secret, subject, message, emails, tournament_data } = req.body;

    if (admin_secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!subject || !message) {
      return res.status(400).json({ error: 'Asunto y mensaje requeridos' });
    }

    const emailList = Array.isArray(emails) ? emails.filter(Boolean) : [];
    if (!emailList.length) {
      return res.status(400).json({ error: 'Sin destinatarios' });
    }

    const result = await sendAnnouncement(emailList, subject, message, tournament_data);
    return res.status(200).json(result);

  } catch (err) {
    console.error('send-announcement error:', err);
    return res.status(500).json({ error: err.message });
  }
};
