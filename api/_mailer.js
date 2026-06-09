// =============================================
// MAILER — Rescue Torneos
// Gmail SMTP via Nodemailer
// =============================================
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ── ESTILOS BASE ──────────────────────────────────────────
const baseHtml = (content) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1A0010;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:40px;margin-bottom:6px">🐰</div>
    <div style="font-size:24px;font-weight:900;color:#FF2D8A;letter-spacing:-0.5px">RESCUE TCG</div>
    <div style="font-size:12px;color:#8060A0;margin-top:2px">Torneos · Reynosa, Tamaulipas</div>
  </div>

  <!-- Card -->
  <div style="background:#220016;border:1px solid #4A0030;border-radius:16px;overflow:hidden">
    <div style="height:4px;background:linear-gradient(90deg,#E0176A,#FF2D8A,#9B30FF)"></div>
    <div style="padding:28px 24px">
      ${content}
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align:center;margin-top:24px;font-size:11px;color:#4A2040;line-height:1.6">
    Rescue TCG Reynosa ·
    <a href="https://torneos-rescue.vercel.app" style="color:#4A2040;text-decoration:none">torneos-rescue.vercel.app</a> ·
    <a href="https://www.facebook.com/profile.php?id=61575222838811" style="color:#4A2040;text-decoration:none">Facebook</a><br>
    Recibes este correo porque tienes una cuenta en nuestra plataforma de torneos.
  </div>
</div>
</body></html>`;

// ── EMAIL DE BIENVENIDA ───────────────────────────────────
async function sendWelcome(email, username) {
  try {
    const content = `
      <h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">
        ¡Bienvenido/a, ${username}! 🎉
      </h2>
      <p style="color:#D0B0C0;font-size:15px;line-height:1.7;margin:0 0 16px">
        Tu cuenta en <strong style="color:#FF2D8A">Rescue TCG Torneos</strong> ha sido creada exitosamente.
        Ya puedes inscribirte en torneos, ver tu historial y competir con otros jugadores.
      </p>
      <div style="background:#2D0020;border-radius:10px;padding:16px;margin:16px 0">
        <div style="color:#E0176A;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">¿Qué puedes hacer?</div>
        <div style="color:#C0A0B0;font-size:14px;line-height:1.8">
          🧙 Torneos Commander · cEDH<br>
          🃏 Torneos Standard MTG<br>
          🌀 Torneos Beyblade X<br>
          🏅 Ligas semanales<br>
          🏆 Hall of Fame
        </div>
      </div>
      <div style="text-align:center;margin-top:20px">
        <a href="https://torneos-rescue.vercel.app"
          style="display:inline-block;background:#E0176A;color:#fff;text-decoration:none;
          padding:14px 32px;border-radius:24px;font-weight:700;font-size:15px">
          Ir a la plataforma →
        </a>
      </div>`;

    await transporter.sendMail({
      from: `"Rescue TCG Reynosa" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '🐰 ¡Bienvenido/a a Rescue TCG Torneos!',
      html: baseHtml(content),
    });
    console.log(`Welcome email sent to ${email}`);
  } catch (err) {
    // Silencioso — no bloquea el registro
    console.error(`Failed to send welcome to ${email}:`, err.message);
  }
}

// ── EMAIL DE RECUPERACIÓN DE CONTRASEÑA ──────────────────
async function sendPasswordReset(email, username, resetLink) {
  try {
    const content = `
      <h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">
        Recuperar contraseña
      </h2>
      <p style="color:#D0B0C0;font-size:15px;line-height:1.7;margin:0 0 16px">
        Hola <strong style="color:#fff">${username}</strong>, recibimos una solicitud para restablecer
        la contraseña de tu cuenta. Si no fuiste tú, ignora este mensaje.
      </p>
      <div style="background:#2D0020;border:1px solid #E0176A;border-radius:10px;padding:16px;margin:16px 0;text-align:center">
        <div style="color:#E0176A;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
          ⏰ Este enlace expira en 1 hora
        </div>
        <a href="${resetLink}"
          style="display:inline-block;background:#E0176A;color:#fff;text-decoration:none;
          padding:14px 32px;border-radius:24px;font-weight:700;font-size:15px;margin-top:6px">
          Restablecer contraseña
        </a>
      </div>
      <p style="color:#6A4060;font-size:12px;line-height:1.6;margin-top:16px">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
        <span style="color:#9B30FF;word-break:break-all">${resetLink}</span>
      </p>`;

    await transporter.sendMail({
      from: `"Rescue TCG Reynosa" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '🔐 Restablecer contraseña — Rescue TCG',
      html: baseHtml(content),
    });
    console.log(`Password reset email sent to ${email}`);
  } catch (err) {
    console.error(`Failed to send reset to ${email}:`, err.message);
    throw err; // Este sí propaga el error (el usuario necesita saber)
  }
}

// ── EMAIL DE ANUNCIO (Admin → todos) ─────────────────────
async function sendAnnouncement(emails, subject, message, tournamentData = null) {
  const tournamentBlock = tournamentData ? `
    <div style="background:#2D0020;border:1px solid #E0176A;border-radius:10px;padding:16px;margin:20px 0">
      <div style="font-size:11px;color:#E0176A;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">📅 Torneo</div>
      <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:4px">${tournamentData.name}</div>
      <div style="color:#C0A0B0;font-size:14px">${tournamentData.type}</div>
      ${tournamentData.date ? `<div style="color:#F5D060;margin-top:6px">📅 ${tournamentData.date}</div>` : ''}
    </div>` : '';

  const content = `
    <h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">${subject}</h2>
    <div style="color:#D0B0C0;font-size:15px;line-height:1.7;white-space:pre-wrap">${message}</div>
    ${tournamentBlock}
    <div style="text-align:center;margin-top:20px">
      <a href="https://torneos-rescue.vercel.app"
        style="display:inline-block;background:#E0176A;color:#fff;text-decoration:none;
        padding:14px 32px;border-radius:24px;font-weight:700;font-size:15px">
        Ver torneos →
      </a>
    </div>`;

  const html = baseHtml(content);
  let sent = 0;
  const errors = [];

  for (const email of emails) {
    try {
      await transporter.sendMail({
        from: `"Rescue TCG Reynosa" <${process.env.GMAIL_USER}>`,
        to: email,
        subject,
        html,
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send to ${email}:`, err.message);
      errors.push(`${email}: ${err.message}`);
    }
  }

  return { sent, total: emails.length, errors };
}

module.exports = { sendWelcome, sendPasswordReset, sendAnnouncement };
