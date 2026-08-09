import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/app/tasks';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email address and password are required.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await login(email.trim().toLowerCase(), password);
      // Success, navigate to landing page
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('No active account found with the given credentials. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#ffffff',
        fontFamily: 'Roboto, sans-serif',
        color: '#000000',
        px: 2,
      }}
    >
      <Container maxWidth="xs">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Logo Brand */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 800, letterSpacing: '-0.05em', color: '#000000' }}
            >
              Fluxiflow
            </Typography>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                fontSize: '11px',
                color: '#71717a',
                mt: -0.5,
              }}
            >
              for Agency
            </Typography>
          </Box>

          {/* Form container */}
          <Box
            className="animate-slide-up"
            sx={{
              border: '1px solid #e4e4e7',
              borderRadius: '16px',
              p: 4,
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
            }}
          >
            {error && (
              <Alert
                severity="error"
                icon={<AlertCircle size={16} />}
                sx={{
                  mb: 3,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid #fee2e2',
                  bgcolor: '#fef2f2',
                  color: '#991b1b',
                  '& .MuiAlert-icon': { color: '#991b1b' },
                }}
              >
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Welcome back
                </Typography>
                <Typography variant="body2" sx={{ color: '#71717a' }}>
                  Log in to manage your workspace assignments.
                </Typography>
              </Box>

              <TextField
                fullWidth
                variant="outlined"
                type="email"
                label="Email"
                placeholder="name@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Mail size={16} color="#a1a1aa" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    '&:hover fieldset': { borderColor: '#000000' },
                    '&.Mui-focused fieldset': { borderColor: '#000000', borderWidth: '1.5px' },
                  },
                }}
              />

              <TextField
                fullWidth
                variant="outlined"
                type={showPassword ? 'text' : 'password'}
                label="Password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock size={16} color="#a1a1aa" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <EyeOff size={16} color="#71717a" /> : <Eye size={16} color="#71717a" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    '&:hover fieldset': { borderColor: '#000000' },
                    '&.Mui-focused fieldset': { borderColor: '#000000', borderWidth: '1.5px' },
                  },
                }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    color="default"
                    sx={{ '&.Mui-checked': { color: '#000000' } }}
                  />
                }
                label="Keep me signed in"
                sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px', fontWeight: 500, color: '#52525b' } }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={isSubmitting}
                sx={{
                  py: 1.5,
                  bgcolor: '#000000',
                  color: '#ffffff',
                  fontWeight: 600,
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontSize: '14px',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#27272a', boxShadow: 'none' },
                  '&.Mui-disabled': { bgcolor: '#e4e4e7', color: '#a1a1aa' },
                }}
              >
                {isSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Log In'}
              </Button>
            </Box>
          </Box>

          {/* Seed hint box */}
          <Box sx={{ border: '1px solid #f4f4f5', bgcolor: '#fafafa', borderRadius: '12px', p: 2.5, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 600, display: 'block', mb: 0.5 }}>
              Demo Login Credentials (Password is `password123`):
            </Typography>
            <Typography variant="caption" sx={{ color: '#a1a1aa', fontFamily: 'monospace', display: 'block' }}>
              Admin: muhammedshamil251@gmail.com
            </Typography>
            <Typography variant="caption" sx={{ color: '#a1a1aa', fontFamily: 'monospace', display: 'block' }}>
              Member: member@demo.com
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};
