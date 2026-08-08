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

const BLOCKED_EMAILS = ["admin@les-eternels.fr"];

export async function sendMail(to: string, subject: string, html: string) {
  if (BLOCKED_EMAILS.includes(to.toLowerCase().trim())) {
    console.warn(`[mail] Adresse bloquée, email à ${to} non envoyé : "${subject}"`);
    return;
  }

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
  equipment: { name: string; rentalCost: number; quantity: number }[];
}) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM;
  if (!adminEmail) return;

  const { memberName, memberEmail, eventTitle, startsAt, location, wantsMeal, mealPrice, participationFee, equipment } = params;

  const prestations: string[] = [];
  if (wantsMeal) prestations.push(`Repas — ${mealPrice}€`);
  if (participationFee > 0) prestations.push(`Participation invité — ${participationFee / 100}€`);
  for (const eq of equipment) {
    const qty = eq.quantity > 1 ? `${eq.quantity}× ` : "";
    prestations.push(`Location ${qty}${eq.name} — ${eq.rentalCost * eq.quantity}€`);
  }
  const prestationsHtml = prestations.length > 0
    ? `<ul style="margin:8px 0;padding-left:20px;">${prestations.map((p) => `<li>${p}</li>`).join("")}</ul>`
    : `<p style="color:#888;">Aucune prestation supplémentaire.</p>`;

  const html = wrapHtml(
    "Nouvelle inscription à un événement",
    `
      <p>Un membre vient de s'inscrire à un événement (inscription validée automatiquement).</p>
      <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #555;">Membre</td><td style="padding: 6px 12px;">${memberName} (${memberEmail})</td></tr>
        <tr style="background:#f9f9f9"><td style="padding: 6px 12px; font-weight: bold; color: #555;">Événement</td><td style="padding: 6px 12px;">${eventTitle}</td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold; color: #555;">Date</td><td style="padding: 6px 12px;">${startsAt.toLocaleString("fr-FR")}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding: 6px 12px; font-weight: bold; color: #555;">Lieu</td><td style="padding: 6px 12px;">${location}</td></tr>
      </table>
      <p style="margin-top: 16px; font-weight: bold; color: #555;">Prestations choisies :</p>
      ${prestationsHtml}
      <p style="margin-top: 16px;">Rendez-vous dans le panneau d'administration pour gérer cette inscription (locations d'équipement à valider le cas échéant).</p>
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
  equipment: { name: string; rentalCost: number; quantity: number }[];
}) {
  const { to, firstName, eventTitle, startsAt, location, wantsMeal, mealPrice, participationFee, equipment } = params;

  const lignes: { label: string; valeur: string }[] = [];
  if (wantsMeal) lignes.push({ label: "Repas", valeur: `${mealPrice}€` });
  if (participationFee > 0) lignes.push({ label: "Participation invité", valeur: `${participationFee / 100}€` });
  for (const eq of equipment) {
    const qty = eq.quantity > 1 ? `${eq.quantity}× ` : "";
    lignes.push({
      label: `Location — ${qty}${eq.name}`,
      valeur: eq.rentalCost > 0 ? `${eq.rentalCost * eq.quantity}€` : "Gratuit",
    });
  }
  const totalEuros =
    (wantsMeal ? mealPrice : 0) +
    participationFee / 100 +
    equipment.reduce((sum, eq) => sum + eq.rentalCost * eq.quantity, 0);

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
      <p style="font-size:12px;color:#888;margin-top:8px;">Le règlement s'effectue en ligne depuis la fiche de l'événement, ou sur place le jour de l'événement.</p>`
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
  equipment: { name: string; rentalCost: number; quantity: number }[];
}) {
  const { to, firstName, eventTitle, startsAt, location, wantsMeal, mealPrice, participationFee, equipment } = params;

  const lignes: { label: string; valeur: string }[] = [];
  if (wantsMeal) lignes.push({ label: "Repas", valeur: `${mealPrice}€` });
  if (participationFee > 0) lignes.push({ label: "Participation invité", valeur: `${participationFee / 100}€` });
  for (const eq of equipment) {
    const qty = eq.quantity > 1 ? `${eq.quantity}× ` : "";
    lignes.push({ label: `Location — ${qty}${eq.name}`, valeur: `${eq.rentalCost * eq.quantity}€` });
  }

  const totalEuros =
    (wantsMeal ? mealPrice : 0) +
    participationFee / 100 +
    equipment.reduce((sum, eq) => sum + eq.rentalCost * eq.quantity, 0);

  const hasRentals = equipment.length > 0;

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
      ${hasRentals
        ? `<p style="font-size:12px;color:#888;margin-top:8px;">Vos locations d'équipement sont soumises à validation par un administrateur. Le total définitif vous sera confirmé par email, après quoi vous pourrez payer en ligne depuis la fiche de l'événement, ou sur place le jour J.</p>`
        : `<p style="font-size:12px;color:#888;margin-top:8px;">Le règlement s'effectue en ligne depuis la fiche de l'événement, ou sur place le jour de l'événement.</p>`}`
    : "";

  const html = wrapHtml(
    "Inscription confirmée ✅",
    `
      <p>Bonjour ${firstName},</p>
      <p>Votre inscription à l'événement <strong>${eventTitle}</strong> est <strong>confirmée</strong>.</p>
      <p>
        📅 ${startsAt.toLocaleString("fr-FR")}<br/>
        📍 ${location}
      </p>
      ${detailHtml}
      <p style="margin-top:20px;">À bientôt !</p>
    `
  );
  await sendMail(to, `Inscription confirmée — ${eventTitle}`, html);
}

export async function sendEventFeesRecapEmail(params: {
  to: string;
  firstName: string;
  eventTitle: string;
  startsAt: Date;
  location: string;
  wantsMeal: boolean;
  mealPrice: number;
  participationFee: number;
  equipment: { name: string; rentalCost: number; quantity: number; isFree: boolean }[];
  eventUrl: string;
}) {
  const { to, firstName, eventTitle, startsAt, location, wantsMeal, mealPrice, participationFee, equipment, eventUrl } = params;

  const lignes: { label: string; valeur: string }[] = [];
  if (wantsMeal) lignes.push({ label: "Repas", valeur: `${mealPrice}€` });
  if (participationFee > 0) lignes.push({ label: "Participation invité", valeur: `${participationFee / 100}€` });
  for (const eq of equipment) {
    const qty = eq.quantity > 1 ? `${eq.quantity}× ` : "";
    lignes.push({
      label: `Location — ${qty}${eq.name}`,
      valeur: eq.isFree ? "Gratuit ✓" : `${eq.rentalCost * eq.quantity}€`,
    });
  }

  const totalEuros =
    (wantsMeal ? mealPrice : 0) +
    participationFee / 100 +
    equipment.reduce((sum, eq) => sum + (eq.isFree ? 0 : eq.rentalCost * eq.quantity), 0);

  const detailHtml = lignes.length > 0
    ? `
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
      </table>`
    : "";

  const paymentHtml =
    totalEuros > 0
      ? `
      <p style="margin-top:20px;">
        <a href="${eventUrl}" style="display:inline-block;background:#4f6df5;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">💳 Payer en ligne</a>
      </p>
      <p style="font-size:12px;color:#888;margin-top:8px;">Ouvrez la fiche de l'événement pour régler par carte bancaire, ou réglez sur place le jour de l'événement (espèces ou chèque).</p>`
      : `<p style="margin-top:16px;color:#2e7d32;font-weight:bold;">Aucun frais à régler pour cet événement. 🎉</p>`;

  const html = wrapHtml(
    "Vos locations sont validées — récapitulatif 📋",
    `
      <p>Bonjour ${firstName},</p>
      <p>Vos locations d'équipement pour l'événement <strong>${eventTitle}</strong> ont été traitées par un administrateur. Voici le récapitulatif de vos frais :</p>
      <p>
        📅 ${startsAt.toLocaleString("fr-FR")}<br/>
        📍 ${location}
      </p>
      ${detailHtml}
      ${paymentHtml}
      <p style="margin-top:20px;">À bientôt !</p>
    `
  );
  await sendMail(to, `Récapitulatif des frais — ${eventTitle}`, html);
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
        Votre paiement de <strong>${amount}€</strong> pour la cotisation
        <strong>${year}</strong> a bien été reçu et validé.
      </p>
      <p>Votre adhésion est désormais active. Bienvenue parmi nous !</p>
    `
  );
  await sendMail(to, "Paiement de cotisation confirmé ✅", html);
}

export async function sendBalanceTopUpConfirmation(params: {
  to: string;
  firstName: string;
  amountCents: number;
}) {
  const { to, firstName, amountCents } = params;
  const euros = (amountCents / 100).toFixed(2).replace(".", ",");
  const html = wrapHtml(
    "Recharge de solde confirmée ✅",
    `
      <p>Bonjour ${firstName},</p>
      <p>
        Votre recharge de <strong>${euros} €</strong> a bien été créditée sur votre
        solde comptoir.
      </p>
      <p>Vous pouvez dès à présent utiliser votre solde au comptoir lors de nos événements.</p>
    `
  );
  await sendMail(to, "Recharge de solde confirmée ✅", html);
}

export async function sendEventPaymentConfirmation(params: {
  to: string;
  firstName: string;
  eventTitle: string;
  amountCents: number;
}) {
  const { to, firstName, eventTitle, amountCents } = params;
  const euros = (amountCents / 100).toFixed(2).replace(".", ",");
  const html = wrapHtml(
    "Paiement événement confirmé ✅",
    `
      <p>Bonjour ${firstName},</p>
      <p>
        Votre paiement de <strong>${euros} €</strong> pour l'événement
        <strong>« ${eventTitle} »</strong> a bien été reçu.
      </p>
      <p>Votre inscription est désormais entièrement réglée. À bientôt !</p>
    `
  );
  await sendMail(to, `Paiement confirmé — ${eventTitle} ✅`, html);
}

type PollResultsParams = {
  question: string;
  activityLabel?: string;
  totalVotes: number;
  options: { label: string; voteCount: number }[];
  closedAt: Date;
  pollUrl: string;
};

function buildPollResultsHtml(params: PollResultsParams & { greeting?: string }): string {
  const { question, activityLabel, totalVotes, options, closedAt, pollUrl, greeting } = params;
  const sorted = [...options].sort((a, b) => b.voteCount - a.voteCount);
  const winner = sorted[0];
  const rows = sorted
    .map((o, i) => {
      const pct = totalVotes > 0 ? Math.round((o.voteCount / totalVotes) * 100) : 0;
      const isFirst = i === 0 && o.voteCount > 0;
      return `<tr${i % 2 === 1 ? ' style="background:#f9f9f9"' : ""}>
        <td style="padding:6px 12px;font-weight:${isFirst ? "bold" : "normal"};color:${isFirst ? "#4f46e5" : "#374151"};">
          ${isFirst ? "🏆 " : ""}${o.label}
        </td>
        <td style="padding:6px 12px;text-align:right;">${o.voteCount} vote${o.voteCount !== 1 ? "s" : ""}</td>
        <td style="padding:6px 12px;text-align:right;">${pct}%</td>
      </tr>`;
    })
    .join("");
  const scope = activityLabel ? `<p>Activité concernée : <strong>${activityLabel}</strong></p>` : "";
  const winnerText =
    totalVotes === 0
      ? `<p style="color:#888;">Aucun vote enregistré.</p>`
      : `<p>Résultat : <strong>${winner.label}</strong> arrive en tête avec ${winner.voteCount} vote${winner.voteCount !== 1 ? "s" : ""} (${Math.round((winner.voteCount / totalVotes) * 100)}%).</p>`;
  return wrapHtml(
    "Résultats du sondage 📊",
    `
      ${greeting ? `<p>${greeting}</p>` : ""}
      <p>Le sondage suivant vient de se clôturer le <strong>${closedAt.toLocaleString("fr-FR")}</strong> :</p>
      <blockquote style="border-left:4px solid #6366f1;margin:16px 0;padding:8px 16px;color:#374151;background:#f9fafb;">
        ${question}
      </blockquote>
      ${scope}
      ${winnerText}
      <p style="font-weight:bold;color:#555;margin-top:16px;">Détail des votes (${totalVotes} total) :</p>
      <table style="border-collapse:collapse;width:100%;margin-top:8px;">
        <thead>
          <tr style="background:#f1f5f9;color:#555;">
            <th style="padding:6px 12px;text-align:left;">Option</th>
            <th style="padding:6px 12px;text-align:right;">Votes</th>
            <th style="padding:6px 12px;text-align:right;">%</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:20px;">
        <a href="${pollUrl}" style="color:#6366f1;">Voir le sondage →</a>
      </p>
    `
  );
}

export async function sendPollResultsToAdmin(params: PollResultsParams) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM;
  if (!adminEmail) return;
  const html = buildPollResultsHtml(params);
  await sendMail(adminEmail, `Résultats du sondage — ${params.question.slice(0, 60)}`, html);
}

export async function sendPollResultsToVoters(
  params: PollResultsParams,
  voters: { email: string; firstName: string }[]
) {
  await Promise.allSettled(
    voters.map((v) => {
      const html = buildPollResultsHtml({ ...params, greeting: `Bonjour ${v.firstName},` });
      return sendMail(v.email, `Résultats du sondage — ${params.question.slice(0, 60)}`, html);
    })
  );
}

export async function sendNewPollNotification(params: {
  to: string;
  firstName: string;
  question: string;
  pollUrl: string;
  activityLabel?: string;
}) {
  const { to, firstName, question, pollUrl, activityLabel } = params;
  const scope = activityLabel
    ? `<p>Ce sondage concerne l'activité <strong>${activityLabel}</strong>.</p>`
    : "";
  const html = wrapHtml(
    "Nouveau sondage 🗳️",
    `
      <p>Bonjour ${firstName},</p>
      <p>Un nouveau sondage vient d'être publié sur le site des <strong>Éternels</strong> :</p>
      <blockquote style="border-left:4px solid #6366f1;margin:16px 0;padding:8px 16px;color:#374151;background:#f9fafb;">
        ${question}
      </blockquote>
      ${scope}
      <p style="text-align:center;margin:24px 0;">
        <a href="${pollUrl}" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
          Participer au sondage
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;">Ou copiez ce lien dans votre navigateur :<br>${pollUrl}</p>
    `
  );
  await sendMail(to, `Nouveau sondage — ${question.slice(0, 60)}`, html);
}

export async function sendCustomEmail(params: {
  to: string;
  firstName: string;
  subject: string;
  message: string;
  presidentPhone?: string | null;
}) {
  const { to, firstName, subject, message, presidentPhone } = params;
  const lines = message.split("\n").map((l) => `<p style="margin:4px 0;">${l || "&nbsp;"}</p>`).join("");
  const phoneHtml = presidentPhone
    ? `<p style="margin:4px 0;font-size:13px;color:#555;">📞 ${presidentPhone}</p>`
    : "";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e1e1e;">
      <h2 style="color: #2d2d2d;">${subject}</h2>
      <p>Bonjour ${firstName},</p>
      <div style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:4px solid #6366f1;">
        ${lines}
      </div>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-weight:600;color:#1e1e1e;">Association Les Éternels</p>
        ${phoneHtml}
      </div>
    </div>
  `;
  await sendMail(to, subject, html);
}

export async function sendAirsoftTrialDayUsedEmail(params: { to: string; firstName: string }) {
  const { to, firstName } = params;
  const html = wrapHtml(
    "🎯 Journée d'essai Airsoft utilisée",
    `
      <p>Bonjour ${firstName},</p>
      <p>Ta journée d'essai Airsoft aux <strong>Les Éternels</strong> a été consommée.</p>
      <p>Si tu as apprécié l'expérience et que tu souhaites continuer à participer aux sorties Airsoft, tu peux adhérer à l'activité via ta page d'adhésion.</p>
      <p>À très bientôt !</p>
    `
  );
  await sendMail(to, "Journée d'essai Airsoft utilisée — Les Éternels", html);
}

export async function sendAirsoftTrialDayEmail(params: { to: string; firstName: string }) {
  const { to, firstName } = params;
  const html = wrapHtml(
    "🎯 Journée d'essai Airsoft activée !",
    `
      <p>Bonjour ${firstName},</p>
      <p>Bonne nouvelle ! Un administrateur de <strong>Les Éternels</strong> t'a accordé une <strong>journée d'essai Airsoft</strong>.</p>
      <p>Cela te permet de :</p>
      <ul>
        <li>T'inscrire à la prochaine sortie Airsoft <strong>sans cotisation</strong></li>
        <li>Participer <strong>gratuitement</strong> (aucun frais de participation invité)</li>
      </ul>
      <p>Rends-toi sur le calendrier des événements pour t'inscrire à une sortie Airsoft dès maintenant !</p>
      <p>À très bientôt sur le terrain !</p>
    `
  );
  await sendMail(to, "Journée d'essai Airsoft activée — Les Éternels", html);
}

export async function sendBureauMeetingNotification(params: {
  recipients: { email: string; firstName: string }[];
  date: Date;
  location: string;
  agenda: string | null;
}) {
  const { recipients, date, location, agenda } = params;

  const dateStr = date.toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const agendaHtml = agenda
    ? `<p style="margin-top:16px;font-weight:bold;color:#555;">Ordre du jour :</p>
       <div style="margin:8px 0;padding:12px 16px;background:#f9fafb;border-left:4px solid #6366f1;white-space:pre-wrap;">${agenda}</div>`
    : "";

  await Promise.allSettled(
    recipients.map(({ email, firstName }) => {
      const html = wrapHtml(
        "📋 Réunion de bureau",
        `
          <p>Bonjour ${firstName},</p>
          <p>Une réunion de bureau est planifiée :</p>
          <table style="border-collapse:collapse;width:100%;margin-top:12px;">
            <tr>
              <td style="padding:6px 12px;font-weight:bold;color:#555;">Date</td>
              <td style="padding:6px 12px;">${dateStr}</td>
            </tr>
            ${location ? `<tr style="background:#f9f9f9"><td style="padding:6px 12px;font-weight:bold;color:#555;">Lieu</td><td style="padding:6px 12px;">${location}</td></tr>` : ""}
          </table>
          ${agendaHtml}
          <p style="margin-top:20px;">À bientôt !</p>
        `
      );
      return sendMail(
        email,
        `Réunion de bureau — ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
        html
      );
    })
  );
}

export async function sendPasswordResetEmail(params: { to: string; firstName: string; resetLink: string }) {
  const { to, firstName, resetLink } = params;
  const html = wrapHtml(
    "Réinitialisation de votre mot de passe",
    `
      <p>Bonjour ${firstName},</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe sur le site des <strong>Éternels</strong>.</p>
      <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${resetLink}" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;">Ou copiez ce lien dans votre navigateur :<br>${resetLink}</p>
      <p>Ce lien est valable <strong>1 heure</strong>. Si vous n'avez pas effectué cette demande, ignorez cet email — votre mot de passe restera inchangé.</p>
    `
  );
  await sendMail(to, "Réinitialisation de votre mot de passe — Les Éternels", html);
}
