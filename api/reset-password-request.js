// api/reset-password-request.js
// POST /api/reset-password-request
// Body: { email }

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { sendPasswordReset } = require('./_mailer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://torneos-rescue.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    // Buscar usuario en Supabase Auth
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    // Respuesta genérica aunque no exista (seguridad)
    if (!user) {
      return res.status(200).json({ message: 'Si el correo existe, recibirás un enlace.' });
    }

    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora

    // Guardar token en profiles
    await supabase.from('profiles').update({
      reset_token: token,
      reset_expires: expires
    }).eq('id', user.id);

    // Construir link de reset
    const resetLink = `https://torneos-rescue.vercel.app?reset_token=${token}`;
    const username = user.user_metadata?.display_name || email.split('@')[0];

    // Enviar email
    await sendPasswordReset(email, username, resetLink);

    return res.status(200).json({ message: 'Si el correo existe, recibirás un enlace.' });

  } catch (err) {
    console.error('reset-password-request error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
