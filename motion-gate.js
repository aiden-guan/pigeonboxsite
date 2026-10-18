// Runs before first paint (blocking, tiny) so the hero's entrance never flashes.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('motion-hero');
