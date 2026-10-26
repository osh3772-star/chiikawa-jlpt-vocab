if(window.__CV_QA_LOCAL_READY__!==true||window.__CV_QA_SESSION_READY__!==true)throw Error('QA dual storage isolation required');
/* Study display preferences only. No learning-state reads or writes. */
(() => {
  'use strict';
  if (document.body?.dataset.page !== 'study' || document.getElementById('study-visibility-controls')) return;
  const card = document.getElementById('card');
  const meaning = document.getElementById('meaning');
  const reading = document.getElementById('reading');
  const example = document.getElementById('example');
  const translation = document.getElementById('translation');
  const heading = example?.previousElementSibling;
  if (!card || !meaning || !reading || !example || !translation || heading?.tagName !== 'H3' ||
      [meaning, reading, example, translation, heading].some(node => node.parentElement !== card)) return;
  const key = 'cv-study-visibility-v1';
  const defaults = () => ({meaning: true, readingExample: true});
  const parse = raw => {
    try {
      const value = JSON.parse(raw);
      return value && value.version === 1 && typeof value.meaning === 'boolean' &&
        typeof value.readingExample === 'boolean'
        ? {meaning: value.meaning, readingExample: value.readingExample} : defaults();
    } catch { return defaults(); }
  };
  let state = defaults();
  try { state = parse(window.localStorage.getItem(key)); } catch { /* Memory-only mode. */ }
  const controls = document.createElement('fieldset');
  controls.id = 'study-visibility-controls';
  const legend = document.createElement('legend');
  legend.textContent = '단어 표시';
  controls.append(legend);
  const status = document.createElement('span');
  status.id = 'study-visibility-status';
  status.setAttribute('role', 'status');
  const groups = [
    {name: 'meaning', label: '뜻 표시', nodes: [meaning]},
    {name: 'readingExample', label: '히라가나·예문 표시', nodes: [reading, heading, example, translation]}
  ];
  const inputs = [];
  function apply() {
    groups.forEach((group, index) => {
      inputs[index].checked = state[group.name];
      group.nodes.forEach(node => {
        node.hidden = !state[group.name];
        node.setAttribute('aria-hidden', String(!state[group.name]));
      });
    });
  }
  groups.forEach(group => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'study-show-' + group.name;
    input.setAttribute('aria-controls', group.nodes.filter(node => node.id).map(node => node.id).join(' '));
    input.setAttribute('aria-describedby', status.id);
    label.append(input, document.createTextNode(group.label));
    inputs.push(input);
    input.addEventListener('change', () => {
      state[group.name] = input.checked;
      apply();
      try {
        window.localStorage.setItem(key, JSON.stringify({version: 1, ...state}));
        status.textContent = '';
      } catch { status.textContent = '표시 설정은 현재 창에만 적용됩니다. 저장이 차단되어 새로 열면 유지되지 않을 수 있습니다.'; }
    });
    controls.append(label);
  });
  controls.append(status);
  card.parentElement.insertBefore(controls, card);
  apply();
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    // Re-read this origin's local store; do not trust other storage-area payloads.
    try { state = parse(window.localStorage.getItem(key)); apply(); status.textContent = ''; } catch { /* Keep current in-memory choice. */ }
  });
  // Existing rendering only updates textContent of these stable nodes; hidden/ARIA persist.
})();
