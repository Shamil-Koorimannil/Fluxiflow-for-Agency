import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const initSmoothScroll = () => {
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // If user prefers reduced motion, do not use smooth scrolling
  if (isReduced) {
    return {
      lenis: null,
      destroy: () => {},
    };
  }

  const lenis = new Lenis({
    lerp: 0.1,
    wheelMultiplier: 0.9,
    gestureOrientation: 'vertical',
    smoothWheel: true,
  });

  // Synchronize ScrollTrigger updates with Lenis
  const scrollHandler = () => {
    ScrollTrigger.update();
  };
  lenis.on('scroll', scrollHandler);

  // Synchronize Lenis raf loop with GSAP ticker for frame-rate alignment
  const tickHandler = (time: number) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(tickHandler);
  gsap.ticker.lagSmoothing(0);

  const destroy = () => {
    lenis.off('scroll', scrollHandler);
    gsap.ticker.remove(tickHandler);
    lenis.destroy();
  };

  return { lenis, destroy };
};
