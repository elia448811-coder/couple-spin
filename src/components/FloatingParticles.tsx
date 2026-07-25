import { shouldReduceMotion } from '../utils/prefersReducedMotion';

type FloatingParticlesProps = {
  reduced?: boolean;
};

export function FloatingParticles({ reduced = false }: FloatingParticlesProps) {
  if (shouldReduceMotion(reduced ? 'reduced' : 'full')) return null;

  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: `${(i * 17 + 7) % 100}%`,
    delay: `${(i * 0.7) % 5}s`,
    size: 4 + (i % 5),
    duration: 5 + (i % 4),
  }));

  return (
    <div className="floating-particles" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="floating-particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
