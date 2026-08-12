import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FluxiflowLogo } from '../components/common/FluxiflowLogo';
import { FluxiflowNavbar } from '../components/common/FluxiflowNavbar';
import { 
  ArrowRight, 
  Check, 
  TrendingUp, 
  Folder, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet, 
  Activity, 
  Bell,
  Shield,
  Sparkles
} from 'lucide-react';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  IconButton, 
  Tabs, 
  Tab, 
  Card,
  LinearProgress,
  Divider
} from '@mui/material';

import { initSmoothScroll } from '../lib/animations/smoothScroll';
import { playHeroEntrance, initMagneticButtons } from '../lib/animations/heroAnimations';
import { initSectionAnimations } from '../lib/animations/sectionAnimations';
import { gsap } from 'gsap';

// ── SUB-COMPONENT: Futuristic 3D Sculptural Ribbon/Torus SVG ──
const FuturisticSculpture: React.FC<{ colorTheme?: 'light' | 'dark'; size?: number }> = ({ colorTheme = 'light', size = 300 }) => {
  const isDark = colorTheme === 'dark';
  return (
    <Box sx={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="100%" height="100%" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0px 25px 35px rgba(0,0,0,0.15))' }}>
        <defs>
          <radialGradient id="sculptureGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={isDark ? '#3b82f6' : '#93c5fd'} stopOpacity="0.25" />
            <stop offset="100%" stopColor={isDark ? '#000000' : '#ffffff'} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sculptureGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#ffffff' : '#000000'} />
            <stop offset="35%" stopColor={isDark ? '#e4e4e7' : '#27272a'} />
            <stop offset="65%" stopColor={isDark ? '#a1a1aa' : '#71717a'} />
            <stop offset="100%" stopColor={isDark ? '#3b82f6' : '#bfdbfe'} />
          </linearGradient>
          <linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.4)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
          </linearGradient>
          <filter id="blurFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Ambient Glow */}
        <circle cx="100" cy="100" r="80" fill="url(#sculptureGlow)" />

        {/* Main Ribbon Loop 1 */}
        <path 
          d="M 50 100 C 50 40, 150 40, 150 100 C 150 160, 50 160, 50 100 Z" 
          stroke="url(#sculptureGradient)" 
          strokeWidth="12" 
          strokeLinecap="round"
          strokeDasharray="400"
          strokeDashoffset="0"
          style={{
            animation: 'dash 15s linear infinite, rotate 30s linear infinite',
            transformOrigin: '100px 100px'
          }}
        />

        {/* Inner Futuristic Ring (Frosted Glass Effect) */}
        <circle 
          cx="100" 
          cy="100" 
          r="45" 
          stroke="url(#glassGradient)" 
          strokeWidth="8" 
          fill="none" 
          filter="url(#blurFilter)" 
          style={{ opacity: 0.8 }}
        />
        <circle 
          cx="100" 
          cy="100" 
          r="45" 
          stroke={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.15)'} 
          strokeWidth="1.5" 
          fill="none"
        />

        {/* Center Floating Core */}
        <circle 
          cx="100" 
          cy="100" 
          r="12" 
          fill={isDark ? '#ffffff' : '#000000'}
          style={{
            animation: 'float 4s ease-in-out infinite'
          }}
        />
      </svg>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
};

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const isDark = false;
  const [taskTab, setTaskTab] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const navbarRef = useRef<HTMLDivElement>(null);

  // Dynamic Document Title and SEO configuration + Animation Initializations
  useEffect(() => {
    document.title = "Fluxiflow for Agency — Project Management for Modern Agencies";
    const metaDescription = document.querySelector('meta[name="description"]');
    const descContent = "Fluxiflow is a simple project and team management platform built for modern agencies to manage projects, tasks, workload, reports, and team progress.";
    if (metaDescription) {
      metaDescription.setAttribute('content', descContent);
    } else {
      const meta = document.createElement('meta');
      meta.name = "description";
      meta.content = descContent;
      document.head.appendChild(meta);
    }

    // 1. Initialize Lenis Smooth Scroll
    const { destroy: destroyScroll } = initSmoothScroll();

    // 2. Play Hero entrance
    const heroCtx = playHeroEntrance(containerRef, navbarRef);

    // 3. Initialize desktop magnetic buttons
    const destroyMagnetic = initMagneticButtons();

    // 4. Initialize ScrollTrigger animations for all sections
    const destroySections = initSectionAnimations(containerRef);

    // 5. Navbar Scroll response
    const navbarCtx = gsap.context(() => {
      gsap.to('.navbar-box', {
        scrollTrigger: {
          trigger: 'body',
          start: 'top+=50 top',
          toggleActions: 'play none none reverse',
        },
        paddingTop: '8px',
        paddingBottom: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: 'rgba(0, 0, 0, 0.12)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.06)',
        duration: 0.3,
        ease: 'power2.out'
      });
    }, containerRef);

    return () => {
      destroyScroll();
      heroCtx.revert();
      destroyMagnetic();
      destroySections();
      navbarCtx.revert();
    };
  }, []);

  const handleNav = (path: string) => {
    navigate(path);
  };

  // Mock task data structured for landing demonstration
  const demoTasks = [
    // Today
    [
      { name: 'Review website wireframes', project: 'Website Redesign', priority: 'HIGH', status: 'PENDING', date: 'Today', dateColor: '#eab308' },
      { name: 'Draft Instagram posts copy', project: 'Social Campaign', priority: 'MEDIUM', status: 'PENDING', date: 'Today', dateColor: '#eab308' },
    ],
    // Pending
    [
      { name: 'Design hero section banner', project: 'Website Redesign', priority: 'HIGH', status: 'PENDING', date: 'Yesterday', dateColor: '#ef4444' },
      { name: 'Setup React Router & Tailwind', project: 'Website Redesign', priority: 'MEDIUM', status: 'PENDING', date: 'Tomorrow', dateColor: '#22c55e' },
    ],
    // Upcoming
    [
      { name: 'Q3 Content Strategy Alignment', project: 'Social Campaign', priority: 'LOW', status: 'PENDING', date: '18 Aug', dateColor: '#71717a' },
      { name: 'Shopify API Credential Setup', project: 'E-Commerce Project', priority: 'HIGH', status: 'PENDING', date: '20 Aug', dateColor: '#71717a' },
    ],
    // Completed
    [
      { name: 'Create style guide and colors', project: 'Website Redesign', priority: 'MEDIUM', status: 'COMPLETED', date: 'Yesterday', dateColor: '#22c55e' },
      { name: 'Setup database schema config', project: 'E-Commerce Project', priority: 'HIGH', status: 'COMPLETED', date: '2 days ago', dateColor: '#22c55e' },
    ]
  ];

  const allTasks = [...demoTasks[0], ...demoTasks[1], ...demoTasks[2], ...demoTasks[3]];
  const activeTasksList = taskTab === 0 ? allTasks : demoTasks[taskTab - 1];

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        bgcolor: 'background.default', 
        color: 'text.primary', 
        minHeight: '100vh', 
        transition: 'background-color 0.3s cubic-bezier(0.16, 1, 0.3, 1), color 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        overflowX: 'hidden'
      }}
    >
      
      {/* ── BACKGROUND ATMOSPHERIC GRADIENTS (Futuristic Studio Lighting) ── */}
      <Box 
        sx={{ 
          position: 'absolute', 
          top: 0, 
          left: '50%', 
          transform: 'translateX(-50%)',
          width: '100%', 
          maxWidth: '1400px', 
          height: '800px', 
          background: isDark
            ? 'radial-gradient(circle 600px at 50% -100px, rgba(37, 99, 235, 0.15), rgba(0,0,0,0))'
            : 'radial-gradient(circle 600px at 50% -100px, rgba(147, 197, 253, 0.22), rgba(255,255,255,0))',
          zIndex: 0,
          pointerEvents: 'none'
        }}
      />

      {/* Shared Navigation Bar */}
      <FluxiflowNavbar navbarRef={navbarRef} />


      {/* ── SECTION 1: HERO (Clean Minimal Editorial) ── */}
      <Container 
        maxWidth="lg" 
        sx={{ 
          pt: { xs: 12, md: 20 }, 
          pb: { xs: 12, md: 20 }, 
          px: 3, 
          position: 'relative', 
          zIndex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center' 
        }}
      >
        <Box 
          className="hero-container"
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            textAlign: 'center', 
            mb: { xs: 10, md: 14 },
            maxWidth: '960px'
          }}
        >
          {/* Eyebrow / Pill */}
          <Box 
            className="hero-eyebrow"
            sx={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 1, 
              mb: 4, 
              px: 2.5, 
              py: 1, 
              borderRadius: '100px', 
              border: '1px solid', 
              borderColor: 'rgba(0,0,0,0.08)', 
              bgcolor: 'rgba(0,0,0,0.02)' 
            }}
          >
            <Sparkles size={13} style={{ color: '#3b82f6' }} />
            <Typography 
              variant="caption" 
              sx={{ 
                fontWeight: 800, 
                letterSpacing: '1.5px', 
                textTransform: 'uppercase', 
                color: 'text.secondary',
                fontSize: '11px'
              }}
            >
              PROJECT MANAGEMENT FOR MODERN AGENCIES
            </Typography>
          </Box>
          
          {/* Headline */}
          <Typography 
            variant="h1" 
            className="hero-headline"
            sx={{ 
              fontWeight: 900, 
              fontSize: { xs: '48px', sm: '68px', md: '94px' }, 
              lineHeight: 1.05,
              letterSpacing: '-3.5px',
              color: 'text.primary',
              maxWidth: '920px',
              mb: 4
            }}
          >
            Your agency's work,<br />finally in one flow.
          </Typography>

          {/* Description */}
          <Typography 
            variant="body1" 
            className="hero-description"
            sx={{ 
              fontSize: { xs: '16px', sm: '20px', md: '22px' }, 
              color: 'text.secondary',
              maxWidth: '720px',
              lineHeight: 1.6,
              mb: 6,
              fontWeight: 500
            }}
          >
            Fluxiflow brings projects, tasks, people, progress, and reporting into one simple workspace built for agency teams.
          </Typography>

          {/* CTA Buttons */}
          <Box 
            className="hero-cta-group"
            sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              justifyContent: 'center', 
              gap: 3 
            }}
          >
            <Button 
              onClick={() => handleNav('/login')}
              variant="contained"
              className="magnetic-btn-primary"
              sx={{ 
                py: 2.2, 
                px: 5.5, 
                fontSize: '15px', 
                fontWeight: 700, 
                borderRadius: '100px',
                bgcolor: '#000000',
                color: '#ffffff',
                boxShadow: 'none',
                transition: 'background-color 0.2s, transform 0.1s',
                '&:hover': { bgcolor: '#27272a', boxShadow: 'none' }
              }}
            >
              Get Started
            </Button>
            <Button 
              onClick={() => handleNav('/login')}
              variant="outlined"
              className="magnetic-btn-secondary"
              sx={{ 
                py: 2.2, 
                px: 5.5, 
                fontSize: '15px', 
                fontWeight: 700, 
                borderRadius: '100px',
                borderColor: 'rgba(0, 0, 0, 0.15)',
                color: '#000000',
                transition: 'border-color 0.2s, background-color 0.2s, transform 0.1s',
                '&:hover': { borderColor: '#000000', bgcolor: 'transparent' }
              }}
            >
              Log In
            </Button>
          </Box>
        </Box>

        {/* Dashboard Visual Frame: Centered, Flat, Crisp, Softly Elevated */}
        <Box 
          className="hero-dashboard"
          sx={{ 
            position: 'relative', 
            zIndex: 1, 
            width: '100%',
            maxWidth: '1080px',
            border: '1px solid', 
            borderColor: 'rgba(0,0,0,0.08)', 
            borderRadius: '24px', 
            overflow: 'hidden',
            bgcolor: '#ffffff',
            boxShadow: '0 45px 90px rgba(0,0,0,0.06), 0 0 40px rgba(0,0,0,0.02)',
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s',
            '&:hover': {
              transform: 'translateY(-6px)',
              boxShadow: '0 55px 110px rgba(0,0,0,0.09), 0 0 50px rgba(0,0,0,0.03)'
            }
          }}
        >
          {/* Window controls bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ef4444' }} />
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#eab308' }} />
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#22c55e' }} />
            <Box sx={{ flexGrow: 1, bgcolor: '#f4f4f5', py: 0.5, px: 2, borderRadius: '6px', display: 'flex', alignItems: 'center', ml: 2, maxWidth: '280px' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '10px' }}>fluxiflow.agency/app/dashboard</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, gap: { xs: 2, md: 3 }, p: { xs: 1.5, sm: 3 }, textAlign: 'left' }}>
            {/* Sidebar */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: '#ffffff', borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>MS</Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '12.5px' }}>Muhammed Shamil</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textTransform: 'uppercase', fontSize: '8px', fontWeight: 800 }}>Admin/Manager</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, bgcolor: '#f4f4f5', borderRadius: '8px' }}>
                  <TrendingUp size={15} />
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '13px' }}>Tasks</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, color: 'text.secondary', borderRadius: '8px' }}>
                  <Folder size={15} />
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px' }}>Projects</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, color: 'text.secondary', borderRadius: '8px' }}>
                  <Users size={15} />
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px' }}>Team Health</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, color: 'text.secondary', borderRadius: '8px' }}>
                  <FileSpreadsheet size={15} />
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px' }}>Reports</Typography>
                </Box>
              </Box>
            </Box>

            {/* Workspace Mock Content */}
            <Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>Workspace Overview</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '13px' }}>Fictional summary of active client deliverables.</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{ px: 2, py: 0.8, border: '1px solid', borderColor: 'divider', borderRadius: '8px', textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>Projects</Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>3 Active</Typography>
                  </Box>
                  <Box sx={{ px: 2, py: 0.8, border: '1px solid', borderColor: 'divider', borderRadius: '8px', textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>Tasks Done</Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#22c55e' }}>28 Completed</Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.1fr 0.9fr' }, gap: 3 }}>
                {/* Left: Workload */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '10px' }}>Team Health & Workload</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
                    <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '13px' }}>Sarah Thomas</Typography>
                        <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 800, fontSize: '11px' }}>92% Healthy</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={92} sx={{ height: 5, borderRadius: 3, bgcolor: '#e4e4e7', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }} />
                    </Box>
                    <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '13px' }}>Ahmed Ali</Typography>
                        <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 800, fontSize: '11px' }}>87% Healthy</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={87} sx={{ height: 5, borderRadius: 3, bgcolor: '#e4e4e7', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }} />
                    </Box>
                    <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '13px' }}>Maya Lin</Typography>
                        <Typography variant="caption" sx={{ color: '#eab308', fontWeight: 800, fontSize: '11px' }}>68% Heavy Load</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={68} sx={{ height: 5, borderRadius: 3, bgcolor: '#e4e4e7', '& .MuiLinearProgress-bar': { bgcolor: '#eab308' } }} />
                    </Box>
                  </Box>
                </Box>

                {/* Right: Tasks */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '10px' }}>Current Priorities</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: '10px', borderLeft: '3px solid #ef4444' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12.5px' }}>Design hero section banner</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px' }}>Website Redesign • Due Yesterday</Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', fontSize: '8px' }}>Overdue</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: '10px', borderLeft: '3px solid #eab308' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12.5px' }}>Review website wireframes</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px' }}>Website Redesign • Due Today</Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#eab308', fontWeight: 800, textTransform: 'uppercase', fontSize: '8px' }}>Today</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>


      {/* ── SECTION 2: PRODUCT INTRODUCTION (Editorial Showcase) ── */}
      <Box sx={{ borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', py: { xs: 10, md: 16 }, position: 'relative' }}>
        <Container maxWidth="lg" sx={{ px: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '6fr 6fr' }, gap: { xs: 6, md: 10 }, alignItems: 'center' }}>
            
            <Box className="why-fluxiflow-text">
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 800, 
                  letterSpacing: '2px', 
                  textTransform: 'uppercase', 
                  color: 'text.secondary',
                  display: 'block',
                  mb: 2.5
                }}
              >
                WHY FLUXIFLOW
              </Typography>
              <Typography 
                variant="h2" 
                sx={{ 
                  fontWeight: 900, 
                  fontSize: { xs: '34px', sm: '46px', md: '58px' }, 
                  lineHeight: 1.1,
                  letterSpacing: '-2px',
                  color: 'text.primary',
                  mb: 4
                }}
              >
                Your team doesn't need more complexity.
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  fontSize: { xs: '17px', md: '19px' }, 
                  lineHeight: 1.6,
                  color: 'text.secondary',
                  mb: 4.5
                }}
              >
                Projects, tasks, people, and progress stay connected in one focused workspace designed around how agencies actually work. No layers of administrative noise — just pure momentum.
              </Typography>
              <Button 
                component="a"
                href="#how-it-works"
                sx={{ 
                  textTransform: 'none', 
                  fontSize: '15px', 
                  fontWeight: 700, 
                  color: 'text.primary',
                  p: 0,
                  '&:hover': { bgcolor: 'transparent', opacity: 0.8 },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                Explore how it works <ArrowRight size={17} />
              </Button>
            </Box>

            {/* Futuristic 3D Sculptural Visual Side composition */}
            <Box className="why-fluxiflow-sculpture" sx={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
              {/* Back ambient lighting plate */}
              <Box sx={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: isDark ? 'radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(147,197,253,0.15) 0%, transparent 70%)', filter: 'blur(30px)' }} />
              <FuturisticSculpture colorTheme={isDark ? 'dark' : 'light'} size={320} />
            </Box>
          </Box>

          {/* Three Core Ideas Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 4, mt: { xs: 10, md: 14 } }}>
            {/* Card 1 */}
            <Card className="core-idea-card" sx={{ p: { xs: 3, md: 5 }, borderRadius: '24px', border: '1px solid', borderColor: 'divider', bgcolor: 'transparent', boxShadow: 'none', display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, fontSize: '32px', color: 'text.secondary', opacity: 0.15 }}>01</Typography>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.5, letterSpacing: '-0.5px' }}>Everything in Flow</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, fontSize: '13.5px' }}>
                  Projects, tasks, people, and progress stay connected instead of scattered across disconnected interfaces.
                </Typography>
              </Box>
            </Card>
            {/* Card 2 */}
            <Card className="core-idea-card" sx={{ p: { xs: 3, md: 5 }, borderRadius: '24px', border: '1px solid', borderColor: 'divider', bgcolor: 'transparent', boxShadow: 'none', display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, fontSize: '32px', color: 'text.secondary', opacity: 0.15 }}>02</Typography>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.5, letterSpacing: '-0.5px' }}>Clear Ownership</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, fontSize: '13.5px' }}>
                  Everyone knows exactly what they need to work on and what comes next. No administrative confusion.
                </Typography>
              </Box>
            </Card>
            {/* Card 3 */}
            <Card className="core-idea-card" sx={{ p: { xs: 3, md: 5 }, borderRadius: '24px', border: '1px solid', borderColor: 'divider', bgcolor: 'transparent', boxShadow: 'none', display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, fontSize: '32px', color: 'text.secondary', opacity: 0.15 }}>03</Typography>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.5, letterSpacing: '-0.5px' }}>Visible Progress</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, fontSize: '13.5px' }}>
                  Managers evaluate active workloads, task compliance, team health, and daily performance metrics at a glance.
                </Typography>
              </Box>
            </Card>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 3: TASK MANAGEMENT SHOWCASE ── */}
      <Box id="features" sx={{ py: { xs: 10, md: 16 } }}>
        <Container maxWidth="lg" sx={{ px: 3 }}>
          <Box sx={{ mb: 7 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'text.secondary', mb: 2, display: 'block' }}>
              TASKS
            </Typography>
            <Typography variant="h2" className="tasks-heading" sx={{ fontWeight: 900, fontSize: { xs: '34px', sm: '46px', md: '58px' }, letterSpacing: '-2px', color: 'text.primary', mb: 3 }}>
              From what's next to what's done.
            </Typography>
          </Box>

          <Card className="tasks-card-container" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '32px', p: { xs: 2, sm: 3, md: 5 }, bgcolor: 'transparent', boxShadow: 'none', position: 'relative', overflow: 'hidden' }}>
            {/* Background design glow */}
            <Box sx={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: '50%', background: isDark ? 'radial-gradient(circle, rgba(37,99,235,0.05) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(147,197,253,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 4.5, position: 'relative', zIndex: 1 }}>
              <Tabs 
                value={taskTab} 
                onChange={(_, val) => setTaskTab(val)}
                textColor="inherit"
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  '& .MuiTabs-indicator': {
                    backgroundColor: isDark ? '#ffffff' : '#000000',
                    height: 2.5
                  },
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '14.5px',
                    minWidth: 'auto',
                    px: 3,
                    color: 'text.secondary',
                    '&.Mui-selected': {
                      color: 'text.primary'
                    }
                  }
                }}
              >
                <Tab label="All" />
                <Tab label="Today" />
                <Tab label="Pending" />
                <Tab label="Upcoming" />
                <Tab label="Completed" />
              </Tabs>
            </Box>

            {/* List entries */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative', zIndex: 1 }}>
              {activeTasksList.map((task, index) => (
                <Box 
                  key={index} 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' }, 
                    justifyContent: 'space-between', 
                    p: { xs: 2, md: 2.8 }, 
                    gap: { xs: 2.5, sm: 0 },
                    border: '1px solid', 
                    borderColor: 'divider', 
                    borderRadius: '16px',
                    bgcolor: isDark ? 'rgba(8,8,8,0.7)' : 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(10px)',
                    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      borderColor: 'text.primary'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3.5 } }}>
                    <IconButton 
                      size="small" 
                      disabled 
                      sx={{ 
                        border: '2px solid', 
                        borderColor: task.status === 'COMPLETED' ? '#22c55e' : 'divider',
                        bgcolor: task.status === 'COMPLETED' ? 'rgba(34,197,94,0.1)' : 'transparent',
                        color: task.status === 'COMPLETED' ? '#22c55e' : 'transparent',
                        p: 0.6
                      }}
                    >
                      <Check size={13} />
                    </IconButton>
                    <Box>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontWeight: 700, 
                          textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none',
                          color: task.status === 'COMPLETED' ? 'text.secondary' : 'text.primary',
                          fontSize: '15px'
                        }}
                      >
                        {task.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.8 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{task.project}</Typography>
                        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'divider' }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, color: task.priority === 'HIGH' ? '#ef4444' : task.priority === 'MEDIUM' ? '#eab308' : 'text.secondary', fontSize: '10px', textTransform: 'uppercase' }}>
                          {task.priority} Priority
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ px: 2.2, py: 0.8, borderRadius: '100px', border: '1px solid', borderColor: 'divider', bgcolor: isDark ? '#121212' : '#f4f4f5' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: task.dateColor, fontSize: '11px' }}>
                      {task.date}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Card>
        </Container>
      </Box>


      {/* ── SECTION 4: PROJECT MANAGEMENT ── */}
      <Box sx={{ py: { xs: 10, md: 16 }, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ px: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' }, gap: { xs: 6, md: 10 }, alignItems: 'center' }}>
            
            {/* Visual Panel */}
            <Box 
              className="project-visual-card"
              sx={{ 
                p: { xs: 2.5, md: 5 }, 
                border: '1px solid', 
                borderColor: 'divider', 
                borderRadius: '32px', 
                bgcolor: isDark ? '#050505' : '#fafafa',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <Box sx={{ position: 'absolute', bottom: -50, right: -50, width: 220, height: 220, borderRadius: '50%', background: isDark ? 'radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(0,0,0,0.015) 0%, transparent 70%)', pointerEvents: 'none' }} />

              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: '10px', display: 'block', mb: 3 }}>
                Active Project Status
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4.5 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>Website Redesign</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '13px', mt: 0.5 }}>Corporate website redesign and redevelopment.</Typography>
                </Box>
                <Box sx={{ bgcolor: 'rgba(34,197,94,0.08)', color: '#22c55e', px: 2, py: 0.5, borderRadius: '100px', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '11px' }}>In Progress</Typography>
                </Box>
              </Box>

              <Box className="project-progress-container" sx={{ mb: 4.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '13.5px' }}>Overall Progress</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '13.5px' }}>68% Complete</Typography>
                </Box>
                <LinearProgress className="project-progress-bar" variant="determinate" value={68} sx={{ height: 6, borderRadius: 3, bgcolor: isDark ? '#27272a' : '#e4e4e7', '& .MuiLinearProgress-bar': { bgcolor: isDark ? '#ffffff' : '#000000' } }} />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
                <Box sx={{ p: { xs: 2, md: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: '16px', bgcolor: isDark ? '#121212' : '#ffffff' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10.5px', fontWeight: 600 }}>Completed Tasks</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>14</Typography>
                </Box>
                <Box sx={{ p: { xs: 2, md: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: '16px', bgcolor: isDark ? '#121212' : '#ffffff' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10.5px', fontWeight: 600 }}>Pending Tasks</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>6</Typography>
                </Box>
              </Box>
            </Box>

            {/* Content text */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'text.secondary', mb: 2, display: 'block' }}>
                PROJECTS
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: '34px', sm: '46px', md: '58px' }, letterSpacing: '-2px', color: 'text.primary', mb: 3.5 }}>
                Every project.<br />One clear flow.
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '17.5px', color: 'text.secondary', lineHeight: 1.6 }}>
                Create projects, organize their work, and see exactly what is happening without adding unnecessary layers of management. Every project gives you immediate insight into timelines, active workloads, and completion rates.
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 5: TEAM HEALTH ── */}
      <Box id="team" sx={{ py: { xs: 10, md: 16 } }}>
        <Container maxWidth="lg" sx={{ px: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' }, gap: { xs: 6, md: 10 }, alignItems: 'center' }}>
            {/* Left info */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'text.secondary', mb: 2, display: 'block' }}>
                TEAM HEALTH
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: '34px', sm: '46px', md: '58px' }, letterSpacing: '-2px', color: 'text.primary', mb: 3.5 }}>
                See where your team needs attention.
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '17.5px', color: 'text.secondary', lineHeight: 1.6, mb: 4 }}>
                Fluxiflow turns task activity and workload into a simple health score for every team member. Managers identify burn-out risks and optimize task assignments instantly.
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 600 }}>
                * Health metrics are calculated automatically from task due times, workloads, and completions.
              </Typography>
            </Box>

            {/* Right Stack */}
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '32px', p: { xs: 2, sm: 3, md: 5 }, bgcolor: isDark ? '#050505' : '#fafafa' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Sarah */}
                <Box className="team-member-card" sx={{ p: { xs: 2, md: 3 }, border: '1px solid', borderColor: 'divider', borderRadius: '18px', bgcolor: isDark ? '#121212' : '#ffffff' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 850, fontSize: '16px' }}>Sarah Thomas</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px' }}>Lead UX Designer</Typography>
                    </Box>
                    <Box sx={{ bgcolor: 'rgba(34,197,94,0.08)', color: '#22c55e', px: 2, py: 0.5, borderRadius: '100px', border: '1px solid rgba(34,197,94,0.15)' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '11px' }}>92% Healthy</Typography>
                    </Box>
                  </Box>
                  <LinearProgress className="team-health-bar" aria-valuenow={92} variant="determinate" value={92} sx={{ height: 5, borderRadius: 3, mb: 2.5, bgcolor: isDark ? '#27272a' : '#e4e4e7', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10.5px' }}>Completed</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>12</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10.5px' }}>Today</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>2</Typography>
                    </Box>
                    <Box sx={{ gridColumn: { xs: 'span 2', sm: 'auto' } }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10.5px' }}>Overdue</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary' }}>0</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Ahmed */}
                <Box className="team-member-card" sx={{ p: { xs: 2, md: 3 }, border: '1px solid', borderColor: 'divider', borderRadius: '18px', bgcolor: isDark ? '#121212' : '#ffffff' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 850, fontSize: '16px' }}>Ahmed Ali</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px' }}>Front-end Developer</Typography>
                    </Box>
                    <Box sx={{ bgcolor: 'rgba(34,197,94,0.08)', color: '#22c55e', px: 2, py: 0.5, borderRadius: '100px', border: '1px solid rgba(34,197,94,0.15)' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '11px' }}>84% Healthy</Typography>
                    </Box>
                  </Box>
                  <LinearProgress className="team-health-bar" aria-valuenow={84} variant="determinate" value={84} sx={{ height: 5, borderRadius: 3, mb: 2.5, bgcolor: isDark ? '#27272a' : '#e4e4e7', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10.5px' }}>Completed</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>8</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10.5px' }}>Today</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>1</Typography>
                    </Box>
                    <Box sx={{ gridColumn: { xs: 'span 2', sm: 'auto' } }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10.5px' }}>Overdue</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary' }}>0</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Maya */}
                <Box className="team-member-card" sx={{ p: { xs: 2, md: 3 }, border: '1px solid', borderColor: 'divider', borderRadius: '18px', bgcolor: isDark ? '#121212' : '#ffffff' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 850, fontSize: '16px' }}>Maya Lin</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px' }}>Content Strategist</Typography>
                    </Box>
                    <Box sx={{ bgcolor: 'rgba(234,179,8,0.08)', color: '#eab308', px: 2, py: 0.5, borderRadius: '100px', border: '1px solid rgba(234,179,8,0.15)' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '11px' }}>68% Needs Attention</Typography>
                    </Box>
                  </Box>
                  <LinearProgress className="team-health-bar" aria-valuenow={68} variant="determinate" value={68} sx={{ height: 5, borderRadius: 3, mb: 2.5, bgcolor: isDark ? '#27272a' : '#e4e4e7', '& .MuiLinearProgress-bar': { bgcolor: '#eab308' } }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10.5px' }}>Completed</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>5</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10.5px' }}>Today</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>3</Typography>
                    </Box>
                    <Box sx={{ gridColumn: { xs: 'span 2', sm: 'auto' } }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10.5px' }}>Overdue</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#ef4444' }}>2</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 6: LATE SUBMISSION ── */}
      <Box sx={{ py: { xs: 10, md: 16 }, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', bgcolor: isDark ? 'transparent' : '#fcfcfc' }}>
        <Container maxWidth="lg" sx={{ px: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 6, alignItems: 'center' }}>
            {/* Visual preview */}
            <Box sx={{ p: { xs: 2.5, md: 4.5 }, border: '1px solid', borderColor: 'divider', borderRadius: '28px', bgcolor: isDark ? '#050505' : '#ffffff', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.5px' }}>TASK: homepage-redesign-v2</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(239,68,68,0.08)', px: 2, py: 0.5, borderRadius: '100px', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <AlertTriangle className="compliance-warning-icon" size={12} color="#ef4444" />
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#ef4444', fontSize: '10px' }}>LATE SUBMISSION</Typography>
                </Box>
              </Box>
              
              <Divider />
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>Due Date:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Yesterday at 18:00</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>Completed:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Today at 10:45</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>Late Compliance:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#ef4444' }}>Late by 1 day</Typography>
                </Box>
              </Box>
            </Box>

            {/* Content text */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'text.secondary', mb: 2, display: 'block' }}>
                DEADLINE COMPLIANCE
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: '34px', sm: '46px', md: '58px' }, letterSpacing: '-2px', color: 'text.primary', mb: 3.5 }}>
                Late work shouldn't stay invisible.
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '17.5px', color: 'text.secondary', lineHeight: 1.6 }}>
                Fluxiflow tracks work completed after its deadline and reflects late submissions across team health, reports, activity logs, and notifications. Every delay is quantified, ensuring absolute execution insight.
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 7: REPORTING SHOWCASE ── */}
      <Box id="reports" sx={{ py: { xs: 10, md: 16 } }}>
        <Container maxWidth="lg" sx={{ px: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' }, gap: { xs: 6, md: 10 }, alignItems: 'center' }}>
            {/* Left details */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'text.secondary', mb: 2, display: 'block' }}>
                REPORTING
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: '34px', sm: '46px', md: '58px' }, letterSpacing: '-2px', color: 'text.primary', mb: 3.5 }}>
                Know exactly what happened.
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '17.5px', color: 'text.secondary', lineHeight: 1.6, mb: 4.5 }}>
                Review completed, pending, overdue, and late work for any member or date range. Fully structured, client-ready data format ready to download.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, border: '1px solid', borderColor: 'divider', px: 2.2, py: 1, borderRadius: '8px' }}>
                  <CheckCircle2 size={15} color="#22c55e" />
                  <Typography variant="caption" sx={{ fontWeight: 750 }}>Excel & CSV Export</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, border: '1px solid', borderColor: 'divider', px: 2.2, py: 1, borderRadius: '8px' }}>
                  <CheckCircle2 size={15} color="#22c55e" />
                  <Typography variant="caption" sx={{ fontWeight: 750 }}>PDF Client Audits</Typography>
                </Box>
              </Box>
            </Box>

            {/* Right Mockup */}
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '32px', p: { xs: 2, md: 4 }, bgcolor: isDark ? '#050505' : '#fafafa' }}>
              <Box sx={{ bgcolor: isDark ? 'rgba(8, 8, 8, 0.95)' : 'rgba(255, 255, 255, 0.95)', p: { xs: 2, md: 3 }, borderRadius: '20px', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '15px' }}>Agency Performance Report</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box sx={{ px: 1.5, py: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: '6px', cursor: 'pointer' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>Export CSV</Typography>
                    </Box>
                    <Box sx={{ px: 1.5, py: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: '6px', bgcolor: isDark ? '#ffffff' : '#000000', color: isDark ? '#000000' : '#ffffff', cursor: 'pointer' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>Download PDF</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 4 }}>
                  <Box sx={{ px: 1.8, py: 0.8, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Date: Aug 1 - Aug 11</Typography>
                  </Box>
                  <Box sx={{ px: 1.8, py: 0.8, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Member: All Team</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box className="report-row" sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Total Completed Tasks</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#22c55e' }}>48</Typography>
                  </Box>
                  <Box className="report-row" sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Tasks Submitted Late</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#ef4444' }}>4</Typography>
                  </Box>
                  <Box className="report-row" sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Active Projects</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>3</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 8: ACTIVITY & NOTIFICATIONS ── */}
      <Box sx={{ py: { xs: 10, md: 16 }, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', bgcolor: isDark ? 'transparent' : '#fcfcfc' }}>
        <Container maxWidth="lg" sx={{ px: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
            {/* Activity */}
            <Box className="activity-log-box" sx={{ p: { xs: 2.5, sm: 4, md: 5.5 }, border: '1px solid', borderColor: 'divider', borderRadius: '28px', bgcolor: isDark ? '#050505' : '#ffffff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8, mb: 3 }}>
                <Activity size={18} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Live Activity Log</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4.5, fontSize: '13.5px' }}>See the work behind the work.</Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.2 }}>
                <Box sx={{ display: 'flex', gap: 2.2 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22c55e', mt: 0.8 }} />
                  <Typography variant="body2" sx={{ lineHeight: 1.45, fontSize: '13.5px' }}><strong>Sarah Thomas</strong> completed the homepage design wireframes.</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2.2 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22c55e', mt: 0.8 }} />
                  <Typography variant="body2" sx={{ lineHeight: 1.45, fontSize: '13.5px' }}><strong>Ahmed Ali</strong> completed API client endpoint verification.</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2.2 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#ef4444', mt: 0.8 }} />
                  <Typography variant="body2" sx={{ lineHeight: 1.45, fontSize: '13.5px' }}><strong>Maya Lin</strong> submitted Q3 editorial calendar plan late.</Typography>
                </Box>
              </Box>
            </Box>

            {/* Notifications */}
            <Box className="notifications-box" sx={{ p: { xs: 2.5, sm: 4, md: 5.5 }, border: '1px solid', borderColor: 'divider', borderRadius: '28px', bgcolor: isDark ? '#050505' : '#ffffff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8, mb: 3 }}>
                <Bell size={18} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Instant Notifications</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4.5, fontSize: '13.5px' }}>Keep everyone in the loop.</Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '14px', bgcolor: isDark ? '#121212' : '#fafafa', display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TrendingUp size={15} color="#22c55e" />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '12px' }}>New task assigned</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10.5px' }}>Website Redesign • Assigned to Ahmed</Typography>
                  </Box>
                </Box>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '14px', bgcolor: isDark ? '#121212' : '#fafafa', display: 'flex', gap: 2, alignItems: 'center' }}>
                  <AlertTriangle size={15} color="#ef4444" />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '12px' }}>Task deadline approaching</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10.5px' }}>Hero Section Banner • Due in 2 hours</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 9: HOW IT WORKS (Horizontal Workflow Grid) ── */}
      <Box id="how-it-works" sx={{ py: { xs: 10, md: 16 } }}>
        <Container maxWidth="lg" sx={{ px: 3 }}>
          <Box sx={{ mb: 10, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'text.secondary', mb: 2, display: 'block' }}>
              WORKFLOW
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: '34px', sm: '46px', md: '58px' }, letterSpacing: '-2px', color: 'text.primary' }}>
              How Fluxiflow Works
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr 1fr' }, gap: 4, position: 'relative' }}>
            {/* Step 1 */}
            <Box className="how-it-works-step" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, fontSize: '56px', color: 'text.secondary', opacity: 0.15, lineHeight: 1 }}>01</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>CREATE PROJECT</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '13px', lineHeight: 1.5 }}>Organize client deliverables into clear pipelines.</Typography>
            </Box>
            {/* Step 2 */}
            <Box className="how-it-works-step" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, fontSize: '56px', color: 'text.secondary', opacity: 0.15, lineHeight: 1 }}>02</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>ADD TASKS</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '13px', lineHeight: 1.5 }}>Detail requirements and configure precise due dates.</Typography>
            </Box>
            {/* Step 3 */}
            <Box className="how-it-works-step" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, fontSize: '56px', color: 'text.secondary', opacity: 0.15, lineHeight: 1 }}>03</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>ASSIGN WORK</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '13px', lineHeight: 1.5 }}>Distribute tasks among multiple assignees cleanly.</Typography>
            </Box>
            {/* Step 4 */}
            <Box className="how-it-works-step" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, fontSize: '56px', color: 'text.secondary', opacity: 0.15, lineHeight: 1 }}>04</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>TRACK PROGRESS</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '13px', lineHeight: 1.5 }}>Monitor execution metrics and late submission logs.</Typography>
            </Box>
            {/* Step 5 */}
            <Box className="how-it-works-step" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, fontSize: '56px', color: 'text.secondary', opacity: 0.15, lineHeight: 1 }}>05</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>REVIEW RESULTS</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '13px', lineHeight: 1.5 }}>Evaluate daily performance metrics and pull audit reports.</Typography>
            </Box>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 10: ADMIN VS MEMBER EXPERIENCE ── */}
      <Box sx={{ py: { xs: 10, md: 16 }, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', bgcolor: isDark ? 'transparent' : '#fcfcfc' }}>
        <Container maxWidth="lg" sx={{ px: 3 }}>
          <Box sx={{ mb: 9, textAlign: 'center' }}>
            <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: '34px', sm: '46px', md: '58px' }, letterSpacing: '-2px', color: 'text.primary', mb: 2 }}>
              Simple for the team. Powerful for managers.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: '18px', fontWeight: 500 }}>Two tailored workflows operating in absolute synchronization.</Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
            {/* Managers */}
            <Box sx={{ p: { xs: 3, md: 5.5 }, border: '1px solid', borderColor: 'divider', borderRadius: '28px', bgcolor: isDark ? '#050505' : '#ffffff' }}>
              <Typography variant="h5" sx={{ fontWeight: 850, mb: 4, letterSpacing: '-0.5px' }}>Managers & Admins</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircle2 size={16} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Create and monitor all agency projects</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircle2 size={16} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Evaluate team health and active workloads</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircle2 size={16} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Pull daily performance audits or custom reports</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircle2 size={16} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Track late submissions and project history logs</Typography>
                </Box>
              </Box>
            </Box>

            {/* Members */}
            <Box sx={{ p: { xs: 3, md: 5.5 }, border: '1px solid', borderColor: 'divider', borderRadius: '28px', bgcolor: isDark ? '#050505' : '#ffffff' }}>
              <Typography variant="h5" sx={{ fontWeight: 850, mb: 4, letterSpacing: '-0.5px' }}>Team Members</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircle2 size={16} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Review assigned tasks in a clean dashboard</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircle2 size={16} />
                  <Typography variant="body2">Access details of parent client projects</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircle2 size={16} />
                  <Typography variant="body2">Complete tasks and update status metrics instantly</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircle2 size={16} />
                  <Typography variant="body2">Receive notifications on workspace deadlines</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 11: PASSWORDLESS LOGIN ── */}
      <Box sx={{ py: { xs: 10, md: 16 } }}>
        <Container maxWidth="sm" sx={{ px: 3, textAlign: 'center' }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '14px', bgcolor: isDark ? '#ffffff' : '#000000', color: isDark ? '#000000' : '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3.5 }}>
            <Shield size={20} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 2, letterSpacing: '-1px' }}>Sign in without passwords.</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '15px', lineHeight: 1.55, mb: 4.5 }}>
            Enter your email, verify your code directly, and get straight to work. No credentials to remember or lose.
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'center', alignItems: 'center', gap: 2.5 }}>
            <Box sx={{ px: 2.5, py: 1, border: '1px solid', borderColor: 'divider', borderRadius: '100px', bgcolor: 'transparent' }}>
              <Typography variant="caption" sx={{ fontWeight: 750 }}>Enter Email</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>→</Typography>
            <Box sx={{ px: 2.5, py: 1, border: '1px solid', borderColor: 'divider', borderRadius: '100px', bgcolor: 'transparent' }}>
              <Typography variant="caption" sx={{ fontWeight: 750 }}>Verify Code</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>→</Typography>
            <Box sx={{ px: 2.5, py: 1, border: '1px solid', borderColor: 'divider', borderRadius: '100px', bgcolor: isDark ? '#ffffff' : '#000000', color: isDark ? '#000000' : '#ffffff' }}>
              <Typography variant="caption" sx={{ fontWeight: 800 }}>Workspace</Typography>
            </Box>
          </Box>
        </Container>
      </Box>


      {/* ── SECTION 12: LARGE EDITORIAL STATEMENT (Breathing Room) ── */}
      <Box sx={{ py: { xs: 12, md: 20 }, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', bgcolor: isDark ? '#030303' : '#fafafa' }}>
        <Container maxWidth="lg" sx={{ px: 3, textAlign: 'center' }}>
          <Typography 
            variant="h2" 
            className="editorial-statement-title"
            sx={{ 
              fontWeight: 900, 
              fontSize: { xs: '38px', sm: '58px', md: '78px' }, 
              letterSpacing: '-2.5px', 
              color: 'text.primary', 
              mb: 3.5,
              lineHeight: 1.05
            }}
          >
            Less management.<br />More momentum.
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary', 
              maxWidth: '620px', 
              mx: 'auto', 
              fontSize: '18.5px', 
              lineHeight: 1.6,
              fontWeight: 500
            }}
          >
            Fluxiflow helps agencies stay focused on the work instead of managing the tools around it. Simple, robust, and completely aligned with delivery.
          </Typography>
        </Container>
      </Box>


      {/* ── SECTION 13: FINAL CTA (Futuristic Showroom Environment) ── */}
      <Container maxWidth="lg" sx={{ py: { xs: 10, md: 16 }, px: 3 }}>
        <Box 
          sx={{ 
            p: { xs: 3.5, sm: 6, md: 10 }, 
            borderRadius: '40px', 
            bgcolor: isDark ? '#ffffff' : '#000000', 
            color: isDark ? '#000000' : '#ffffff',
            textAlign: 'center',
            boxShadow: 'none',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Futuristic ambient showroom lighting inside card */}
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              background: isDark
                ? 'radial-gradient(circle 400px at 50% 50%, rgba(191, 219, 254, 0.4), transparent)'
                : 'radial-gradient(circle 400px at 50% 50%, rgba(37, 99, 235, 0.15), transparent)',
              zIndex: 0,
              pointerEvents: 'none'
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 900, 
                fontSize: { xs: '34px', sm: '46px', md: '58px' }, 
                letterSpacing: '-2px', 
                mb: 2.5,
                lineHeight: 1.1
              }}
            >
              Bring your agency's work into focus.
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                opacity: 0.8, 
                maxWidth: '520px', 
                mx: 'auto', 
                fontSize: '18px', 
                mb: 5.5,
                fontWeight: 500
              }}
            >
              Projects. Tasks. Team. Progress. One simple flow.
            </Typography>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2.5 }}>
              <Button 
                onClick={() => handleNav('/login')}
                variant="contained"
                sx={{ 
                  py: 2, 
                  px: 5, 
                  fontSize: '14.5px', 
                  fontWeight: 700, 
                  borderRadius: '100px',
                  bgcolor: isDark ? '#000000' : '#ffffff',
                  color: isDark ? '#ffffff' : '#000000',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: isDark ? '#27272a' : '#e4e4e7', boxShadow: 'none' }
                }}
              >
                Get Started
              </Button>
              <Button 
                onClick={() => handleNav('/login')}
                variant="outlined"
                sx={{ 
                  py: 2, 
                  px: 5, 
                  fontSize: '14.5px', 
                  fontWeight: 700, 
                  borderRadius: '100px',
                  borderColor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)',
                  color: isDark ? '#000000' : '#ffffff',
                  '&:hover': { borderColor: isDark ? '#000000' : '#ffffff', bgcolor: 'transparent' }
                }}
              >
                Log In
              </Button>
            </Box>
          </Box>
        </Box>
      </Container>


      {/* ── FOOTER ── */}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', py: 9, position: 'relative', zIndex: 1 }}>
        <Container maxWidth="lg" sx={{ px: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr' }, gap: 5, mb: 7 }}>
            <Box>
              <Box sx={{ mb: 2.5 }}>
                <FluxiflowLogo height={42} />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>Project management for modern agencies.</Typography>
            </Box>
            
            <Box sx={{ display: 'none', sm: 'block' }}></Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2.5, fontSize: '14px' }}>Product</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography component="a" href="#features" sx={{ fontSize: '13px', color: 'text.secondary', textDecoration: 'none', fontWeight: 500, '&:hover': { color: 'text.primary' } }}>Features</Typography>
                <Typography component="a" href="#how-it-works" sx={{ fontSize: '13px', color: 'text.secondary', textDecoration: 'none', fontWeight: 500, '&:hover': { color: 'text.primary' } }}>How It Works</Typography>
                <Typography component="a" href="#team" sx={{ fontSize: '13px', color: 'text.secondary', textDecoration: 'none', fontWeight: 500, '&:hover': { color: 'text.primary' } }}>Team Health</Typography>
                <Typography component="a" href="#reports" sx={{ fontSize: '13px', color: 'text.secondary', textDecoration: 'none', fontWeight: 500, '&:hover': { color: 'text.primary' } }}>Reports</Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2.5, fontSize: '14px' }}>Account</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography component="a" href="/login" onClick={(e) => { e.preventDefault(); handleNav('/login'); }} sx={{ fontSize: '13px', color: 'text.secondary', textDecoration: 'none', fontWeight: 500, '&:hover': { color: 'text.primary' } }}>Log In</Typography>
                <Typography component="a" href="/login" onClick={(e) => { e.preventDefault(); handleNav('/login'); }} sx={{ fontSize: '13px', color: 'text.secondary', textDecoration: 'none', fontWeight: 500, '&:hover': { color: 'text.primary' } }}>Get Started</Typography>
              </Box>
            </Box>
          </Box>

          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 500 }}>
            © 2026 Fluxiflow for Agency. All rights reserved.
          </Typography>
        </Container>
      </Box>

    </Box>
  );
};
