/* Dusk marketing — quiet reveal + latest successful IPA run when public. */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
  }

  const link = document.getElementById('ipa-link');
  if (!link) return;
  const api = 'https://api.github.com/repos/zxypablo11/dusk-ios/actions/workflows/dusk-ios.yml/runs?status=success&per_page=1';
  fetch(api, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const run = data && data.workflow_runs && data.workflow_runs[0];
      if (!run || !run.html_url) return;
      link.href = run.html_url;
      link.textContent = 'Latest IPA build';
    })
    .catch(() => {});
})();
