import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Card,
  LinearProgress
} from '@mui/material';
import { 
  TrendingUp,
  Folder,
  Users,
  FileSpreadsheet
} from 'lucide-react';
import { FluxiflowNavbar } from '../components/common/FluxiflowNavbar';
import { FluxiflowLogo } from '../components/common/FluxiflowLogo';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNav = (path: string) => {
    navigate(path);
  };

  useEffect(() => {
    document.title = "Fluxiflow — One workspace. Absolute delivery flow.";
    
    // GSAP ScrollTrigger Animations for Home Page
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    const ctx = gsap.context(() => {
      // 1. Hero Reveal Animation
      const heroTl = gsap.timeline({ defaults: { ease: 'power4.out', duration: 1.2 } });
      heroTl.fromTo('.hero-eyebrow', { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, 0.2);
      heroTl.fromTo('.hero-headline', { y: 35, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3 }, 0.4);
      heroTl.fromTo('.hero-description', { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, 0.6);
      heroTl.fromTo('.hero-cta-group', { y: 15, opacity: 0 }, { y: 0, opacity: 1 }, 0.8);
      heroTl.fromTo('.hero-visual-container', { scale: 0.95, opacity: 0, y: 30 }, { scale: 1, opacity: 1, y: 0, duration: 1.4 }, 0.9);

      // 2. Section Fade-ins
      const sections = gsap.utils.toArray('.scroll-reveal-section');
      sections.forEach((sec: any) => {
        gsap.fromTo(sec, 
          { opacity: 0, y: 40 },
          { 
            opacity: 1, 
            y: 0, 
            duration: 1, 
            ease: 'power3.out',
            scrollTrigger: {
              trigger: sec,
              start: 'top 85%',
              toggleActions: 'play none none reverse'
            }
          }
        );
      });

      // 3. Staggered Cards Reveal
      gsap.fromTo('.value-card-stagger', 
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.2,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.value-cards-trigger',
            start: 'top 85%'
          }
        }
      );

      // 4. Parallax Scroll on Hero Visual
      gsap.fromTo('.hero-parallax-bg', 
        { yPercent: -5 },
        {
          yPercent: 5,
          ease: 'none',
          scrollTrigger: {
            trigger: '.hero-visual-container',
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        }
      );

      // 5. Asymmetric Image Slide
      gsap.fromTo('.asymmetric-slide-img', 
        { scale: 1.08, xPercent: -3 },
        {
          scale: 1,
          xPercent: 0,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.asymmetric-slide-trigger',
            start: 'top 90%',
            scrub: 1
          }
        }
      );

      // 6. Text Reveal for Philosophy
      gsap.fromTo('.philosophy-word',
        { opacity: 0.2, y: 10 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.2,
          duration: 0.8,
          scrollTrigger: {
            trigger: '.philosophy-trigger',
            start: 'top 80%'
          }
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        bgcolor: '#f8fafc', 
        color: '#0f172a', 
        minHeight: '100vh', 
        overflowX: 'hidden',
        fontFamily: '"Outfit", sans-serif',
        pb: 0
      }}
    >
      {/* Google Fonts Link */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Shared Navigation Bar */}
      <FluxiflowNavbar />

      {/* ── SECTION 1: HERO (Atmospheric Image-led Layout) ── */}
      <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 14 }, pb: { xs: 8, md: 12 } }}>
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            textAlign: 'center', 
            maxWidth: '920px',
            mx: 'auto',
            mb: { xs: 6, md: 10 }
          }}
        >
          {/* Eyebrow */}
          <Typography 
            className="hero-eyebrow"
            variant="caption" 
            sx={{ 
              fontWeight: 800, 
              letterSpacing: '2px', 
              textTransform: 'uppercase', 
              color: '#3b82f6',
              fontSize: '11px',
              mb: 3,
              display: 'block'
            }}
          >
            PROJECT MANAGEMENT FOR MODERN AGENCIES
          </Typography>
          
          {/* Headline */}
          <Typography 
            className="hero-headline"
            variant="h1" 
            sx={{ 
              fontWeight: 900, 
              fontSize: { xs: '38px', sm: '60px', md: '80px' }, 
              lineHeight: 1.08,
              letterSpacing: '-3px',
              color: '#0f172a',
              maxWidth: '820px',
              mb: 3.5
            }}
          >
            Your agency's work,<br />finally in one flow.
          </Typography>

          {/* Description */}
          <Typography 
            className="hero-description"
            variant="body1" 
            sx={{ 
              fontSize: { xs: '15px', sm: '18px', md: '20px' }, 
              color: '#475569', 
              maxWidth: '640px',
              lineHeight: 1.6,
              mb: 5,
              fontWeight: 500
            }}
          >
            Fluxiflow brings projects, tasks, people, progress, and reporting into one simple workspace built for agency teams.
          </Typography>

          {/* CTA Buttons */}
          <Box className="hero-cta-group" sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2.5 }}>
            <Button 
              onClick={() => handleNav('/login')}
              variant="contained" 
              sx={{ 
                bgcolor: '#0f172a', 
                color: '#ffffff', 
                textTransform: 'none', 
                fontWeight: 700, 
                fontSize: '14px',
                borderRadius: '100px', 
                px: 4.5, 
                py: 1.6,
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
                '&:hover': { bgcolor: '#1e293b' } 
              }}
            >
              Get Started
            </Button>
            <Button 
              onClick={() => handleNav('/login')}
              variant="outlined" 
              sx={{ 
                borderColor: 'rgba(15, 23, 42, 0.15)', 
                color: '#0f172a', 
                textTransform: 'none', 
                fontWeight: 700, 
                fontSize: '14px',
                borderRadius: '100px', 
                px: 4.5, 
                py: 1.6,
                '&:hover': { borderColor: '#0f172a', bgcolor: 'transparent' } 
              }}
            >
              Log In
            </Button>
          </Box>
        </Box>

        {/* Large Rounded Hero Graphic Composition (Parallax atmospheric landscape + Floating elements) */}
        <Box 
          className="hero-visual-container"
          sx={{ 
            position: 'relative', 
            width: '100%',
            maxWidth: '1080px',
            mx: 'auto',
            borderRadius: '40px',
            overflow: 'hidden',
            aspectRatio: { xs: '4/3', md: '16/9' },
            minHeight: { xs: '320px', md: '560px' },
            border: '1.5px solid rgba(255, 255, 255, 0.8)',
            boxShadow: '0 30px 80px rgba(15, 23, 42, 0.04)'
          }}
        >
          {/* Main Background (fluxiflow_hero.png) */}
          <Box className="hero-parallax-bg" sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, height: '110%', width: '100%', zIndex: 0 }}>
            <img 
              src="/fluxiflow_hero.png" 
              alt="Atmospheric flow workspace illustration" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
            />
            {/* Ambient vignette gradient */}
            <Box 
              sx={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                background: 'linear-gradient(to bottom, rgba(248, 250, 252, 0.2), rgba(248, 250, 252, 0.95))' 
              }} 
            />
          </Box>

          {/* Floating UI Elements inside hero landscape */}
          <Box sx={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' }, 
                gap: 3.5, 
                width: '100%', 
                justifyContent: 'space-between',
                alignItems: 'center',
                maxWidth: '820px'
              }}
            >
              {/* Floating Task Card */}
              <Box 
                sx={{ 
                  bgcolor: 'rgba(255, 255, 255, 0.75)', 
                  backdropFilter: 'blur(20px)', 
                  border: '1.5px solid rgba(255, 255, 255, 0.8)', 
                  borderRadius: '24px', 
                  p: 3, 
                  width: { xs: '100%', sm: '280px' },
                  boxShadow: '0 20px 40px rgba(0,0,0,0.02)',
                  textAlign: 'left',
                  transform: 'rotate(-2deg)'
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.5px' }}>ACTIVE DELIVERABLE</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, fontSize: '15px', mt: 1, mb: 2 }}>Brand tone guidelines</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: '50%', border: '2.5px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22c55e' }} />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>Due in 2 days</Typography>
                </Box>
              </Box>

              {/* Floating Health Card */}
              <Box 
                sx={{ 
                  bgcolor: '#0f172a', 
                  borderRadius: '24px', 
                  p: 3, 
                  width: { xs: '100%', sm: '260px' },
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  textAlign: 'left',
                  color: '#ffffff',
                  transform: 'rotate(2deg)'
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.5px' }}>TEAM CAPACITY</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800 }}>Sarah Jenkins</Typography>
                  <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 900 }}>92% Healthy</Typography>
                </Box>
                <LinearProgress variant="determinate" value={92} sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }} />
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>


      {/* ── SECTION 2: WHAT IS FLUXIFLOW? (Two Column Editorial) ── */}
      <Box className="scroll-reveal-section" sx={{ py: { xs: 10, md: 16 }, bgcolor: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.03)', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
        <Container maxWidth="lg">
          <Box 
            sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', md: '5.5fr 6.5fr' }, 
              gap: { xs: 4, md: 8 }, 
              alignItems: 'flex-start' 
            }}
          >
            {/* Left side */}
            <Box>
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 800, 
                  color: '#3b82f6', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1.5px', 
                  display: 'block', 
                  mb: 2 
                }}
              >
                ABOUT FLUXIFLOW
              </Typography>
              <Typography 
                variant="h2" 
                sx={{ 
                  fontWeight: 900, 
                  fontSize: { xs: '30px', md: '44px' }, 
                  letterSpacing: '-1.5px', 
                  color: '#0f172a',
                  lineHeight: 1.15
                }}
              >
                One flow for all the work that moves your agency.
              </Typography>
            </Box>

            {/* Right side */}
            <Box sx={{ pt: { md: 4 } }}>
              <Typography 
                variant="body1" 
                sx={{ 
                  fontSize: { xs: '16px', md: '18px' }, 
                  color: '#475569', 
                  lineHeight: 1.6,
                  fontWeight: 500
                }}
              >
                Fluxiflow brings projects, tasks, people, deadlines, progress and reporting into one connected workspace — giving agency teams a clearer way to plan, execute and deliver.
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 3: THREE CORE VALUE CARDS (Sophisticated layout) ── */}
      <Container className="scroll-reveal-section value-cards-trigger" maxWidth="lg" sx={{ py: { xs: 10, md: 16 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 4 }}>
          {/* Card 1 */}
          <Card 
            className="value-card-stagger"
            sx={{ 
              borderRadius: '24px', 
              border: '1.5px solid rgba(255, 255, 255, 0.8)',
              background: 'linear-gradient(135deg, #e0e7ff 0%, #ffffff 100%)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.01)',
              p: { xs: 2.5, md: 4.5 },
              minHeight: '280px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ zIndex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', fontSize: '20px', mb: 2 }}>
                Everything in one flow
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.5, fontSize: '14px' }}>
                Projects, tasks, people and progress stay connected in one workspace.
              </Typography>
            </Box>
            
            {/* Abstract background shape representing flow */}
            <Box sx={{ position: 'absolute', bottom: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />
          </Card>

          {/* Card 2 */}
          <Card 
            className="value-card-stagger"
            sx={{ 
              borderRadius: '24px', 
              border: '1.5px solid rgba(255, 255, 255, 0.8)',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.01)',
              p: { xs: 2.5, md: 4.5 },
              minHeight: '280px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ zIndex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', fontSize: '20px', mb: 2 }}>
                Built for agency teams
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.5, fontSize: '14px' }}>
                Keep client work, internal work and team responsibilities organized without unnecessary complexity.
              </Typography>
            </Box>
            
            {/* Abstract shape */}
            <Box sx={{ position: 'absolute', bottom: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 70%)' }} />
          </Card>

          {/* Card 3 */}
          <Card 
            className="value-card-stagger"
            sx={{ 
              borderRadius: '24px', 
              border: '1.5px solid rgba(255, 255, 255, 0.8)',
              background: 'linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.01)',
              p: { xs: 2.5, md: 4.5 },
              minHeight: '280px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ zIndex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', fontSize: '20px', mb: 2 }}>
                Clear work. Clear progress.
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.5, fontSize: '14px' }}>
                Know what is happening, who owns it, what is late and what needs attention.
              </Typography>
            </Box>
            
            {/* Abstract shape */}
            <Box sx={{ position: 'absolute', bottom: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(234,179,8,0.1) 0%, transparent 70%)' }} />
          </Card>
        </Box>
      </Container>


      {/* ── SECTION 4: VISUAL BRAND / IMAGE BREAK ── */}
      <Box sx={{ width: '100%', py: 4, bgcolor: '#f8fafc' }}>
        <Container maxWidth="lg">
          <Box 
            sx={{ 
              width: '100%', 
              borderRadius: '40px', 
              overflow: 'hidden', 
              aspectRatio: { xs: '3/2', md: '21/9' },
              border: '1.5px solid rgba(255,255,255,0.8)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.02)',
              position: 'relative'
            }}
          >
            <img 
              src="/fluxiflow_hero.png" 
              alt="Fluxiflow Brand Landscape Break" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
            />
            {/* Ambient text overlay */}
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.1)' }}>
              <Typography variant="h3" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-1px', fontSize: { xs: '20px', md: '36px' }, opacity: 0.9 }}>
                Connected workflows. Unified teams.
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 5: "WHY FLUXIFLOW?" (Asymmetric Layout) ── */}
      <Container className="scroll-reveal-section asymmetric-slide-trigger" maxWidth="lg" sx={{ py: { xs: 10, md: 16 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '6fr 6fr' }, gap: { xs: 6, md: 10 }, alignItems: 'center' }}>
          {/* Side A: Large typography */}
          <Box>
            <Typography 
              variant="h2" 
              sx={{ 
                fontWeight: 900, 
                fontSize: { xs: '34px', md: '54px' }, 
                letterSpacing: '-2.5px', 
                color: '#0f172a',
                lineHeight: 1.1,
                mb: 4
              }}
            >
              Less scattered work.<br />More momentum.
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: '#475569', 
                lineHeight: 1.6,
                fontSize: '15.5px',
                maxWidth: '460px'
              }}
            >
              Agencies move fast. Work shouldn't get lost between projects, people, deadlines and updates. Fluxiflow gives your team one clear place to keep everything moving.
            </Typography>
          </Box>

          {/* Side B: Large visual/image/card composition */}
          <Box 
            sx={{ 
              borderRadius: '32px', 
              overflow: 'hidden', 
              boxShadow: '0 20px 45px rgba(0,0,0,0.02)',
              border: '1.5px solid rgba(255,255,255,0.8)'
            }}
          >
            <img 
              className="asymmetric-slide-img"
              src="/fluxiflow_momentum.png" 
              alt="Fluxiflow Agency Architecture Layout" 
              style={{ width: '100%', height: 'auto', display: 'block', transition: 'transform 0.5s ease' }} 
            />
          </Box>
        </Box>
      </Container>


      {/* ── SECTION 6: USE CASES (Asymmetric Left Title / Right Cards layout) ── */}
      <Box className="scroll-reveal-section" sx={{ py: { xs: 10, md: 16 }, bgcolor: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.03)', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' }, gap: 8 }}>
            {/* Left side */}
            <Box>
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 800, 
                  color: '#3b82f6', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px', 
                  display: 'block', 
                  mb: 2 
                }}
              >
                FLUXIFLOW IN ACTION
              </Typography>
              <Typography 
                variant="h2" 
                sx={{ 
                  fontWeight: 900, 
                  fontSize: { xs: '32px', md: '44px' }, 
                  letterSpacing: '-1.5px', 
                  color: '#0f172a',
                  lineHeight: 1.15,
                  mb: 3
                }}
              >
                One workspace.<br />Many ways to work.
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', fontSize: '14.5px', lineHeight: 1.5, maxWidth: '340px' }}>
                Fluxiflow wraps all essential agency activities into simple pipelines, removing coordination waste.
              </Typography>
            </Box>

            {/* Right side: Image + Use case list */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4.5 }}>
              {/* Large Rounded Image Card */}
              <Box 
                sx={{ 
                  borderRadius: '24px', 
                  overflow: 'hidden', 
                  border: '1.5px solid rgba(0, 0, 0, 0.04)',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.02)'
                }}
              >
                <img 
                  src="/fluxiflow_usecases.png" 
                  alt="Fluxiflow Use Cases Workspace mockup" 
                  style={{ width: '100%', height: 'auto', display: 'block' }} 
                />
              </Box>

              {/* Use Case Items grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3.5 }}>
                {[
                  { title: 'AGENCY PROJECTS', desc: 'Keep every project organized from kickoff to delivery.', icon: <Folder size={18} /> },
                  { title: 'TEAM MANAGEMENT', desc: 'Know who owns what and where work needs attention.', icon: <Users size={18} /> },
                  { title: 'CLIENT DELIVERY', desc: 'Keep deadlines, progress and responsibilities visible.', icon: <TrendingUp size={18} /> },
                  { title: 'REPORTING', desc: 'Turn everyday work into clear progress and useful reports.', icon: <FileSpreadsheet size={18} /> }
                ].map((item, idx) => (
                  <Box key={idx} sx={{ p: { xs: 2, md: 3 }, border: '1px solid rgba(0,0,0,0.04)', borderRadius: '18px', bgcolor: '#f8fafc', display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
                    <Box sx={{ bgcolor: 'rgba(59,130,246,0.08)', color: '#3b82f6', p: 1.2, borderRadius: '10px', display: 'flex', shrink: 0 }}>
                      {item.icon}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '13.5px', mb: 0.5 }}>{item.title}</Typography>
                      <Typography variant="caption" sx={{ color: '#475569', fontSize: '12px' }}>{item.desc}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 7: WHO IS FLUXIFLOW FOR? ── */}
      <Container className="scroll-reveal-section" maxWidth="lg" sx={{ py: { xs: 10, md: 16 } }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography 
            variant="h2" 
            sx={{ 
              fontWeight: 900, 
              fontSize: { xs: '32px', md: '44px' }, 
              letterSpacing: '-1.5px', 
              color: '#0f172a',
              mb: 2.5
            }}
          >
            Built for teams that keep work moving.
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 4 }}>
          {[
            { title: 'Creative Agencies', desc: 'Keep designers, copywriters, and developers moving in sync from asset generation to deployment.', img: '/creative_agencies.png' },
            { title: 'Marketing Teams', desc: 'Coordinate campaigns, reviews, and client deliverables under a central compliance tracker.', img: '/marketing_teams.png' },
            { title: 'Growing Services', desc: 'Scale project throughput without adding administration overhead or losing tracking logs.', img: '/service_businesses.png' }
          ].map((item, idx) => (
            <Card 
              key={idx} 
              sx={{ 
                p: 0, 
                borderRadius: '24px', 
                border: '1px solid rgba(0,0,0,0.05)', 
                boxShadow: 'none',
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-6px)'
                }
              }}
            >
              {/* Image Container */}
              <Box sx={{ width: '100%', height: '180px', overflow: 'hidden' }}>
                <img src={item.img} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
              <Box sx={{ p: { xs: 2.5, md: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, fontSize: '17px' }}>{item.title}</Typography>
                <Typography variant="body2" sx={{ color: '#475569', fontSize: '13px', lineHeight: 1.5 }}>{item.desc}</Typography>
              </Box>
            </Card>
          ))}
        </Box>
      </Container>


      {/* ── SECTION 8: THE FLUXIFLOW PHILOSOPHY (Minimal Scroll Animation Section) ── */}
      <Box className="philosophy-trigger" sx={{ py: { xs: 12, md: 20 }, bgcolor: '#0f172a', color: '#ffffff', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography 
            variant="h2" 
            sx={{ 
              fontWeight: 900, 
              fontSize: { xs: '44px', md: '72px' }, 
              letterSpacing: '-2px',
              lineHeight: 1.15,
              mb: 4
            }}
          >
            <span className="philosophy-word">Plan. </span>
            <span className="philosophy-word">Move. </span>
            <span className="philosophy-word">Deliver.</span>
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'rgba(255,255,255,0.7)', 
              fontSize: { xs: '15px', md: '18px' },
              lineHeight: 1.65,
              maxWidth: '560px',
              mx: 'auto',
              fontWeight: 400
            }}
          >
            Fluxiflow keeps the important parts of agency work connected, so your team can spend less time managing the work and more time doing it.
          </Typography>
        </Container>
      </Box>


      {/* ── SECTION 9: VISUAL PRODUCT MOMENT (One Cohesive Product Visual) ── */}
      <Container className="scroll-reveal-section" maxWidth="lg" sx={{ py: { xs: 10, md: 16 } }}>
        <Box sx={{ textAlign: 'center', mb: 8, maxWidth: '640px', mx: 'auto' }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', mb: 2 }}>PRODUCT VISUALIZATION</Typography>
          <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: '32px', md: '44px' }, letterSpacing: '-1.5px', mb: 2.5 }}>This is the system behind the flow</Typography>
        </Box>

        {/* Premium Overall Workspace Snapshot Mockup */}
        <Box 
          sx={{ 
            position: 'relative', 
            width: '100%',
            maxWidth: '1020px',
            mx: 'auto',
            border: '1.5px solid rgba(0,0,0,0.06)',
            borderRadius: '24px', 
            overflow: 'hidden',
            bgcolor: '#ffffff',
            boxShadow: '0 40px 90px rgba(0,0,0,0.05)'
          }}
        >
          {/* Header Mockup */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ef4444' }} />
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#eab308' }} />
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#22c55e' }} />
            <Box sx={{ flexGrow: 1, bgcolor: '#f4f4f5', py: 0.5, px: 2, borderRadius: '6px', display: 'flex', alignItems: 'center', ml: 2, maxWidth: '280px' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '10px' }}>fluxiflow.agency/app/tasks</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '200px 1fr' }, gap: { xs: 2, md: 3 }, p: { xs: 1.5, sm: 3 }, textAlign: 'left' }}>
            {/* Sidebar */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: '#f8fafc', borderRadius: '12px', border: '1.5px solid rgba(0,0,0,0.03)' }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>AF</Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '12px' }}>Ahmed Al-Fayed</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textTransform: 'uppercase', fontSize: '8px', fontWeight: 800 }}>Developer</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, bgcolor: '#f4f4f5', borderRadius: '8px' }}>
                  <TrendingUp size={14} />
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12px' }}>Workspace</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, color: 'text.secondary', borderRadius: '8px' }}>
                  <Folder size={14} />
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px' }}>My Projects</Typography>
                </Box>
              </Box>
            </Box>

            {/* Main pane mockup */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Assigned Deliverables</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>4 tasks remaining</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ p: { xs: 1.5, sm: 2 }, border: '1px solid rgba(0,0,0,0.04)', borderRadius: '14px', bgcolor: '#f8fafc', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: { xs: 1.5, sm: 0 } }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 750, fontSize: '13px' }}>Implement API connections</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>Website Redesign • Due Today</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#eab308', bgcolor: 'rgba(234,179,8,0.1)', px: 1.5, py: 0.2, borderRadius: '4px', fontSize: '9px', alignSelf: { xs: 'flex-start', sm: 'center' } }}>TODAY</Typography>
                </Box>
                <Box sx={{ p: { xs: 1.5, sm: 2 }, border: '1px solid rgba(0,0,0,0.04)', borderRadius: '14px', bgcolor: '#f8fafc', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: { xs: 1.5, sm: 0 } }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 750, fontSize: '13px' }}>Run end-to-end user tests</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>Website Redesign • Due Aug 20</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#3b82f6', bgcolor: 'rgba(59,130,246,0.1)', px: 1.5, py: 0.2, borderRadius: '4px', fontSize: '9px', alignSelf: { xs: 'flex-start', sm: 'center' } }}>UPCOMING</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>


      {/* ── SECTION 10: LARGE BRAND STATEMENT ── */}
      <Container className="scroll-reveal-section" maxWidth="lg" sx={{ py: 14, textAlign: 'center' }}>
        <Typography 
          variant="h2" 
          sx={{ 
            fontWeight: 900, 
            fontSize: { xs: '38px', sm: '60px', md: '78px' }, 
            letterSpacing: '-2.5px', 
            lineHeight: 1.1,
            color: '#0f172a',
            maxWidth: '920px',
            mx: 'auto'
          }}
        >
          Less management.<br />More momentum.
        </Typography>
      </Container>


      {/* ── SECTION 11: FINAL CTA + ATMOSPHERIC IMAGE ── */}
      <Container className="scroll-reveal-section" maxWidth="lg" sx={{ pb: 8 }}>
        <Box 
          sx={{ 
            bgcolor: '#0f172a', 
            color: '#ffffff', 
            borderRadius: '40px', 
            py: { xs: 6, sm: 8, md: 12 }, 
            px: { xs: 2.5, sm: 4, md: 8 }, 
            textAlign: 'center', 
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Neoclassical Business Image Background Overlay */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.12, zIndex: 0 }}>
            <img 
              src="/fluxiflow_final_cta.png" 
              alt="Fluxiflow Business" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
            />
          </Box>

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h3" sx={{ fontWeight: 900, fontSize: { xs: '30px', md: '50px' }, letterSpacing: '-1.5px', mb: 3 }}>
              Bring your agency into one flow.
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)', maxWidth: '520px', mx: 'auto', mb: 5, fontSize: '15px' }}>
              Projects, people, progress and everything in between — together in Fluxiflow.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2.5 }}>
              <Button 
                onClick={() => handleNav('/login')}
                variant="contained" 
                sx={{ 
                  bgcolor: '#ffffff', 
                  color: '#0f172a', 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  fontSize: '14px',
                  borderRadius: '100px', 
                  px: 4.5, 
                  py: 1.6,
                  '&:hover': { bgcolor: '#f4f4f5' } 
                }}
              >
                Get Started
              </Button>
              <Button 
                onClick={() => handleNav('/login')}
                variant="outlined" 
                sx={{ 
                  borderColor: 'rgba(255, 255, 255, 0.25)', 
                  color: '#ffffff', 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  fontSize: '14px',
                  borderRadius: '100px', 
                  px: 4.5, 
                  py: 1.6,
                  '&:hover': { borderColor: '#ffffff', bgcolor: 'transparent' } 
                }}
              >
                Log In
              </Button>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* FOOTER */}
      <Box sx={{ bgcolor: '#0f172a', color: 'rgba(255,255,255,0.6)', py: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FluxiflowLogo height={42} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', maxWidth: '280px', lineHeight: 1.6, fontSize: '13px' }}>
                Fluxiflow is a premium platform for managing agency projects, tasks, capacity, and reporting in absolute delivery flow.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 4 }}>
              <Typography onClick={() => handleNav('/')} sx={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', '&:hover': { color: '#ffffff' } }}>Home</Typography>
              <Typography onClick={() => handleNav('/landing')} sx={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', '&:hover': { color: '#ffffff' } }}>Features</Typography>
              <Typography onClick={() => handleNav('/login')} sx={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', '&:hover': { color: '#ffffff' } }}>Login</Typography>
            </Box>
          </Box>
          <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', mt: 6, pt: 4, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
              &copy; {new Date().getFullYear()} Fluxiflow. All rights reserved. Built for professional agency workspaces.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};
