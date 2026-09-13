(() => {
  const normalizeUsername = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase();

  function enhance(form) {
    if (!form || form.dataset.authFixBound === '1') return;
    form.dataset.authFixBound = '1';
    const username = form.querySelector('input[name="username"]');
    const password = form.querySelector('input[name="password"]');
    if (username) {
      username.setAttribute('pattern', '[A-Za-z0-9_.-]{3,30}');
      username.setAttribute('minlength', '3');
      username.setAttribute('maxlength', '30');
      username.setAttribute('spellcheck', 'false');
      username.setAttribute('title', '3–30 letters, numbers, dots, underscores, or dashes');
      username.addEventListener('blur', () => { username.value = normalizeUsername(username.value); });
    }
    if (password) {
      password.setAttribute('minlength', '6');
      password.setAttribute('maxlength', '72');
      password.setAttribute('title', 'Password must be 6–72 characters');
      if (!password.nextElementSibling?.classList?.contains('field-help')) {
        const help = document.createElement('small');
        help.className = 'field-help';
        help.textContent = '6–72 characters';
        password.insertAdjacentElement('afterend', help);
      }
    }
  }

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'authForm') return;
    enhance(form);
    const username = form.querySelector('input[name="username"]');
    if (username) username.value = normalizeUsername(username.value);
  }, true);

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest('#authForm')) return;
    const err = document.querySelector('.form-error');
    if (err) err.style.display = 'none';
  }, true);

  const observer = new MutationObserver(() => enhance(document.querySelector('#authForm')));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhance(document.querySelector('#authForm'));
})();
