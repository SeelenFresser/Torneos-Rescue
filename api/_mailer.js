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

const IMG_BUNNY = 'https://torneos-rescue.vercel.app/img/mad-bunny.png';
const IMG_LOGO  = 'https://torneos-rescue.vercel.app/img/logo.png';
const URL_APP   = 'https://torneos-rescue.vercel.app';
const URL_FB    = 'https://www.facebook.com/profile.php?id=61575222838811';

// ── TEMPLATE BASE ─────────────────────────────────────────
const baseHtml = (content, accentColor = '#E0176A') => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rescue TCG</title>
</head>
<body style="margin:0;padding:0;background:#0D0008;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:580px;margin:0 auto">

  <!-- HERO HEADER con Mad Bunny -->
  <div style="background:linear-gradient(160deg,#1A0010 0%,#2D0020 50%,#1A0010 100%);
    padding:32px 24px 0;text-align:center;position:relative;overflow:hidden">

    <!-- Glow de fondo -->
    <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);
      width:300px;height:200px;
      background:radial-gradient(ellipse,rgba(224,23,106,0.25) 0%,transparent 70%);
      pointer-events:none"></div>

    <!-- Mad Bunny -->
    <img src="${IMG_BUNNY}" alt="Mad Bunny"
      style="width:130px;height:auto;object-fit:contain;
      filter:drop-shadow(0 0 20px rgba(255,45,138,0.7));
      position:relative;z-index:1;display:block;margin:0 auto">

    <!-- Logo texto -->
    <div style="margin-top:8px;padding-bottom:24px;position:relative;z-index:1">
      <div style="font-size:26px;font-weight:900;color:#FF2D8A;
        letter-spacing:2px;text-transform:uppercase">RESCUE TCG</div>
      <div style="font-size:11px;color:#9060A0;letter-spacing:3px;
        text-transform:uppercase;margin-top:2px">TORNEOS · REYNOSA</div>
    </div>
  </div>

  <!-- LÍNEA DECORATIVA -->
  <div style="height:3px;background:linear-gradient(90deg,transparent,${accentColor},#9B30FF,${accentColor},transparent)"></div>

  <!-- CONTENIDO -->
  <div style="background:#1A0010;padding:28px 24px">
    ${content}
  </div>

  <!-- FOOTER -->
  <div style="background:#0D0008;padding:20px 24px;text-align:center;
    border-top:1px solid #2D0020">
    <img src="${IMG_LOGO}" alt="Rescue TCG" style="width:48px;height:auto;margin-bottom:10px;
      filter:drop-shadow(0 0 8px rgba(255,45,138,0.4))">
    <div style="font-size:11px;color:#4A2040;line-height:1.8">
      <a href="${URL_APP}" style="color:#6A3060;text-decoration:none">torneos-rescue.vercel.app</a>
      &nbsp;·&nbsp;
      <a href="${URL_FB}" style="color:#6A3060;text-decoration:none">Facebook</a>
    </div>
    <div style="font-size:10px;color:#3A1030;margin-top:6px">
      Recibes este correo porque tienes una cuenta en Rescue TCG Torneos.
    </div>
  </div>

</div>
</body></html>`;

// ── HELPERS DE DISEÑO ─────────────────────────────────────
const heading = (text) =>
  `<h2 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 14px;line-height:1.3">${text}</h2>`;

const body = (text) =>
  `<p style="color:#C0A0B0;font-size:15px;line-height:1.75;margin:0 0 16px">${text}</p>`;

const ctaButton = (url, label, color = '#E0176A') =>
  `<div style="text-align:center;margin:24px 0">
    <a href="${url}" style="display:inline-block;background:${color};color:#fff;
      text-decoration:none;padding:14px 36px;border-radius:30px;
      font-weight:800;font-size:15px;letter-spacing:0.5px;
      box-shadow:0 4px 20px rgba(224,23,106,0.4)">
      ${label}
    </a>
  </div>`;

const infoCard = (items, borderColor = '#E0176A') =>
  `<div style="background:#220016;border:1px solid ${borderColor};border-radius:12px;
    padding:16px 20px;margin:16px 0">
    ${items.map(([icon, text]) =>
      `<div style="display:flex;align-items:flex-start;gap:10px;padding:6px 0;
        border-bottom:1px solid #2D0020">
        <span style="font-size:16px;flex-shrink:0;margin-top:1px">${icon}</span>
        <span style="color:#C0A0B0;font-size:14px;line-height:1.5">${text}</span>
      </div>`
    ).join('')}
  </div>`;

const divider = () =>
  `<div style="height:1px;background:linear-gradient(90deg,transparent,#4A0030,transparent);margin:20px 0"></div>`;

// ── EMAIL DE BIENVENIDA ───────────────────────────────────
async function sendWelcome(email, username) {
  try {
    const content = `
      ${heading(`¡Bienvenido/a, <span style="color:#FF2D8A">${username}</span>! 🎉`)}
      ${body('Tu cuenta ha sido creada exitosamente. Ya eres parte de la comunidad de Rescue TCG — ¡prepárate para competir!')}
      ${infoCard([
        ['🧙', '<strong style="color:#fff">Commander · cEDH</strong> — Torneos de Commander en múltiples formatos'],
        ['🃏', '<strong style="color:#fff">Standard MTG</strong> — Torneos con Side Deck y rondas Bo3'],
        ['🌀', '<strong style="color:#fff">Beyblade X</strong> — Sistema de puntos oficial (Spin, Burst, Xtreme...)'],
        ['🏅', '<strong style="color:#fff">Ligas semanales</strong> — Round robin con playoff tipo Champions'],
        ['🏆', '<strong style="color:#fff">Hall of Fame</strong> — Tu nombre en la historia de la tienda'],
      ])}
      ${ctaButton(URL_APP, 'Ver torneos disponibles →')}
      ${divider()}
      <p style="color:#6A4060;font-size:12px;text-align:center;margin:0">
        📍 Rescue TCG Reynosa, Tamaulipas
      </p>`;

    await transporter.sendMail({
      from: `"Rescue TCG Reynosa" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '¡Bienvenido/a a Rescue TCG Torneos! 🐰',
      html: baseHtml(content, '#FF2D8A'),
    });
    console.log(`Welcome sent to ${email}`);
  } catch (err) {
    console.error(`Welcome failed ${email}:`, err.message);
  }
}

// ── EMAIL DE RECUPERACIÓN DE CONTRASEÑA ──────────────────
async function sendPasswordReset(email, username, resetLink) {
  try {
    const content = `
      ${heading('Recuperar contraseña')}
      ${body(`Hola <strong style="color:#fff">${username}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta de Rescue TCG Torneos.`)}
      <div style="background:#2D0008;border:1px solid #E0176A;border-radius:12px;
        padding:20px;margin:20px 0;text-align:center">
        <div style="font-size:13px;color:#E0176A;font-weight:700;text-transform:uppercase;
          letter-spacing:1px;margin-bottom:4px">⏰ Expira en 1 hora</div>
        <div style="font-size:12px;color:#8060A0;margin-bottom:16px">
          Si no solicitaste este cambio, ignora este mensaje.
        </div>
        ${ctaButton(resetLink, '🔐 Restablecer contraseña', '#E0176A')}
      </div>
      ${divider()}
      <p style="color:#6A4060;font-size:12px;text-align:center;margin:0;word-break:break-all">
        Si el botón no funciona, copia este enlace:<br>
        <a href="${resetLink}" style="color:#9B30FF">${resetLink}</a>
      </p>`;

    await transporter.sendMail({
      from: `"Rescue TCG Reynosa" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '🔐 Restablecer contraseña — Rescue TCG',
      html: baseHtml(content, '#9B30FF'),
    });
    console.log(`Reset sent to ${email}`);
  } catch (err) {
    console.error(`Reset failed ${email}:`, err.message);
    throw err;
  }
}

// ── EMAIL DE ANUNCIO ──────────────────────────────────────
async function sendAnnouncement(emails, subject, message, tournamentData = null) {
  const tournamentBlock = tournamentData ? `
    ${divider()}
    <div style="background:#220016;border:1px solid #E0176A;border-radius:12px;padding:18px 20px;margin:16px 0">
      <div style="font-size:10px;color:#E0176A;font-weight:700;text-transform:uppercase;
        letter-spacing:2px;margin-bottom:8px">📅 Torneo</div>
      <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:4px">${tournamentData.name}</div>
      ${tournamentData.type ? `<div style="font-size:13px;color:#9060A0;margin-bottom:6px">${tournamentData.type}</div>` : ''}
      ${tournamentData.date ? `<div style="font-size:14px;color:#F5D060;font-weight:600">📅 ${tournamentData.date}</div>` : ''}
    </div>` : '';

  const content = `
    ${heading(subject)}
    <div style="color:#C0A0B0;font-size:15px;line-height:1.75;white-space:pre-wrap">${message}</div>
    ${tournamentBlock}
    ${ctaButton(URL_APP, 'Ver torneos →')}`;

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
      console.error(`Failed ${email}:`, err.message);
      errors.push(`${email}: ${err.message}`);
    }
  }

  return { sent, total: emails.length, errors };
}

module.exports = { sendWelcome, sendPasswordReset, sendAnnouncement };
