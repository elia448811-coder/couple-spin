import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../utils/prefersReducedMotion';

type ConfettiEffectProps = {
  active: boolean;
  colors?: string[];
};

export function ConfettiEffect({ active, colors }: ConfettiEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const palette = colors ?? ['#FF4FA3', '#8B5CF6', '#38BDF8', '#FACC15', '#2DD4BF', '#FB923C'];
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 8 + 4,
      color: palette[Math.floor(Math.random() * palette.length)],
      speedY: Math.random() * 3 + 2,
      speedX: Math.random() * 2 - 1,
      rotation: Math.random() * 360,
      rotSpeed: Math.random() * 10 - 5,
      shape: Math.random() > 0.5 ? 'rect' : 'heart',
    }));

    let frame: number;
    let elapsed = 0;

    const animate = () => {
      elapsed++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === 'heart') {
          ctx.font = `${p.size * 2}px serif`;
          ctx.fillText('♥', 0, 0);
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        }
        ctx.restore();
      });

      if (elapsed < 200) frame = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(frame);
  }, [active, colors]);

  if (!active) return null;

  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
}
