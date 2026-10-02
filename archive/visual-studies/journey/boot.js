// Runs before first paint so the page lays out once: the full flight when
// WebGL and motion are available, otherwise the static stacked layout.
(function () {
  var root = document.documentElement;
  try {
    var reduced = new URLSearchParams(location.search).has('static') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl && !reduced) root.classList.add('journey-3d');
    else root.classList.add('journey-static');
    var lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch (error) {
    root.classList.add('journey-static');
  }
})();
