// api/reset-password-confirm.js
// POST /api/reset-password-confirm
// Body: { token, new_password }

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://torneos-rescue.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ error: 'Token y contraseña requeridos' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Buscar token en profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, reset_token, reset_expires')
      .eq('reset_token', token)
      .single();

    if (!profile) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    // Verificar expiración
    if (new Date(profile.reset_expires) < new Date()) {
      return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
    }

    // Actualizar contraseña en Supabase Auth
    const { error } = await supabase.auth.admin.updateUserById(profile.id, {
      password: new_password
    });

    if (error) {
      return res.status(500).json({ error: 'Error actualizando contraseña' });
    }

    // Limpiar token
    await supabase.from('profiles').update({
      reset_token: null,
      reset_expires: null
    }).eq('id', profile.id);

    return res.status(200).json({ message: 'Contraseña actualizada correctamente' });

  } catch (err) {
    console.error('reset-password-confirm error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
