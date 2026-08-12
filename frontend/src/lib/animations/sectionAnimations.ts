import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const initSectionAnimations = (containerRef: React.RefObject<HTMLDivElement | null>) => {
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReduced) return () => {};

  const ctx = gsap.context(() => {
    const mm = gsap.matchMedia();

    // Setup animations with breakpoint constraints
    mm.add({
      isDesktop: '(min-width: 1024px)',
      isTablet: '(min-width: 768px) and (max-width: 1023px)',
      isMobile: '(max-width: 767px)'
    }, (context) => {
      const { isDesktop, isTablet } = context.conditions as any;
      const moveDistanceMultiplier = isDesktop ? 1 : (isTablet ? 0.6 : 0);

      // --- SECTION 2: WHY FLUXIFLOW ---
      // Left text reveal
      gsap.from('.why-fluxiflow-text', {
        scrollTrigger: {
          trigger: '.why-fluxiflow-text',
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        },
        x: -40 * moveDistanceMultiplier,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
      });

      // Right sculpture rotating and scaling on scroll scrub
      gsap.from('.why-fluxiflow-sculpture', {
        scrollTrigger: {
          trigger: '.why-fluxiflow-sculpture',
          start: 'top 85%',
          end: 'bottom 20%',
          scrub: 1
        },
        scale: 0.85,
        rotation: 30,
        opacity: 0.8
      });

      // Three cards stagger reveal
      gsap.from('.core-idea-card', {
        scrollTrigger: {
          trigger: '.core-idea-card',
          start: 'top 90%'
        },
        y: 35 * moveDistanceMultiplier,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: 'power3.out'
      });

      // --- SECTION 3: FEATURES (TASKS) ---
      // Masked title reveal
      gsap.from('.tasks-heading', {
        scrollTrigger: {
          trigger: '.tasks-heading',
          start: 'top 85%'
        },
        clipPath: 'polygon(0 100%, 100% 100%, 100% 100%, 0 100%)',
        y: 20 * moveDistanceMultiplier,
        duration: 1.2,
        ease: 'power3.out'
      });

      // Main tasks UI card container reveal
      gsap.from('.tasks-card-container', {
        scrollTrigger: {
          trigger: '.tasks-card-container',
          start: 'top 85%'
        },
        y: 40 * moveDistanceMultiplier,
        opacity: 0,
        scale: 0.99,
        duration: 1.2,
        ease: 'power3.out'
      });

      // --- SECTION 4: PROJECTS ---
      // Overall progress bar inside mockup card
      gsap.from('.project-progress-bar', {
        scrollTrigger: {
          trigger: '.project-progress-container',
          start: 'top 85%'
        },
        width: 0,
        duration: 1.5,
        ease: 'power3.inOut'
      });

      // Left mockup project card subtle parallax scroll
      gsap.from('.project-visual-card', {
        scrollTrigger: {
          trigger: '.project-visual-card',
          start: 'top 95%',
          end: 'bottom 10%',
          scrub: 0.5
        },
        y: 30 * moveDistanceMultiplier
      });

      // --- SECTION 5: TEAM HEALTH ---
      // Team progress bars fill animation
      const healthBars = document.querySelectorAll('.team-health-bar');
      healthBars.forEach((bar) => {
        const targetVal = bar.getAttribute('aria-valuenow') || '100';
        gsap.fromTo(bar.querySelector('.MuiLinearProgress-bar'),
          { width: '0%' },
          {
            scrollTrigger: {
              trigger: bar,
              start: 'top 90%'
            },
            width: `${targetVal}%`,
            duration: 1.5,
            ease: 'power2.out'
          }
        );
      });

      // Team cards slide in stagger
      gsap.from('.team-member-card', {
        scrollTrigger: {
          trigger: '.team-member-card',
          start: 'top 90%'
        },
        x: 30 * moveDistanceMultiplier,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out'
      });

      // --- SECTION 6: LATE COMPLIANCE ---
      // Subtle warning triangle alert wiggle on reveal
      gsap.fromTo('.compliance-warning-icon',
        { rotation: -12 },
        {
          scrollTrigger: {
            trigger: '.compliance-warning-icon',
            start: 'top 85%'
          },
          rotation: 12,
          yoyo: true,
          repeat: 5,
          duration: 0.1,
          ease: 'power1.inOut'
        }
      );

      // --- SECTION 7: REPORTING ---
      // Report row items staggered slide-in
      gsap.from('.report-row', {
        scrollTrigger: {
          trigger: '.report-row',
          start: 'top 90%'
        },
        opacity: 0,
        x: -20 * moveDistanceMultiplier,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power2.out'
      });

      // --- SECTION 8: ACTIVITY & NOTIFICATIONS ---
      gsap.from('.activity-log-box', {
        scrollTrigger: {
          trigger: '.activity-log-box',
          start: 'top 90%'
        },
        x: -30 * moveDistanceMultiplier,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
      });

      gsap.from('.notifications-box', {
        scrollTrigger: {
          trigger: '.notifications-box',
          start: 'top 90%'
        },
        x: 30 * moveDistanceMultiplier,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
      });

      // --- SECTION 9: HOW IT WORKS (Pinned Step Storytelling) ---
      if (isDesktop) {
        const steps = gsap.utils.toArray('.how-it-works-step');
        gsap.set(steps, { opacity: 0.25, scale: 0.96 });

        const mainTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: '#how-it-works',
            start: 'top 15%',
            end: '+=1100',
            pin: true,
            scrub: true,
            anticipatePin: 1
          }
        });

        steps.forEach((step: any, index) => {
          mainTimeline.to(step, {
            opacity: 1,
            scale: 1,
            duration: 1,
            ease: 'power2.out'
          });
          if (index < steps.length - 1) {
            mainTimeline.to(step, {
              opacity: 0.25,
              scale: 0.96,
              duration: 0.5,
              ease: 'power2.in'
            });
          }
        });
      } else {
        // Simple slide and fade in on mobile / tablet
        gsap.from('.how-it-works-step', {
          scrollTrigger: {
            trigger: '.how-it-works-step',
            start: 'top 90%'
          },
          y: 20,
          opacity: 0,
          stagger: 0.15,
          duration: 0.8
        });
      }

      // --- SECTION 12: LARGE STATEMENT ---
      gsap.from('.editorial-statement-title', {
        scrollTrigger: {
          trigger: '.editorial-statement-title',
          start: 'top 85%'
        },
        clipPath: 'polygon(0 100%, 100% 100%, 100% 100%, 0 100%)',
        y: 30 * moveDistanceMultiplier,
        duration: 1.4,
        ease: 'power3.out'
      });
    });
  }, containerRef);

  return () => ctx.revert();
};
