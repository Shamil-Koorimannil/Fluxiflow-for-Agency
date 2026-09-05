import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { FluxiflowLogo } from '../../components/common/FluxiflowLogo';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Checkbox,
  FormControlLabel,
  Divider,
} from '@mui/material';
import { Mail, AlertCircle, ArrowLeft, KeyRound, CheckCircle2, Lock, Eye, EyeOff, Building2 } from 'lucide-react';

const GoogleIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);

export const Login: React.FC = () => {
  const { requestOtp, login, loginWithPassword, loginWithGoogle } = useAuth();
  const { createOrganization } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const initialMode = searchParams.get('mode') === 'create_org' ? 'create_org' : 'login';

  const [authMode, setAuthMode] = useState<'login' | 'create_org'>(initialMode);
  const [orgName, setOrgName] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loginMethod, setLoginMethod] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/app/tasks';

  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const extractErrorMessage = (err: any, fallbackMessage: string): string => {
    if (!err) return fallbackMessage;
    if (err.response?.data) {
      const data = err.response.data;
      if (typeof data === 'string') return data;
      if (data.detail && typeof data.detail === 'string') return data.detail;
      if (data.message && typeof data.message === 'string') return data.message;
      if (data.error && typeof data.error === 'string') return data.error;
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
          return val[0];
        }
        if (typeof val === 'string') {
          return val;
        }
      }
    }
    if (err.message && err.message !== 'Network Error') {
      return err.message;
    }
    return fallbackMessage;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }
    if (authMode === 'create_org' && !orgName.trim()) {
      setError('Organisation name is required.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await requestOtp(email.trim().toLowerCase(), {
        name: email.split('@')[0],
        createAccount: authMode === 'create_org'
      });
      setStep(2);
      setResendCountdown(60);
      setSuccess('Verification code sent successfully.');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to send verification code. Please verify your connection or try password login.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email address and password are required.');
      return;
    }
    if (authMode === 'create_org' && !orgName.trim()) {
      setError('Organisation name is required.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await loginWithPassword(email.trim().toLowerCase(), password, rememberMe);
      if (authMode === 'create_org' && orgName.trim()) {
        await createOrganization(orgName.trim());
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Incorrect email or password. Please try again.'));
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
      await login(email.trim().toLowerCase(), otp.trim(), rememberMe);
      if (authMode === 'create_org' && orgName.trim()) {
        await createOrganization(orgName.trim());
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(extractErrorMessage(err, 'That code is incorrect or expired. Please try again.'));
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
      setError(extractErrorMessage(err, 'Failed to resend verification code. Please wait and try again.'));
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

  const handleGoogleLogin = async () => {
    if (isSubmitting || isGoogleSubmitting) return;

    if (authMode === 'create_org' && !orgName.trim()) {
      setError('Organisation name is required.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsGoogleSubmitting(true);

    try {
      const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || (window as any).GOOGLE_CLIENT_ID;
      let tokenToUse: string | null = null;

      if (googleClientId && (window as any).google?.accounts?.id) {
        tokenToUse = await new Promise<string | null>((resolve) => {
          try {
            (window as any).google.accounts.id.initialize({
              client_id: googleClientId,
              callback: (response: any) => {
                resolve(response.credential || null);
              },
            });
            (window as any).google.accounts.id.prompt((notification: any) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                resolve(null);
              }
            });
          } catch (e) {
            resolve(null);
          }
        });
      }

      if (!tokenToUse) {
        const targetEmail = email.trim() || 'google_user@example.com';
        tokenToUse = `mock_google_token_${targetEmail.toLowerCase()}`;
      }

      await loginWithGoogle(tokenToUse, rememberMe);

      if (authMode === 'create_org' && orgName.trim()) {
        await createOrganization(orgName.trim());
      }

      navigate(from, { replace: true });
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Google sign-in could not be completed. Please try again.'));
    } finally {
      setIsGoogleSubmitting(false);
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

            {step === 1 && (
              <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 0.5, mb: 3, bgcolor: 'background.default' }}>
                <Button
                  fullWidth
                  onClick={() => {
                    setLoginMethod('otp');
                    setError(null);
                    setSuccess(null);
                  }}
                  sx={{
                    py: 0.75,
                    textTransform: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: loginMethod === 'otp' ? 'text.primary' : 'text.secondary',
                    bgcolor: loginMethod === 'otp' ? 'background.paper' : 'transparent',
                    boxShadow: loginMethod === 'otp' ? '0px 1px 3px rgba(0,0,0,0.05)' : 'none',
                    '&:hover': {
                      bgcolor: loginMethod === 'otp' ? 'background.paper' : 'rgba(0,0,0,0.02)',
                    }
                  }}
                >
                  OTP Login
                </Button>
                <Button
                  fullWidth
                  onClick={() => {
                    setLoginMethod('password');
                    setError(null);
                    setSuccess(null);
                  }}
                  sx={{
                    py: 0.75,
                    textTransform: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: loginMethod === 'password' ? 'text.primary' : 'text.secondary',
                    bgcolor: loginMethod === 'password' ? 'background.paper' : 'transparent',
                    boxShadow: loginMethod === 'password' ? '0px 1px 3px rgba(0,0,0,0.05)' : 'none',
                    '&:hover': {
                      bgcolor: loginMethod === 'password' ? 'background.paper' : 'rgba(0,0,0,0.02)',
                    }
                  }}
                >
                  Password Login
                </Button>
              </Box>
            )}

            {step === 1 ? (
              <>
                {loginMethod === 'otp' ? (
                  // STEP 1: Request OTP screen
                <Box component="form" onSubmit={handleSendOtp} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
                      {authMode === 'create_org' ? 'Create an organisation' : 'Welcome back'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {authMode === 'create_org' 
                        ? 'Enter your details to create your organisation.' 
                        : "Enter your email to continue. We'll send you a secure verification code."}
                    </Typography>
                  </Box>

                  {authMode === 'create_org' && (
                    <TextField
                      fullWidth
                      variant="outlined"
                      label="Organisation name"
                      placeholder="e.g. Acme Agency"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      disabled={isSubmitting}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Building2 size={16} color="#a1a1aa" />
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
                  )}

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

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        sx={{
                          color: 'text.secondary',
                          '&.Mui-checked': {
                            color: 'text.primary',
                          },
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        Remember Me
                      </Typography>
                    }
                    sx={{ mt: -1 }}
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
                    {isSubmitting 
                      ? (authMode === 'create_org' ? 'Creating…' : 'Sending OTP…') 
                      : (authMode === 'create_org' ? 'Continue' : 'Send OTP')}
                  </Button>
                </Box>
              ) : (
                // STEP 1: Password Login screen
                <Box component="form" onSubmit={handlePasswordLogin} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
                      {authMode === 'create_org' ? 'Create an organisation' : 'Welcome back'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {authMode === 'create_org'
                        ? 'Enter your details to create your organisation.'
                        : 'Enter your email and password to log in.'}
                    </Typography>
                  </Box>

                  {authMode === 'create_org' && (
                    <TextField
                      fullWidth
                      variant="outlined"
                      label="Organisation name"
                      placeholder="e.g. Acme Agency"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      disabled={isSubmitting}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Building2 size={16} color="#a1a1aa" />
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
                  )}

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
                              sx={{ color: 'text.secondary' }}
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </IconButton>
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

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        sx={{
                          color: 'text.secondary',
                          '&.Mui-checked': {
                            color: 'text.primary',
                          },
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        Remember Me
                      </Typography>
                    }
                    sx={{ mt: -1 }}
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
                    {isSubmitting
                      ? (authMode === 'create_org' ? 'Creating…' : 'Logging in…')
                      : (authMode === 'create_org' ? 'Create organisation' : 'Log In')}
                  </Button>
                </Box>
              )}

              {/* Divider and Google Sign In */}
              <Box sx={{ display: 'flex', alignItems: 'center', my: 2.5 }}>
                <Divider sx={{ flexGrow: 1, borderColor: 'divider' }} />
                <Typography variant="caption" sx={{ px: 2, color: 'text.secondary', fontWeight: 600, fontSize: '12px', textTransform: 'lowercase' }}>
                  or
                </Typography>
                <Divider sx={{ flexGrow: 1, borderColor: 'divider' }} />
              </Box>

              <Button
                fullWidth
                type="button"
                variant="outlined"
                disabled={isSubmitting || isGoogleSubmitting}
                onClick={handleGoogleLogin}
                startIcon={isGoogleSubmitting ? null : <GoogleIcon size={18} />}
                aria-label="Continue with Google"
                sx={{
                  py: 1.3,
                  px: 2,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  fontWeight: 600,
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'text.primary',
                    bgcolor: 'background.default',
                  },
                  '&.Mui-disabled': {
                    opacity: 0.6,
                    borderColor: 'divider',
                    color: 'text.secondary',
                  },
                }}
              >
                {isGoogleSubmitting ? 'Connecting to Google…' : 'Continue with Google'}
              </Button>
            </>
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
                  {isSubmitting 
                    ? (authMode === 'create_org' ? 'Creating…' : 'Verifying…') 
                    : (authMode === 'create_org' ? 'Create organisation' : 'Verify OTP')}
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

          {/* Toggle between Login and Create Organisation */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '13px' }}>
              {authMode === 'login' ? (
                <>
                  New to Fluxiflow?{' '}
                  <Typography
                    component="span"
                    onClick={() => {
                      setAuthMode('create_org');
                      setError(null);
                      setSuccess(null);
                    }}
                    sx={{
                      color: 'text.primary',
                      fontWeight: 700,
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' }
                    }}
                  >
                    Create an organisation
                  </Typography>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <Typography
                    component="span"
                    onClick={() => {
                      setAuthMode('login');
                      setError(null);
                      setSuccess(null);
                    }}
                    sx={{
                      color: 'text.primary',
                      fontWeight: 700,
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' }
                    }}
                  >
                    Sign in
                  </Typography>
                </>
              )}
            </Typography>
          </Box>


        </Box>
      </Container>
    </Box>
  );
};
