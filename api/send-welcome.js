// api/send-welcome.js
// POST /api/send-welcome
// Body: { email, username, admin_secret }

const { sendWelcome } = require('./_mailer');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://torneos-rescue.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, username, admin_secret } = req.body;

    // Verificar que viene de la propia app
    if (admin_secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!email || !username) {
      return res.status(400).json({ error: 'Email y username requeridos' });
    }

    await sendWelcome(email, username);
    return res.status(200).json({ sent: true });

  } catch (err) {
    console.error('send-welcome error:', err);
    // No exponer error al cliente
    return res.status(200).json({ sent: false });
  }
};
