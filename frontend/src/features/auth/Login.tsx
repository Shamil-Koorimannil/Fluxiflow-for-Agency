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
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { Mail, AlertCircle, ArrowLeft, KeyRound, CheckCircle2, Lock, Eye, EyeOff, Building2 } from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';

export const Login: React.FC = () => {
  const { requestOtp, login, loginWithPassword } = useAuth();
  const { createOrganization } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const initialMode = searchParams.get('mode') === 'create_org' ? 'create_org' : 'login';

  const [authMode, setAuthMode] = useState<'login' | 'create_org'>(initialMode);
  const [orgName, setOrgName] = useState('');

  // Authentication screens step: 1 = Email request, 2 = OTP verification
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
        py: 4,
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
                  mb: 2,
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
                  mb: 2,
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
              <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 0.5, mb: 2, bgcolor: 'background.default' }}>
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
              loginMethod === 'otp' ? (
                // STEP 1: Request OTP screen
                <Box component="form" onSubmit={handleSendOtp} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2.2 }}>
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
                      py: 1.3,
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
                      ? <CircularProgress size={20} color="inherit" />
                      : (authMode === 'create_org' ? 'Continue' : 'Send OTP')}
                  </Button>
                </Box>
              ) : (
                // STEP 1: Password Login screen
                <Box component="form" onSubmit={handlePasswordLogin} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2.2 }}>
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
                      py: 1.3,
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
                      ? <CircularProgress size={20} color="inherit" />
                      : (authMode === 'create_org' ? 'Create organisation' : 'Log In')}
                  </Button>
                </Box>
              )
            ) : (
              // STEP 2: Verify OTP screen
              <Box component="form" onSubmit={handleVerifyOtp} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2.2 }}>
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
