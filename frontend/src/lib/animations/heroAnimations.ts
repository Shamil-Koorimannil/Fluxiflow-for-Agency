import { gsap } from 'gsap';

export const playHeroEntrance = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  navbarRef: React.RefObject<HTMLDivElement | null>
) => {
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ctx = gsap.context(() => {
    if (isReduced) {
      // If prefers-reduced-motion is active, just perform simple fades with 0 transform
      gsap.fromTo('.hero-eyebrow, .hero-headline, .hero-description, .hero-cta-group, .hero-dashboard',
        { opacity: 0 },
        { opacity: 1, duration: 0.8, stagger: 0.15 }
      );
      if (navbarRef.current) {
        gsap.fromTo(navbarRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 });
      }
      return;
    }

    const tl = gsap.timeline({
      defaults: { ease: 'power4.out', duration: 1.2 }
    });

    // 1. Navbar
    if (navbarRef.current) {
      tl.fromTo(navbarRef.current,
        { y: -25, opacity: 0 },
        { y: 0, opacity: 1, duration: 1 }
      );
    }

    // 2. Eyebrow
    tl.fromTo('.hero-eyebrow',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      '-=0.6'
    );

    // 3. Headline clip-path/reveal
    tl.fromTo('.hero-headline',
      { clipPath: 'polygon(0 100%, 100% 100%, 100% 100%, 0 100%)', y: 35 },
      { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', y: 0, duration: 1.3 },
      '-=0.6'
    );

    // 4. Description
    tl.fromTo('.hero-description',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 1 },
      '-=0.8'
    );

    // 5. CTA Buttons
    tl.fromTo('.hero-cta-group',
      { y: 15, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      '-=0.8'
    );

    // 6. Dashboard Visual
    tl.fromTo('.hero-dashboard',
      { y: 50, opacity: 0, scale: 0.98 },
      { y: 0, opacity: 1, scale: 1, duration: 1.4, ease: 'power3.out' },
      '-=0.8'
    );
  }, containerRef);

  return ctx;
};

// Desktop magnetic button helper
export const initMagneticButtons = () => {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isMobile || isReduced) return () => {};

  const buttons = document.querySelectorAll('.magnetic-btn-primary, .magnetic-btn-secondary');
  const cleanups: (() => void)[] = [];

  buttons.forEach((btn) => {
    const el = btn as HTMLElement;
    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      // Restrain displacement to max 6px
      gsap.to(el, {
        x: x * 0.15,
        y: y * 0.15,
        duration: 0.3,
        ease: 'power2.out',
      });
    };

    const onMouseLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: 'elastic.out(1, 0.3)',
      });
    };

    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseleave', onMouseLeave);

    cleanups.push(() => {
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseleave', onMouseLeave);
      gsap.set(el, { x: 0, y: 0 });
    });
  });

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
};
