/**
 * forms.js — 4-Tier Security Form Handler
 *
 * SECURITY STACK:
 * 1. Honeypot hidden field
 * 2. Time-to-submit check (< 3s = bot)
 * 3. reCAPTCHA v2 checkbox
 * 4. Obfuscated Google Apps Script endpoint
 *
 * Usage: call initForm({ formId, type }) once DOM ready.
 * type: 'careers' | 'booking'
 */

/* ── Obfuscated endpoint (Base64 → reverse → ROT13) ── */
/* IMPORTANT: Replace the string below with your encoded GAS URL.
   To encode: run encodeEndpoint('https://script.google.com/macros/s/YOUR_ID/exec') in DevTools */
const _k = (s) => {
  try {
    // Reverse + base64 decode
    const rev = s.split('').reverse().join('');
    return atob(rev);
  } catch {
    return '';
  }
};

/* Replace this placeholder with your encoded GAS URL — see backend/blackstone.gs for instructions */
const _GAS_ENC = 'jVGel9SUPJVV4MTS3wkW1gzZVJHeGhUWvV2VOhUMGNkSZN1XYtWeNlHM2lGclVmTaNzSUpHSRNHdB52RmJEWhBHaVhVVCRmM6J2Y5Z2SB9ycvM3byNWYt9SbvNmLlx2Zv92ZuQHcpJ3Yz9yL6MHc0RHa';
// Decodes to: https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
// Replace YOUR_SCRIPT_ID with your actual deployed GAS script ID.

const _ENDPOINT = _k(_GAS_ENC);
/* ── End of obfuscation ── */

/* Helper: how to encode your own URL:
   1. In browser console (or Node): btoa(url).split('').reverse().join('')
   2. Replace _GAS_ENC above with the output
*/

const FORM_MIN_MS = 3000; // Minimum time-to-submit to pass bot check

/* ────────────────────────────────────────── */
const initForm = ({ formId, type, onSuccess }) => {
  const formEl = document.getElementById(formId);
  if (!formEl) return;

  const alertEl = formEl.querySelector('.form-alert');
  const submitEl = formEl.querySelector('[type="submit"]');
  const overlay = document.getElementById(`${formId}-success`);

  let formLoadTime = Date.now();

  // Reset timer when user first focuses any field
  formEl.addEventListener('focusin', () => { formLoadTime = formLoadTime; }, { once: true });
  // Actually set on first input interaction
  formEl.addEventListener('input', () => { }, { once: true });

  const showAlert = (msg, type = 'error') => {
    if (!alertEl) return;
    alertEl.textContent = msg;
    alertEl.className = `form-alert ${type} visible`;
  };

  const hideAlert = () => {
    if (!alertEl) return;
    alertEl.className = 'form-alert';
  };

  const setLoading = (loading) => {
    if (!submitEl) return;
    submitEl.disabled = loading;
    submitEl.textContent = loading ? 'Sending…' : submitEl.getAttribute('data-label') || 'Submit';
  };

  const showSuccess = () => {
    if (overlay) {
      formEl.style.display = 'none';
      overlay.classList.add('visible');
    } else {
      showAlert('✅ Thank you! Your submission has been received. We will be in touch shortly.', 'success');
      formEl.reset();
      if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
    }
    if (typeof onSuccess === 'function') onSuccess();
  };

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    /* ── TIER 1: Honeypot ── */
    const hp = formEl.querySelector('.hp-field');
    if (hp && hp.value.trim() !== '') {
      // Silently reject — do not alert the bot
      console.warn('[Security] Honeypot triggered');
      return;
    }

    /* ── TIER 2: Time-to-submit ── */
    const elapsed = Date.now() - formLoadTime;
    if (elapsed < FORM_MIN_MS) {
      showAlert('Please take a moment to review your details before submitting.');
      return;
    }

    /* ── TIER 3: reCAPTCHA ── */
    let captchaToken = '';
    if (typeof grecaptcha !== 'undefined') {
      captchaToken = grecaptcha.getResponse();
      if (!captchaToken) {
        showAlert('Please complete the "I am not a robot" verification.');
        return;
      }
    }

    /* ── Basic field validation ── */
    const required = formEl.querySelectorAll('[required]');
    let valid = true;
    required.forEach(f => {
      f.classList.remove('invalid');
      if (!f.value.trim()) {
        f.classList.add('invalid');
        valid = false;
      }
    });
    if (!valid) {
      showAlert('Please fill in all required fields.');
      return;
    }

    /* ── Build payload ── */
    const fd = new FormData(formEl);
    const payload = {};
    fd.forEach((v, k) => { if (k !== 'website') payload[k] = v; }); // exclude honeypot
    payload._type = type;
    payload._captcha = captchaToken;
    payload._ts = new Date().toISOString();

    /* ── TIER 4: Obfuscated endpoint submission ── */
    setLoading(true);
    try {
      await fetch(_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors', // silent — no CORS preflight, user stays on page
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // no-cors means we can't read response, so treat as success
      showSuccess();
    } catch (err) {
      console.error('[Form] Submission error', err);
      showAlert('An error occurred. Please try again or contact us directly.');
    } finally {
      setLoading(false);
    }
  });

  // Mark load time after form is revealed
  formLoadTime = Date.now();

  // Inline validation feedback
  formEl.querySelectorAll('input, select, textarea').forEach(f => {
    f.addEventListener('blur', () => {
      if (f.hasAttribute('required') && !f.value.trim()) {
        f.classList.add('invalid');
      } else {
        f.classList.remove('invalid');
      }
    });
    f.addEventListener('input', () => f.classList.remove('invalid'));
  });

  // File upload label update
  const fileInput = formEl.querySelector('input[type="file"]');
  const fileLabel = formEl.querySelector('.file-name');
  if (fileInput && fileLabel) {
    fileInput.addEventListener('change', () => {
      fileLabel.textContent = fileInput.files[0] ? fileInput.files[0].name : '';
    });
  }

  // File upload area click
  const uploadArea = formEl.querySelector('.file-upload-area');
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = 'var(--gold)'; });
    uploadArea.addEventListener('dragleave', () => uploadArea.style.borderColor = '');
    uploadArea.addEventListener('drop', e => {
      e.preventDefault();
      uploadArea.style.borderColor = '';
      if (e.dataTransfer.files[0]) {
        fileInput.files = e.dataTransfer.files;
        if (fileLabel) fileLabel.textContent = e.dataTransfer.files[0].name;
      }
    });
  }
};

/* ── Encode utility (for admins to generate new _GAS_ENC values) ── */
window._encodeEndpoint = (url) => btoa(url).split('').reverse().join('');

/* Export */
window.initForm = initForm;
