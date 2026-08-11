import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { FluxiflowLogo } from '../../components/common/FluxiflowLogo';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Mail, AlertCircle, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { requestOtp, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Authentication screens step: 1 = Email request, 2 = OTP verification
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/app/tasks';

  // Timer countdown hook for resend limits
  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await requestOtp(email.trim().toLowerCase());
      setStep(2);
      setResendCountdown(60);
      setSuccess('Verification code sent successfully.');
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to send verification code. Please verify your connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Verification code is required.');
      return;
    }
    if (otp.trim().length !== 6) {
      setError('Please enter a 6-digit verification code.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await login(email.trim().toLowerCase(), otp.trim());
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('That code is incorrect or expired. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await requestOtp(email.trim().toLowerCase());
      setResendCountdown(60);
      setSuccess('A new verification code has been sent.');
      setOtp('');
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to resend verification code. Please wait and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeEmail = () => {
    setStep(1);
    setOtp('');
    setError(null);
    setSuccess(null);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        fontFamily: 'Roboto, sans-serif',
        color: 'text.primary',
        px: 2,
      }}
    >
      <Container maxWidth="xs">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <FluxiflowLogo height={160} />
          </Box>

          {/* Form Container */}
          <Box
            className="animate-slide-up"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '16px',
              p: 4,
              bgcolor: 'background.paper',
              boxShadow: 'none',
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

            {success && (
              <Alert
                severity="success"
                icon={<CheckCircle2 size={16} />}
                sx={{
                  mb: 3,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid #dcfce7',
                  bgcolor: '#f0fdf4',
                  color: '#15803d',
                  '& .MuiAlert-icon': { color: '#15803d' },
                }}
              >
                {success}
              </Alert>
            )}

            {step === 1 ? (
              // STEP 1: Request OTP screen
              <Box component="form" onSubmit={handleSendOtp} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
                    Welcome back
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Enter your email to continue. We'll send you a secure verification code.
                  </Typography>
                </Box>

                <TextField
                  fullWidth
                  variant="outlined"
                  type="email"
                  label="Email Address"
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
                      bgcolor: 'background.paper',
                      '&:hover fieldset': { borderColor: 'text.primary' },
                      '&.Mui-focused fieldset': { borderColor: 'text.primary', borderWidth: '1.5px' },
                    },
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={isSubmitting}
                  sx={{
                    py: 1.5,
                    bgcolor: 'text.primary',
                    color: 'background.paper',
                    fontWeight: 600,
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontSize: '14px',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: 'text.secondary', boxShadow: 'none' },
                    '&.Mui-disabled': { bgcolor: 'divider', color: 'text.secondary' },
                  }}
                >
                  {isSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Send OTP'}
                </Button>
              </Box>
            ) : (
              // STEP 2: Verify OTP screen
              <Box component="form" onSubmit={handleVerifyOtp} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box>
                  <IconButton
                    onClick={handleChangeEmail}
                    size="small"
                    sx={{ p: 0, mb: 1.5, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                  >
                    <ArrowLeft size={16} style={{ marginRight: '6px' }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Change email
                    </Typography>
                  </IconButton>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
                    Enter verification code
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                    We sent a 6-digit code to <strong>{email}</strong>
                  </Typography>
                </Box>

                <TextField
                  fullWidth
                  variant="outlined"
                  type="text"
                  label="Verification Code"
                  placeholder="123456"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  disabled={isSubmitting}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <KeyRound size={16} color="#a1a1aa" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      bgcolor: 'background.paper',
                      '&:hover fieldset': { borderColor: 'text.primary' },
                      '&.Mui-focused fieldset': { borderColor: 'text.primary', borderWidth: '1.5px' },
                    },
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={isSubmitting || otp.length !== 6}
                  sx={{
                    py: 1.5,
                    bgcolor: 'text.primary',
                    color: 'background.paper',
                    fontWeight: 600,
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontSize: '14px',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: 'text.secondary', boxShadow: 'none' },
                    '&.Mui-disabled': { bgcolor: 'divider', color: 'text.secondary' },
                  }}
                >
                  {isSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Verify OTP'}
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  disabled={isSubmitting || resendCountdown > 0}
                  onClick={handleResendOtp}
                  sx={{
                    py: 1.2,
                    borderColor: 'divider',
                    color: 'text.primary',
                    fontWeight: 600,
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontSize: '13px',
                    '&:hover': { borderColor: 'text.primary', bgcolor: 'transparent' },
                    '&.Mui-disabled': { color: 'text.secondary', borderColor: 'divider' },
                  }}
                >
                  {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend OTP'}
                </Button>
              </Box>
            )}
          </Box>


        </Box>
      </Container>
    </Box>
  );
};
