// Feedback overlay: form UI + submission to Cloudflare Worker.
// Call init() once on startup, openFeedback() to show the overlay.

import { VERSION, escHtml } from './utils.js';

// After deploying the worker, replace this with your workers.dev URL.
const WORKER_URL = 'https://egg-dungeon-feedback.YOUR_SUBDOMAIN.workers.dev';

export function init() {
  document.getElementById('fb-cancel').addEventListener('click', close);
  document.getElementById('fb-submit').addEventListener('click', submit);
  // Click backdrop to dismiss
  document.getElementById('feedback-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('feedback-overlay')) close();
  });
  // Escape key to dismiss (captured before game sees it)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('feedback-overlay').hidden) {
      e.stopPropagation();
      close();
    }
  }, true);
}

export function openFeedback() {
  document.getElementById('fb-type').value = 'bug';
  document.getElementById('fb-title').value = '';
  document.getElementById('fb-body').value = '';
  setStatus('');
  setLoading(false);
  document.getElementById('feedback-version').textContent = VERSION;
  document.getElementById('feedback-overlay').removeAttribute('hidden');
  document.getElementById('fb-title').focus();
}

function close() {
  document.getElementById('feedback-overlay').setAttribute('hidden', '');
}

function setStatus(html) {
  document.getElementById('fb-status').innerHTML = html;
}

function setLoading(on) {
  document.getElementById('fb-submit').disabled = on;
  document.getElementById('fb-cancel').disabled = on;
  document.getElementById('fb-submit').textContent = on ? 'Submitting...' : 'Submit';
}

async function submit() {
  const title       = document.getElementById('fb-title').value.trim();
  const description = document.getElementById('fb-body').value.trim();
  const type        = document.getElementById('fb-type').value;

  if (!title) { setStatus('<span class="fb-error">Title is required.</span>'); return; }
  if (!description) { setStatus('<span class="fb-error">Description is required.</span>'); return; }

  setStatus('');
  setLoading(true);

  try {
    const resp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, type, version: `v${VERSION}` }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      setStatus(`<span class="fb-error">Error: ${escHtml(data.error ?? 'Unknown error')}</span>`);
      setLoading(false);
      return;
    }

    setStatus(
      `<span class="fb-success">Issue <a href="${escHtml(data.url)}" target="_blank" rel="noopener">#${data.number}</a> created — thank you!</span>`
    );
    document.getElementById('fb-submit').style.display = 'none';
    document.getElementById('fb-cancel').textContent = 'Close';
    document.getElementById('fb-cancel').disabled = false;
  } catch (e) {
    setStatus('<span class="fb-error">Could not reach the server. Check your connection.</span>');
    setLoading(false);
  }
}
