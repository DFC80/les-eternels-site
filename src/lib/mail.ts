import nodemailer from "nodemailer";

const CLUB_NAME = "Les Éternels";

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function wrapHtml(title: string, bodyHtml: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e1e1e;">
      <h2 style="color: #2d2d2d;">${title}</h2>
      ${bodyHtml}
      <p style="margin-top: 32px; font-size: 12px; color: #888;">
        ${CLUB_NAME} — cet email est envoyé automatiquement, merci de ne pas y répondre.
      </p>
    </div>
  `;
}

export async function sendMail(to: string, subject: string, html: string) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`[mail] Configuration SMTP absente, email à ${to} non envoyé : "${subject}"`);
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await transporter.sendMail({ from, to, subject, html });
  } catch (err) {
    console.error(`[mail] Échec d'envoi à ${to} ("${subject}") :`, err);
  }
}

export async function sendNewEventRegistrationToAdmin(params: {
  memberName: string;
  memberEmail: string;
  eventTitle: string;
  startsAt: Date;
  location: string;
  wantsMeal: boolean;
  mealPrice: number;
  participationFee: number;
  equipment: { name: string; rentalCost: number }[];
}) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM;
  if (!adminEmail) return;

  const { memberName, memberEmail, eventTitle, startsAt, location, wantsMeal, mealPrice, participationFee, equipment } = params;

  const prestations: string[] = [];
  if (wantsMeal) prestations.push(`Repas — ${mealPrice}€`);
  if (participationFee > 0) prestations.push(`Participation invité — ${participationFee / 100}€`);
  for (const eq of equipment) {
    prestations.push(`Location ${eq.name} — ${eq.rentalCost}€`);
  }
  const prestationsHtml = prestations.length > 0
    ? `<ul style="margin:8px 0;padding-left:20px;">${prestations.map((p) => `<li>${p}</li>`).join("")}</ul>`
    : `<p style="color:#888;">Aucune prestation supplémentaire.</p>`;

  const html = wrapHtml(
    "Nouvelle inscription à un événement",
    `
      <p>Un membre vient de s'inscrire à un événement et attend votre validation.</p>
      <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #555;">Membre</td><td style="padding: 6px 12px;">${memberName} (${memberEmail})</td></tr>
        <tr style="background:#f9f9f9"><td style="padding: 6px 12px; font-weight: bold; color: #555;">Événement</td><td style="padding: 6px 12px;">${eventTitle}</td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #555;">Date</td><td style="padding: 6px 12px;">${startsAt.toLocaleString("fr-FR")}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding: 6px 12px; font-weight: bold; color: #555;">Lieu</td><td style="padding: 6px 12px;">${location}</td></tr>
      </table>
      <p style="margin-top: 16px; font-weight: bold; color: #555;">Prestations choisies :</p>
      ${prestationsHtml}
      <p style="margin-top: 16px;">Rendez-vous dans le panneau d'administration pour valider ou refuser cette inscription.</p>
    `
  );
  await sendMail(adminEmail, `Nouvelle inscription — ${memberName} à ${eventTitle}`, html);
}

export async function sendEventRegistrationApproved(params: {
  to: string;
  firstName: string;
  eventTitle: string;
  startsAt: Date;
  location: string;
  wantsMeal: boolean;
  mealPrice: number;
  participationFee: number;
  equipment: { name: string; rentalCost: number }[];
}) {
  const { to, firstName, eventTitle, startsAt, location, wantsMeal, mealPrice, participationFee, equipment } = params;

  const lignes: { label: string; valeur: string }[] = [];
  if (wantsMeal) lignes.push({ label: "Repas", valeur: `${mealPrice}€` });
  if (participationFee > 0) lignes.push({ label: "Participation invité", valeur: `${participationFee / 100}€` });
  for (const eq of equipment) {
    lignes.push({ label: `Location — ${eq.name}`, valeur: eq.rentalCost > 0 ? `${eq.rentalCost}€` : "Gratuit" });
  }
  const totalEuros =
    (wantsMeal ? mealPrice : 0) +
    participationFee / 100 +
    equipment.reduce((sum, eq) => sum + eq.rentalCost, 0);

  const detailHtml = lignes.length > 0
    ? `
      <p style="margin-top:20px;font-weight:bold;color:#555;">Détail de vos prestations :</p>
      <table style="border-collapse:collapse;width:100%;margin-top:8px;">
        ${lignes.map((l, i) => `
          <tr${i % 2 === 1 ? ' style="background:#f9f9f9"' : ""}>
            <td style="padding:6px 12px;font-weight:bold;color:#555;">${l.label}</td>
            <td style="padding:6px 12px;">${l.valeur}</td>
          </tr>`).join("")}
        <tr style="border-top:2px solid #ddd;">
          <td style="padding:8px 12px;font-weight:bold;color:#555;">Total à régler</td>
          <td style="padding:8px 12px;font-weight:bold;">${totalEuros}€</td>
        </tr>
      </table>
      <p style="font-size:12px;color:#888;margin-top:8px;">Le règlement s'effectue sur place le jour de l'événement.</p>`
    : "";

  const html = wrapHtml(
    "Inscription validée ✅",
    `
      <p>Bonjour ${firstName},</p>
      <p>Votre inscription à l'événement <strong>${eventTitle}</strong> a été <strong>validée</strong> par un administrateur.</p>
      <p>
        📅 ${startsAt.toLocaleString("fr-FR")}<br/>
        📍 ${location}
      </p>
      ${detailHtml}
      <p style="margin-top:20px;">À bientôt !</p>
    `
  );
  await sendMail(to, `Inscription validée — ${eventTitle}`, html);
}

export async function sendEventRegistrationRejected(params: {
  to: string;
  firstName: string;
  eventTitle: string;
}) {
  const { to, firstName, eventTitle } = params;
  const html = wrapHtml(
    "Inscription refusée",
    `
      <p>Bonjour ${firstName},</p>
      <p>Votre inscription à l'événement <strong>${eventTitle}</strong> a été <strong>refusée</strong> par un administrateur.</p>
      <p>Pour plus d'informations, n'hésitez pas à contacter l'association.</p>
    `
  );
  await sendMail(to, `Inscription refusée — ${eventTitle}`, html);
}

export async function sendEventRegistrationConfirmation(params: {
  to: string;
  firstName: string;
  eventTitle: string;
  startsAt: Date;
  location: string;
  wantsMeal: boolean;
  mealPrice: number;
  participationFee: number;
  equipment: { name: string; rentalCost: number }[];
}) {
  const { to, firstName, eventTitle, startsAt, location, wantsMeal, mealPrice, participationFee, equipment } = params;

  const lignes: { label: string; valeur: string }[] = [];
  if (wantsMeal) lignes.push({ label: "Repas", valeur: `${mealPrice}€` });
  if (participationFee > 0) lignes.push({ label: "Participation invité", valeur: `${participationFee / 100}€` });
  for (const eq of equipment) {
    lignes.push({ label: `Location — ${eq.name}`, valeur: `${eq.rentalCost}€` });
  }

  const totalEuros =
    (wantsMeal ? mealPrice : 0) +
    participationFee / 100 +
    equipment.reduce((sum, eq) => sum + eq.rentalCost, 0);

  const detailHtml = lignes.length > 0
    ? `
      <p style="margin-top:20px;font-weight:bold;color:#555;">Détail de votre inscription :</p>
      <table style="border-collapse:collapse;width:100%;margin-top:8px;">
        ${lignes.map((l, i) => `
          <tr${i % 2 === 1 ? ' style="background:#f9f9f9"' : ""}>
            <td style="padding:6px 12px;font-weight:bold;color:#555;">${l.label}</td>
            <td style="padding:6px 12px;">${l.valeur}</td>
          </tr>`).join("")}
        <tr style="border-top:2px solid #ddd;">
          <td style="padding:8px 12px;font-weight:bold;color:#555;">Total à régler</td>
          <td style="padding:8px 12px;font-weight:bold;">${totalEuros}€</td>
        </tr>
      </table>
      <p style="font-size:12px;color:#888;margin-top:8px;">Le règlement s'effectue sur place le jour de l'événement.</p>`
    : "";

  const html = wrapHtml(
    "Inscription reçue — en attente de validation ⏳",
    `
      <p>Bonjour ${firstName},</p>
      <p>Votre inscription à l'événement <strong>${eventTitle}</strong> a bien été reçue et est en attente de validation par un administrateur.</p>
      <p>
        📅 ${startsAt.toLocaleString("fr-FR")}<br/>
        📍 ${location}
      </p>
      ${detailHtml}
      <p style="margin-top:20px;">Vous recevrez un email dès que votre inscription aura été traitée.</p>
    `
  );
  await sendMail(to, `Inscription reçue — ${eventTitle}`, html);
}

export async function sendNewEventNotification(params: {
  to: string;
  firstName: string;
  eventTitle: string;
  description: string;
  startsAt: Date;
  location: string;
}) {
  const { to, firstName, eventTitle, description, startsAt, location } = params;
  const html = wrapHtml(
    "Nouvel événement 🎉",
    `
      <p>Bonjour ${firstName},</p>
      <p>Un nouvel événement vient d'être créé pour une activité à laquelle vous avez adhéré :</p>
      <p>
        <strong>${eventTitle}</strong><br/>
        📅 ${startsAt.toLocaleString("fr-FR")}<br/>
        📍 ${location}
      </p>
      <p>${description}</p>
      <p>Connectez-vous sur le site pour vous inscrire.</p>
    `
  );
  await sendMail(to, `Nouvel événement — ${eventTitle}`, html);
}

export async function sendNewMemberNotification(params: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM;
  if (!adminEmail) return;

  const { firstName, lastName, email } = params;
  const html = wrapHtml(
    "Nouvelle inscription membre",
    `
      <p>Un nouveau membre vient de créer un compte sur le site des Éternels.</p>
      <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #555;">Prénom</td><td style="padding: 6px 12px;">${firstName}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding: 6px 12px; font-weight: bold; color: #555;">Nom</td><td style="padding: 6px 12px;">${lastName}</td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #555;">Email</td><td style="padding: 6px 12px;">${email}</td></tr>
      </table>
      <p style="margin-top: 16px;">
        Son adhésion est en attente — il devra compléter son profil et choisir ses activités.<br/>
        Vous pouvez gérer les membres depuis le panneau d'administration.
      </p>
    `
  );
  await sendMail(adminEmail, `Nouvelle inscription — ${firstName} ${lastName}`, html);
}

export async function sendWelcomeEmail(params: { to: string; firstName: string; verificationLink: string }) {
  const { to, firstName, verificationLink } = params;
  const html = wrapHtml(
    "Confirmez votre inscription",
    `
      <p>Bonjour ${firstName},</p>
      <p>Votre demande d'inscription aux <strong>Éternels</strong> a bien été enregistrée.</p>
      <p>Pour activer votre compte, cliquez sur le bouton ci-dessous :</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${verificationLink}" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
          Confirmer mon inscription
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;">Ou copiez ce lien dans votre navigateur :<br>${verificationLink}</p>
      <p>Ce lien est valable 48 heures. Si vous n'avez pas créé de compte, ignorez cet email.</p>
    `
  );
  await sendMail(to, "Confirmez votre inscription — Les Éternels", html);
}

export async function sendAccountValidatedEmail(params: { to: string; firstName: string }) {
  const { to, firstName } = params;
  const html = wrapHtml(
    "Votre compte est activé ! 🎲",
    `
      <p>Bonjour ${firstName},</p>
      <p>Bonne nouvelle ! Votre compte membre sur le site des <strong>Éternels</strong> a été validé par un administrateur.</p>
      <p>Vous pouvez dès maintenant vous connecter et :</p>
      <ul>
        <li>Compléter votre profil (date de naissance, adresse, téléphone)</li>
        <li>Choisir vos activités et soumettre votre demande d'adhésion</li>
        <li>Vous inscrire aux événements de l'association</li>
      </ul>
      <p>À très bientôt sur le terrain ou autour d'une table !</p>
    `
  );
  await sendMail(to, "Compte activé — Les Éternels", html);
}

export async function sendMembershipRequestRecap(params: {
  to: string;
  firstName: string;
  year: number;
  activities: string[];
  amount: number;
}) {
  const { to, firstName, year, activities, amount } = params;
  const html = wrapHtml(
    "Récapitulatif de votre demande d'adhésion",
    `
      <p>Bonjour ${firstName},</p>
      <p>Votre demande d'adhésion pour l'année <strong>${year}</strong> a bien été enregistrée.</p>
      <p>
        Activités sélectionnées : <strong>${activities.join(", ")}</strong><br/>
        Montant à régler : <strong>${amount}€</strong>
      </p>
      <p>Votre adhésion sera activée dès validation du paiement par un administrateur.</p>
    `
  );
  await sendMail(to, "Récapitulatif de votre demande d'adhésion", html);
}

export async function sendMembershipPaymentConfirmation(params: {
  to: string;
  firstName: string;
  year: number;
  amount: number;
}) {
  const { to, firstName, year, amount } = params;
  const html = wrapHtml(
    "Paiement de cotisation confirmé ✅",
    `
      <p>Bonjour ${firstName},</p>
      <p>
        Le paiement de votre cotisation de <strong>${amount}€</strong> pour l'année
        <strong>${year}</strong> a bien été validé par un administrateur.
      </p>
      <p>Votre adhésion est désormais active. Bienvenue parmi nous !</p>
    `
  );
  await sendMail(to, "Paiement de cotisation confirmé", html);
}
