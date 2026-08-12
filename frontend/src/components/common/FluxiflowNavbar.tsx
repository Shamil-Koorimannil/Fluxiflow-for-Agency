import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton,
  Divider 
} from '@mui/material';
import { Menu, X } from 'lucide-react';
import { useAppTheme } from '../../context/ThemeContext';
import { FluxiflowLogo } from './FluxiflowLogo';

interface FluxiflowNavbarProps {
  navbarRef?: React.RefObject<HTMLDivElement | null>;
}

export const FluxiflowNavbar: React.FC<FluxiflowNavbarProps> = ({ navbarRef }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useAppTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const isAtLanding = location.pathname === '/landing';

  const getLinkHref = (hash: string) => {
    return isAtLanding ? hash : `/landing${hash}`;
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    if (isAtLanding) {
      e.preventDefault();
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <>
      <Box 
        ref={navbarRef} 
        sx={{ 
          position: 'sticky', 
          top: 20, 
          zIndex: 1000, 
          px: 2, 
          display: 'flex', 
          justifyContent: 'center',
          width: '100%'
        }}
      >
        <Box 
          className="navbar-box"
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            width: '100%', 
            maxWidth: '1200px', 
            py: 1.5, 
            px: { xs: 2.5, md: 4 }, 
            bgcolor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.75)', 
            backdropFilter: 'blur(30px) saturate(190%)',
            borderRadius: '100px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            boxShadow: '0 15px 35px rgba(0,0,0,0.03)'
          }}
        >
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleNav('/')}>
            <FluxiflowLogo height={44} />
          </Box>

          {/* Links - Desktop */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 4.5, alignItems: 'center' }}>
            <Typography 
              component="a" 
              onClick={() => handleNav('/')}
              sx={{ 
                fontSize: '13.5px', 
                fontWeight: 700, 
                color: location.pathname === '/' ? 'text.primary' : 'text.secondary', 
                cursor: 'pointer',
                transition: 'color 0.2s', 
                '&:hover': { color: 'text.primary' } 
              }}
            >
              Home
            </Typography>
            <Typography 
              component="a" 
              href={getLinkHref('#features')}
              onClick={(e) => handleLinkClick(e, '#features')}
              sx={{ fontSize: '13.5px', fontWeight: 600, color: 'text.secondary', textDecoration: 'none', transition: 'color 0.2s', '&:hover': { color: 'text.primary' } }}
            >
              Features
            </Typography>
            <Typography 
              component="a" 
              href={getLinkHref('#how-it-works')}
              onClick={(e) => handleLinkClick(e, '#how-it-works')}
              sx={{ fontSize: '13.5px', fontWeight: 600, color: 'text.secondary', textDecoration: 'none', transition: 'color 0.2s', '&:hover': { color: 'text.primary' } }}
            >
              How It Works
            </Typography>
            <Typography 
              component="a" 
              href={getLinkHref('#team')}
              onClick={(e) => handleLinkClick(e, '#team')}
              sx={{ fontSize: '13.5px', fontWeight: 600, color: 'text.secondary', textDecoration: 'none', transition: 'color 0.2s', '&:hover': { color: 'text.primary' } }}
            >
              Team
            </Typography>
            <Typography 
              component="a" 
              href={getLinkHref('#reports')}
              onClick={(e) => handleLinkClick(e, '#reports')}
              sx={{ fontSize: '13.5px', fontWeight: 600, color: 'text.secondary', textDecoration: 'none', transition: 'color 0.2s', '&:hover': { color: 'text.primary' } }}
            >
              Reports
            </Typography>
          </Box>

          {/* Actions & Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
            {/* Desktop Buttons */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2, alignItems: 'center' }}>
              <Button 
                onClick={() => handleNav('/login')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  fontSize: '13.5px',
                  color: 'text.primary',
                  px: 2
                }}
              >
                Log In
              </Button>
              <Button 
                onClick={() => handleNav('/login')} 
                variant="contained"
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  fontSize: '13.5px',
                  bgcolor: isDark ? '#ffffff' : '#000000',
                  color: isDark ? '#000000' : '#ffffff',
                  borderRadius: '100px',
                  px: 3.5,
                  py: 1,
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: isDark ? '#e4e4e7' : '#27272a',
                    boxShadow: 'none'
                  }
                }}
              >
                Get Started
              </Button>
            </Box>

            {/* Mobile hamburger menu */}
            <IconButton 
              onClick={() => setMobileMenuOpen(true)} 
              sx={{ display: { xs: 'flex', md: 'none' }, color: 'text.primary', p: 1 }}
            >
              <Menu size={19} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* ── MOBILE NAVIGATION SIDEBAR DRAWER ── */}
      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: '280px',
              bgcolor: isDark ? '#000000' : '#ffffff',
              backgroundImage: 'none',
              borderLeft: '1px solid',
              borderColor: isDark ? '#27272a' : '#e4e4e7',
              p: 3
            }
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5 }}>
          <FluxiflowLogo height={36} />
          <IconButton onClick={() => setMobileMenuOpen(false)} sx={{ color: 'text.primary', p: 1 }}>
            <X size={19} />
          </IconButton>
        </Box>

        <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ListItem disablePadding>
            <ListItemButton onClick={() => handleNav('/')} sx={{ borderRadius: '8px' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '15px', color: location.pathname === '/' ? 'primary.main' : 'text.primary' }}>Home</Typography>
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              component="a" 
              href={getLinkHref('#features')}
              onClick={(e) => { setMobileMenuOpen(false); handleLinkClick(e, '#features'); }}
              sx={{ borderRadius: '8px' }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '15px' }}>Features</Typography>
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              component="a" 
              href={getLinkHref('#how-it-works')}
              onClick={(e) => { setMobileMenuOpen(false); handleLinkClick(e, '#how-it-works'); }}
              sx={{ borderRadius: '8px' }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '15px' }}>How It Works</Typography>
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              component="a" 
              href={getLinkHref('#team')}
              onClick={(e) => { setMobileMenuOpen(false); handleLinkClick(e, '#team'); }}
              sx={{ borderRadius: '8px' }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '15px' }}>Team</Typography>
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              component="a" 
              href={getLinkHref('#reports')}
              onClick={(e) => { setMobileMenuOpen(false); handleLinkClick(e, '#reports'); }}
              sx={{ borderRadius: '8px' }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '15px' }}>Reporting</Typography>
            </ListItemButton>
          </ListItem>
        </List>

        <Divider sx={{ my: 4 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button 
            fullWidth 
            onClick={() => handleNav('/login')} 
            sx={{ textTransform: 'none', fontWeight: 700, py: 1.2, color: 'text.primary' }}
          >
            Log In
          </Button>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={() => handleNav('/login')} 
            sx={{ 
              textTransform: 'none', 
              fontWeight: 700, 
              py: 1.4,
              bgcolor: isDark ? '#ffffff' : '#000000',
              color: isDark ? '#000000' : '#ffffff',
              borderRadius: '100px',
              boxShadow: 'none',
              '&:hover': { bgcolor: isDark ? '#e4e4e7' : '#27272a', boxShadow: 'none' }
            }}
          >
            Get Started
          </Button>
        </Box>
      </Drawer>
    </>
  );
};
