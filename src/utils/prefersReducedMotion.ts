export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function shouldReduceMotion(animationStyle: 'full' | 'reduced'): boolean {
  return animationStyle === 'reduced' || prefersReducedMotion();
}
