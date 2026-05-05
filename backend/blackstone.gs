/**
 * Blackstone Protective Service Ltd — Google Apps Script Backend
 * File: blackstone.gs
 *
 * PURPOSE:
 *   Receives form submissions from the Blackstone website (Careers & Booking).
 *   Validates the reCAPTCHA token, then emails the owner with formatted details.
 *
 * SETUP INSTRUCTIONS:
 * ─────────────────────────────────────────────────────────────
 * 1. Go to https://script.google.com/ and create a new project.
 * 2. Paste this entire file's contents into the editor.
 * 3. Set the CONFIG object variables below (owner email, reCAPTCHA secret).
 * 4. Click Deploy → New deployment → Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Deployment URL.
 * 6. Encode it for the website:
 *    In the browser console: btoa('YOUR_DEPLOYMENT_URL').split('').reverse().join('')
 *    Paste the result into _GAS_ENC in /js/forms.js
 *
 * ENCODING YOUR ENDPOINT (one-time setup):
 *   const url = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
 *   const encoded = btoa(url).split('').reverse().join('');
 *   // Paste `encoded` as _GAS_ENC in forms.js
 *
 * RECAPTCHA:
 *   1. Go to https://www.google.com/recaptcha/admin
 *   2. Register a new site (reCAPTCHA v2 "I'm not a robot", domain: blackstoneprotective.com)
 *   3. Copy the SECRET KEY → paste below as RECAPTCHA_SECRET
 *   4. Copy the SITE KEY → paste into careers.html and booking.html data-sitekey="..."
 * ─────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════
// CONFIGURATION — Edit these values
// ═══════════════════════════════════════════════════════════
const CONFIG = {
  OWNER_EMAIL:       'owner@blackstoneprotective.com', // <- Your email here
  RECAPTCHA_SECRET:  '6LdX480sAAAAALtZZX8wfpBNVSb7jetyi0jxR9ku',      // <- From Google reCAPTCHA admin
  COMPANY_NAME:      'Blackstone Protective Service Ltd',
  REPLY_TO:          'noreply@blackstoneprotective.com',
  ALLOW_ORIGINS:     ['https://blackstoneprotective.com'], // Add staging URLs if needed
};
// ═══════════════════════════════════════════════════════════

/**
 * doPost — entry point for form submissions (POST with JSON body).
 * The website sends with mode: 'no-cors', so the response is opaque.
 * We still validate and email regardless.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const type = body._type || 'unknown';

    // ── 1. Validate reCAPTCHA ──
    const captchaOk = verifyCaptcha(body._captcha);
    if (!captchaOk) {
      Logger.log('[Security] reCAPTCHA failed for submission: ' + JSON.stringify(body));
      return jsonResponse({ ok: false, error: 'captcha_failed' });
    }

    // ── 2. Basic sanity checks ──
    if (!body.email || !body.first_name) {
      return jsonResponse({ ok: false, error: 'missing_fields' });
    }

    // ── 3. Route to correct email handler ──
    if (type === 'careers') {
      sendCareersEmail(body);
    } else if (type === 'booking') {
      sendBookingEmail(body);
    } else {
      Logger.log('[Warning] Unknown submission type: ' + type);
    }

    // ── 4. Log to sheet (optional — creates a "Submissions" spreadsheet) ──
    logToSheet(body, type);

    return jsonResponse({ ok: true });

  } catch (err) {
    Logger.log('[Error] doPost: ' + err.toString());
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

/**
 * doGet — Health check endpoint.
 * Visit the deployment URL in browser to confirm it's live.
 */
function doGet(e) {
  return ContentService.createTextOutput(CONFIG.COMPANY_NAME + ' — GAS backend is live. ✓')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ───────────────────────────────────────────────────────────
// EMAIL HANDLERS
// ───────────────────────────────────────────────────────────

function sendCareersEmail(data) {
  const subject = `[Careers Application] ${data.position || 'Unknown Position'} — ${data.first_name} ${data.last_name}`;
  const body = `
NEW CAREERS APPLICATION
${'─'.repeat(60)}
Position Applied For : ${data.position || 'N/A'}
Full Name            : ${data.first_name} ${data.last_name}
Email Address        : ${data.email}
Phone Number         : ${data.phone}
Years of Experience  : ${data.experience || 'N/A'}

Cover Letter / Notes :
${data.message || '(none provided)'}

${'─'.repeat(60)}
Submission Timestamp : ${data._ts || new Date().toISOString()}
Source               : Blackstone Careers Form
${'─'.repeat(60)}

⚠️  Do not reply to this automated email. Contact the applicant directly at ${data.email}
`;
  sendMail(subject, body);
}

function sendBookingEmail(data) {
  const subject = `[Booking Enquiry] ${data.service || 'General'} — ${data.first_name} ${data.last_name}`;
  const body = `
NEW BOOKING ENQUIRY
${'─'.repeat(60)}
Name                 : ${data.first_name} ${data.last_name}
Organisation         : ${data.organisation || '(Not specified)'}
Email Address        : ${data.email}
Phone Number         : ${data.phone}
Service Required     : ${data.service || 'N/A'}
Urgency              : ${data.urgency || 'N/A'}
Deployment Location  : ${data.location || 'N/A'}
How They Found Us    : ${data.source || 'N/A'}

Security Requirement Details :
${data.message || '(none provided)'}

${'─'.repeat(60)}
Submission Timestamp : ${data._ts || new Date().toISOString()}
Source               : Blackstone Booking Form
${'─'.repeat(60)}

⚠️  Please respond within 4 business hours as promised on the website.
    Contact: ${data.email} | ${data.phone}
`;
  sendMail(subject, body);
}

function sendMail(subject, body) {
  GmailApp.sendEmail(
    CONFIG.OWNER_EMAIL,
    subject,
    body,
    {
      name: CONFIG.COMPANY_NAME + ' — Website',
      replyTo: CONFIG.REPLY_TO,
    }
  );
}

// ───────────────────────────────────────────────────────────
// RECAPTCHA VERIFICATION
// ───────────────────────────────────────────────────────────

function verifyCaptcha(token) {
  if (!token) return false;
  if (CONFIG.RECAPTCHA_SECRET === 'YOUR_RECAPTCHA_SECRET_KEY') {
    // Skip verification in dev mode — REMOVE this in production
    Logger.log('[Dev] reCAPTCHA secret not set — skipping verification');
    return true;
  }
  try {
    const response = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'post',
      payload: {
        secret: CONFIG.RECAPTCHA_SECRET,
        response: token,
      },
    });
    const result = JSON.parse(response.getContentText());
    Logger.log('[reCAPTCHA] result: ' + JSON.stringify(result));
    return result.success === true;
  } catch (e) {
    Logger.log('[reCAPTCHA Error] ' + e.toString());
    return false;
  }
}

// ───────────────────────────────────────────────────────────
// SPREADSHEET LOGGING (Optional)
// ───────────────────────────────────────────────────────────

function logToSheet(data, type) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return; // No spreadsheet bound — skip logging
    const sheetName = type === 'careers' ? 'Careers' : 'Bookings';
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      const headers = type === 'careers'
        ? ['Timestamp', 'Name', 'Email', 'Phone', 'Position', 'Experience', 'Notes']
        : ['Timestamp', 'Name', 'Organisation', 'Email', 'Phone', 'Service', 'Urgency', 'Location', 'Details'];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
    const row = type === 'careers'
      ? [data._ts, `${data.first_name} ${data.last_name}`, data.email, data.phone, data.position, data.experience, data.message]
      : [data._ts, `${data.first_name} ${data.last_name}`, data.organisation, data.email, data.phone, data.service, data.urgency, data.location, data.message];
    sheet.appendRow(row);
  } catch (e) {
    Logger.log('[Sheet log error] ' + e.toString());
  }
}

// ───────────────────────────────────────────────────────────
// UTILITIES
// ───────────────────────────────────────────────────────────

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
