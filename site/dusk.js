(() => {
  const link = document.getElementById('ipa-link');
  if (!link) return;
  fetch('https://api.github.com/repos/zxypablo11/dusk-ios/actions/workflows/dusk-ios.yml/runs?status=success&per_page=1', {
    headers: { Accept: 'application/vnd.github+json' },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const run = data && data.workflow_runs && data.workflow_runs[0];
      if (!run || !run.html_url) return;
      link.href = run.html_url;
      link.textContent = 'Neuester IPA-Build';
    })
    .catch(() => {});
})();
