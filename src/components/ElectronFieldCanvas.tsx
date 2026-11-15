import { useEffect, useRef } from 'react';

interface ElectronFieldCanvasProps {
  enabled?: boolean;
  intensity?: 'hero' | 'ambient';
}

interface ElectronParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  spriteIdx: number;
  phase: number;
  orbitSpeed: number;
  baseAlpha: number;
}

export function ElectronFieldCanvas({
  enabled = true,
  intensity = 'ambient',
}: ElectronFieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let animationFrameId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const pointer = { x: -9999, y: -9999, active: false };

    function resize() {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();

    // Pre-render glowing electron sprites for crisp, ultra-fast 60fps rendering at high density
    const palette = [
      { glow: 'rgba(138, 180, 248, 0.75)', core: '#e8f0fe' },
      { glow: 'rgba(102, 157, 246, 0.7)', core: '#d2e3fc' },
      { glow: 'rgba(120, 217, 236, 0.7)', core: '#e4f7fb' },
      { glow: 'rgba(168, 199, 250, 0.75)', core: '#f1f5fe' },
      { glow: 'rgba(129, 201, 149, 0.65)', core: '#e6f4ea' },
    ];

    const spriteSize = 28;
    const sprites = palette.map((c) => {
      const off = document.createElement('canvas');
      off.width = spriteSize;
      off.height = spriteSize;
      const octx = off.getContext('2d');
      if (octx) {
        const half = spriteSize / 2;
        const grad = octx.createRadialGradient(half, half, 0, half, half, half);
        grad.addColorStop(0, c.core);
        grad.addColorStop(0.22, c.glow);
        grad.addColorStop(0.6, 'rgba(138, 180, 248, 0.12)');
        grad.addColorStop(1, 'rgba(138, 180, 248, 0)');
        octx.fillStyle = grad;
        octx.fillRect(0, 0, spriteSize, spriteSize);
      }
      return off;
    });

    // Balanced sea of electrons per unit volume (halved density)
    const areaDivisor = intensity === 'hero' ? 7600 : 9600;
    const count = Math.min(240, Math.max(70, Math.floor((width * height) / areaDivisor)));

    const particles: ElectronParticle[] = Array.from({ length: count }, (_, i) => {
      const speed = intensity === 'hero' ? 0.16 : 0.11;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: (Math.random() - 0.5) * speed * 2,
        radius: Math.random() * 1.4 + 0.9,
        spriteIdx: i % sprites.length,
        phase: Math.random() * Math.PI * 2,
        orbitSpeed: 0.004 + Math.random() * 0.008,
        baseAlpha: intensity === 'hero' ? 0.55 + Math.random() * 0.4 : 0.32 + Math.random() * 0.35,
      };
    });

    function onMouseMove(e: MouseEvent) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    }

    function onMouseLeave() {
      pointer.active = false;
    }

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave);

    function tick() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Subtle deep-field ambient glow
      const bgGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.2,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.75
      );
      bgGrad.addColorStop(0, intensity === 'hero' ? 'rgba(66, 133, 244, 0.08)' : 'rgba(66, 133, 244, 0.04)');
      bgGrad.addColorStop(1, 'rgba(11, 13, 18, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle pointer electrostatic aura when hovering (no connecting lines)
      if (pointer.active) {
        const aura = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 160);
        aura.addColorStop(0, 'rgba(138, 180, 248, 0.08)');
        aura.addColorStop(0.5, 'rgba(120, 217, 236, 0.03)');
        aura.addColorStop(1, 'rgba(11, 13, 18, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(pointer.x - 160, pointer.y - 160, 320, 320);
      }

      // Pure sea of slowly drifting glowing electrons (zero connecting straight lines)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.phase += p.orbitSpeed;
        p.x += p.vx + Math.cos(p.phase) * 0.055;
        p.y += p.vy + Math.sin(p.phase) * 0.055;

        if (p.x < -16) p.x = width + 16;
        if (p.x > width + 16) p.x = -16;
        if (p.y < -16) p.y = height + 16;
        if (p.y > height + 16) p.y = -16;

        // Gentle electrostatic cursor drift without any connecting lines
        let pulseBoost = 0;
        let sizeBoost = 1;
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 22500 && distSq > 1) {
            const dist = Math.sqrt(distSq);
            const force = (150 - dist) / 150;
            p.x += (dx / dist) * force * 0.25;
            p.y += (dy / dist) * force * 0.25;
            pulseBoost = force * 0.3;
            sizeBoost = 1 + force * 0.35;
          }
        }

        const drawSize = p.radius * 8.5 * sizeBoost;
        ctx.globalAlpha = Math.min(1, p.baseAlpha + pulseBoost + Math.sin(p.phase) * 0.08);
        ctx.drawImage(sprites[p.spriteIdx], p.x - drawSize / 2, p.y - drawSize / 2, drawSize, drawSize);
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(tick);
    }

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [enabled, intensity]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="no-print pointer-events-none fixed inset-0 z-0"
    />
  );
}
