import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { User, UserRole } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { TeamDetailDrawer } from './TeamDetailDrawer';
import { TaskFormModal } from '../tasks/TaskFormModal';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Typography,
  Avatar,
  Snackbar,
  Alert,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  LinearProgress,
  Tooltip,
  Popover,
} from '@mui/material';
import {
  MoreVertical,
  Plus,
  Search,
  User as UserIcon,
  Mail,
  Upload,
  HelpCircle,
  Check,
  Calendar,
  Grid as GridIcon,
  History,
  CircleDot,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  ArrowUpDown
} from 'lucide-react';

export const Team: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // Health filter and Sorting states
  const [healthFilter, setHealthFilter] = useState<'all' | 'excellent' | 'healthy' | 'needs_attention' | 'at_risk' | 'critical'>('all');
  const [sortBy, setSortBy] = useState<'health_low' | 'health_high' | 'name' | 'pending_high' | 'overdue_high'>('health_low');

  // Right drawer states
  const [drawerMemberId, setDrawerMemberId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [searchParams] = useSearchParams();
  const memberParam = searchParams.get('member');

  React.useEffect(() => {
    if (memberParam) {
      setDrawerMemberId(memberParam);
      setIsDrawerOpen(true);
    }
  }, [memberParam]);

  // TaskFormModal states
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [preselectedMemberId, setPreselectedMemberId] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleCardClick = (memberId: string) => {
    navigate(`/app/team/${memberId}`);
  };

  // Dropdown menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Dialog open states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [isReactivateOpen, setIsReactivateOpen] = useState(false);
  const [userToReactivate, setUserToReactivate] = useState<User | null>(null);

  // Tab selection state: 'active' | 'deactivated'
  const [activeTab, setActiveTab] = useState<'active' | 'deactivated'>('active');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('MEMBER');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Email verification state for editing
  const [emailVerifyStep, setEmailVerifyStep] = useState<1 | 2>(1);
  const [emailVerifyOtp, setEmailVerifyOtp] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Success toast/snackbar
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error'>('success');

  // Period filter states
  const [periodOption, setPeriodOption] = useState<'current_month' | 'select_month' | 'last_3_months' | 'custom_range' | 'current_year'>('current_month');
  
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIdx);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  
  // Custom range states (start and end months/years)
  const [customStartMonth, setCustomStartMonth] = useState<number>(currentMonthIdx);
  const [customStartYear, setCustomStartYear] = useState<number>(currentYear);
  const [customEndMonth, setCustomEndMonth] = useState<number>(currentMonthIdx);
  const [customEndYear, setCustomEndYear] = useState<number>(currentYear);

  const [dropdownAnchorEl, setDropdownAnchorEl] = useState<null | HTMLElement>(null);
  const [pickerAnchorEl, setPickerAnchorEl] = useState<null | HTMLElement>(null);
  const [pickerType, setPickerType] = useState<'month' | 'range' | null>(null);
  const [viewYear, setViewYear] = useState<number>(currentYear);
  const mainButtonRef = useRef<HTMLButtonElement | null>(null);

  const [healthAnchorEl, setHealthAnchorEl] = useState<null | HTMLElement>(null);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);

  const [rangeStep, setRangeStep] = useState<'start' | 'end'>('start');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const isCustomRangeValid = () => {
    if (periodOption !== 'custom_range') return true;
    if (customStartYear < customEndYear) return true;
    if (customStartYear === customEndYear && customStartMonth <= customEndMonth) return true;
    return false;
  };

  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (periodOption) {
      case 'current_month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = now;
        break;
      }
      case 'select_month': {
        start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
        end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
        break;
      }
      case 'last_3_months': {
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
        end = now;
        break;
      }
      case 'custom_range': {
        start = new Date(customStartYear, customStartMonth, 1, 0, 0, 0, 0);
        end = new Date(customEndYear, customEndMonth + 1, 0, 23, 59, 59, 999);
        break;
      }
      case 'current_year': {
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        end = now;
        break;
      }
      default: {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = now;
      }
    }

    return {
      start_date: start.toISOString(),
      end_date: end.toISOString()
    };
  };

  const { start_date, end_date } = getDateRange();
  const isPeriodValid = isCustomRangeValid();

  // Fetch Team List
  const { data: teamMembers, isLoading, error } = useQuery<User[]>({
    queryKey: ['team', periodOption, selectedMonth, selectedYear, customStartMonth, customStartYear, customEndMonth, customEndYear],
    queryFn: async () => {
      if (!isPeriodValid) return [];
      const response = await api.get('/team/', {
        params: { start_date, end_date }
      });
      return response.data;
    },
  });


  // Invitation Mutation
  const inviteMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await api.post('/team/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setIsAddOpen(false);
      const invitedEmail = email; // capture before resetForm clears it
      resetForm();
      if (data?.email_sent === false) {
        showToast(
          `Member added, but the invitation email could not be sent to ${data?.member_email || invitedEmail}. Use Resend Invitation to try again.`,
          'error'
        );
      } else {
        showToast(`Member invited successfully. Invitation sent to: ${invitedEmail}`, 'success');
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Failed to send invitation. Unique email required.';
      showToast(msg, 'error');
    },
  });

  // Edit User Mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      const response = await api.patch(`/team/${id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setIsEditOpen(false);
      resetForm();
      showToast('Team member details updated successfully.', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Failed to update team member details.';
      showToast(msg, 'error');
    },
  });

  // Deactivate User Mutation
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/team/${id}/deactivate/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setIsDeactivateOpen(false);
      showToast('Member deactivated successfully.', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Failed to deactivate member.';
      showToast(msg, 'error');
    },
  });

  // Reactivate User Mutation
  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/team/${id}/reactivate/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setIsReactivateOpen(false);
      showToast('Member reactivated successfully.', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Failed to reactivate member.';
      showToast(msg, 'error');
    },
  });

  // Resend Invitation Mutation
  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/team/${id}/resend/`);
      return response.data;
    },
    onSuccess: () => {
      showToast('Invitation resent successfully.', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Failed to resend invitation.';
      showToast(msg, 'error');
    },
  });

  // Actions menu handlers
  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>, member: User) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(member);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleViewWorkload = () => {
    if (selectedUser) {
      handleCardClick(selectedUser.id);
    }
    handleCloseMenu();
  };

  const handleOpenEdit = () => {
    if (selectedUser) {
      setName(selectedUser.name);
      setEmail(selectedUser.email);
      setRole(selectedUser.role);
      setAvatarPreview(selectedUser.avatar_url || null);
      setIsEditOpen(true);
    }
    handleCloseMenu();
  };

  const handleOpenDeactivate = () => {
    setIsDeactivateOpen(true);
    handleCloseMenu();
  };

  const handleOpenReactivate = (member: User) => {
    setUserToReactivate(member);
    setIsReactivateOpen(true);
    handleCloseMenu();
  };

  const handleReactivateConfirm = () => {
    if (userToReactivate) {
      reactivateMutation.mutate(userToReactivate.id);
    }
  };

  const handleResendInvite = () => {
    if (selectedUser) {
      resendMutation.mutate(selectedUser.id);
    }
    handleCloseMenu();
  };

  // Dialog submit handlers
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      showToast('Please fill in Name and Email.', 'error');
      return;
    }
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('role', role);
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }
    inviteMutation.mutate(formData);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!name || !email) {
      showToast('Please fill in Name and Email.', 'error');
      return;
    }

    // If email is changed and not verified yet
    if (email.trim().toLowerCase() !== selectedUser.email.toLowerCase() && emailVerifyStep === 1) {
      setVerifyError(null);
      setIsVerifyingEmail(true);
      try {
        await api.post('/auth/request-email-change-otp/', {
          user_id: selectedUser.id,
          new_email: email.trim().toLowerCase()
        });
        setEmailVerifyStep(2);
        showToast('Verification code sent to the new email address.', 'success');
      } catch (err: any) {
        if (err.response?.data?.detail) {
          setVerifyError(err.response.data.detail);
          showToast(err.response.data.detail, 'error');
        } else {
          setVerifyError('Failed to request verification code. Please check your input.');
          showToast('Failed to request verification code.', 'error');
        }
      } finally {
        setIsVerifyingEmail(false);
      }
      return;
    }

    // If OTP is required and we are on step 2
    if (emailVerifyStep === 2) {
      if (!emailVerifyOtp.trim()) {
        setVerifyError('Verification code is required.');
        return;
      }
      setVerifyError(null);
      setIsVerifyingEmail(true);
      try {
        await api.post('/auth/verify-email-change/', {
          user_id: selectedUser.id,
          new_email: email.trim().toLowerCase(),
          otp: emailVerifyOtp.trim()
        });
        
        // Email is verified and updated! Now update other fields
        const formData = new FormData();
        formData.append('name', name);
        formData.append('role', role);
        if (avatarFile) {
          formData.append('avatar', avatarFile);
        }
        await editMutation.mutateAsync({ id: selectedUser.id, formData });
        setIsEditOpen(false);
        setEmailVerifyStep(1);
        setEmailVerifyOtp('');
      } catch (err: any) {
        if (err.response?.data?.detail) {
          setVerifyError(err.response.data.detail);
          showToast(err.response.data.detail, 'error');
        } else {
          setVerifyError('Invalid verification code. Please try again.');
          showToast('Invalid verification code.', 'error');
        }
      } finally {
        setIsVerifyingEmail(false);
      }
      return;
    }

    // Normal edit if email didn't change
    const formData = new FormData();
    formData.append('name', name);
    formData.append('role', role);
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }
    editMutation.mutate({ id: selectedUser.id, formData });
  };

  const handleDeactivateConfirm = () => {
    if (selectedUser) {
      deactivateMutation.mutate(selectedUser.id);
    }
  };

  // Helper utils
  const showToast = (message: string, severity: 'success' | 'error') => {
    setToastMessage(message);
    setToastSeverity(severity);
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setRole('MEMBER');
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };



  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };  const getPeriodLabel = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    switch (periodOption) {
      case 'current_month':
        return 'Current Month';
      case 'select_month':
        return `${fullMonths[selectedMonth]} ${selectedYear}`;
      case 'last_3_months':
        return 'Last 3 Months';
      case 'custom_range': {
        if (customStartYear === customEndYear) {
          if (customStartMonth === customEndMonth) {
            return `${fullMonths[customStartMonth]} ${customStartYear}`;
          }
          return `${months[customStartMonth]} – ${months[customEndMonth]}, ${customStartYear}`;
        }
        return `${months[customStartMonth]} ${customStartYear} – ${months[customEndMonth]} ${customEndYear}`;
      }
      case 'current_year':
        return 'Current Year';
      default:
        return 'Current Month';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ height: 28, width: 120, bgcolor: '#f4f4f5', borderRadius: '4px' }} className="animate-pulse" />
        <Box sx={{ height: 400, width: '100%', bgcolor: '#f4f4f5', borderRadius: '12px' }} className="animate-pulse" />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: '8px' }}>
        Failed to load team members. Please verify connection and administrator privileges.
      </Alert>
    );
  }

  const getHealthColor = (score: number | null | undefined, status?: string) => {
    if (score === null || score === undefined || status === 'no_data') {
      return 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400';
    }
    if (score >= 90) return 'text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-400';
    if (score >= 80) return 'text-green-500 bg-green-50/50 dark:bg-green-950/10 dark:text-green-400';
    if (score >= 60) return 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400';
    if (score >= 40) return 'text-orange-500 bg-orange-50 dark:bg-orange-950/20 dark:text-orange-400';
    return 'text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400';
  };

  const getHealthBarColor = (score: number | null | undefined, status?: string) => {
    if (score === null || score === undefined || status === 'no_data') return 'inherit';
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  // Split team members list into Active and Deactivated
  const activeMembers = (teamMembers || []).filter((m) => m.status !== 'INACTIVE');
  const deactivatedMembers = (teamMembers || []).filter((m) => m.status === 'INACTIVE');
  const activeCount = activeMembers.length;
  const deactivatedCount = deactivatedMembers.length;

  const currentList = activeTab === 'active' ? activeMembers : deactivatedMembers;

  // Filter members based on debounced or instant search input matching Name, Email, or Role and Health Filter
  let processedMembers = currentList.filter((m) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = (
      m.name.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query) ||
      m.role.toLowerCase().includes(query)
    );
    
    if (!matchesSearch) return false;
    if (activeTab === 'active' && healthFilter !== 'all' && m.health_status !== healthFilter) return false;
    return true;
  });

  // Sort members
  processedMembers.sort((a, b) => {
    const isHealthSort = sortBy === 'health_low' || sortBy === 'health_high';
    const effectiveSortBy = (activeTab === 'deactivated' && isHealthSort) ? 'name' : sortBy;

    if (effectiveSortBy === 'health_low') {
      const valA = a.health_score ?? 100;
      const valB = b.health_score ?? 100;
      return valA - valB;
    }
    if (effectiveSortBy === 'health_high') {
      const valA = a.health_score ?? 100;
      const valB = b.health_score ?? 100;
      return valB - valA;
    }
    if (effectiveSortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (effectiveSortBy === 'pending_high') {
      return (b.pending_tasks ?? 0) - (a.pending_tasks ?? 0);
    }
    if (effectiveSortBy === 'overdue_high') {
      return (b.overdue_tasks ?? 0) - (a.overdue_tasks ?? 0);
    }
    return 0;
  });

  const getHealthFilterLabel = () => {
    switch (healthFilter) {
      case 'all': return 'All Statuses';
      case 'excellent': return 'Excellent';
      case 'healthy': return 'Healthy';
      case 'needs_attention': return 'Needs Attention';
      case 'at_risk': return 'At Risk';
      case 'critical': return 'Critical';
      default: return 'All Statuses';
    }
  };

  const getSortByLabel = () => {
    switch (sortBy) {
      case 'health_low': return 'Health: Low → High';
      case 'health_high': return 'Health: High → Low';
      case 'name': return 'Name: A → Z';
      case 'pending_high': return 'Pending: High → Low';
      case 'overdue_high': return 'Overdue: High → Low';
      default: return 'Health: Low → High';
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, pb: 8 }}>
      {/* Head section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            Team
          </Typography>
          <Typography variant="body2" sx={{ color: '#71717a', mt: 0.5 }}>
            Invite members and review their dynamic workloads.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => {
            resetForm();
            setIsAddOpen(true);
          }}
          sx={{
            py: 1,
            px: { xs: 1.5, md: 2.5 },
            bgcolor: 'text.primary',
            color: 'background.paper',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: '8px',
            boxShadow: 'none',
            fontSize: { xs: '12px', md: '14px' },
            '&:hover': { bgcolor: 'text.secondary', boxShadow: 'none' },
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Add Member</Box>
          <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>Member</Box>
        </Button>
      </Box>




      {/* Active vs Deactivated Tab Selection */}
      <Box sx={{ display: 'flex', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
        <Button
          onClick={() => {
            setActiveTab('active');
            setHealthFilter('all');
          }}
          sx={{
            textTransform: 'none',
            borderRadius: '20px',
            fontWeight: 700,
            fontSize: '13px',
            px: 3,
            py: 0.5,
            bgcolor: activeTab === 'active' ? 'text.primary' : 'transparent',
            color: activeTab === 'active' ? 'background.paper' : 'text.secondary',
            border: '1px solid',
            borderColor: activeTab === 'active' ? 'text.primary' : 'divider',
            '&:hover': {
              bgcolor: activeTab === 'active' ? 'text.secondary' : 'action.hover',
              borderColor: activeTab === 'active' ? 'text.secondary' : 'divider',
            }
          }}
        >
          Active {activeCount}
        </Button>
        <Button
          onClick={() => {
            setActiveTab('deactivated');
            setHealthFilter('all');
          }}
          sx={{
            textTransform: 'none',
            borderRadius: '20px',
            fontWeight: 700,
            fontSize: '13px',
            px: 3,
            py: 0.5,
            bgcolor: activeTab === 'deactivated' ? 'text.primary' : 'transparent',
            color: activeTab === 'deactivated' ? 'background.paper' : 'text.secondary',
            border: '1px solid',
            borderColor: activeTab === 'deactivated' ? 'text.primary' : 'divider',
            '&:hover': {
              bgcolor: activeTab === 'deactivated' ? 'text.secondary' : 'action.hover',
              borderColor: activeTab === 'deactivated' ? 'text.secondary' : 'divider',
            }
          }}
        >
          Deactivated {deactivatedCount}
        </Button>
      </Box>

      {/* Filters and Sorting bar */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search team members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} color="#71717a" />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            flex: 1,
            minWidth: '240px',
            maxWidth: '380px',
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              bgcolor: 'background.paper',
              '&:hover fieldset': { borderColor: 'divider' },
              '&.Mui-focused fieldset': { borderColor: 'text.primary', borderWidth: '1.5px' },
            },
          }}
        />

        {/* Health status filter */}
        {activeTab === 'active' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {/* Polished Health Status Trigger */}
            <Button
              onClick={(e) => setHealthAnchorEl(e.currentTarget)}
              variant="outlined"
              startIcon={<Heart size={15} />}
              endIcon={<span>▾</span>}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                borderColor: 'divider',
                color: 'text.primary',
                height: '40px',
                px: 2,
                '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' }
              }}
            >
              Health: {getHealthFilterLabel()}
            </Button>

            {/* Dropdown Menu for Health filter options */}
            <Menu
              anchorEl={healthAnchorEl}
              open={Boolean(healthAnchorEl)}
              onClose={() => setHealthAnchorEl(null)}
              slotProps={{
                paper: {
                  elevation: 1,
                  sx: {
                    border: '1px solid #e4e4e7',
                    borderRadius: '8px',
                    minWidth: 160,
                    '& .MuiMenuItem-root': {
                      fontSize: '13px',
                      fontWeight: 500,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      '&:hover': { bgcolor: '#f4f4f5' },
                    },
                  },
                },
              }}
            >
              <MenuItem
                onClick={() => {
                  setHealthFilter('all');
                  setHealthAnchorEl(null);
                }}
              >
                <span>All Statuses</span>
                {healthFilter === 'all' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setHealthFilter('excellent');
                  setHealthAnchorEl(null);
                }}
              >
                <span>Excellent</span>
                {healthFilter === 'excellent' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setHealthFilter('healthy');
                  setHealthAnchorEl(null);
                }}
              >
                <span>Healthy</span>
                {healthFilter === 'healthy' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setHealthFilter('needs_attention');
                  setHealthAnchorEl(null);
                }}
              >
                <span>Needs Attention</span>
                {healthFilter === 'needs_attention' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setHealthFilter('at_risk');
                  setHealthAnchorEl(null);
                }}
              >
                <span>At Risk</span>
                {healthFilter === 'at_risk' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setHealthFilter('critical');
                  setHealthAnchorEl(null);
                }}
              >
                <span>Critical</span>
                {healthFilter === 'critical' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
            </Menu>

            {/* Polished Period Selector Trigger */}
            <Button
              ref={mainButtonRef}
              onClick={(e) => setDropdownAnchorEl(e.currentTarget)}
              variant="outlined"
              startIcon={<Calendar size={15} />}
              endIcon={<span>▾</span>}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                borderColor: 'divider',
                color: 'text.primary',
                height: '40px',
                px: 2,
                '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' }
              }}
            >
              {getPeriodLabel()}
            </Button>

            {/* Dropdown Menu for options */}
            <Menu
              anchorEl={dropdownAnchorEl}
              open={Boolean(dropdownAnchorEl)}
              onClose={() => setDropdownAnchorEl(null)}
              slotProps={{
                paper: {
                  elevation: 1,
                  sx: {
                    border: '1px solid #e4e4e7',
                    borderRadius: '8px',
                    minWidth: 180,
                    '& .MuiMenuItem-root': {
                      fontSize: '13px',
                      fontWeight: 500,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      '&:hover': { bgcolor: '#f4f4f5' },
                    },
                  },
                },
              }}
            >
              <MenuItem
                onClick={() => {
                  setPeriodOption('current_month');
                  setDropdownAnchorEl(null);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Calendar size={14} className="text-zinc-550" />
                  <span>Current Month</span>
                </Box>
                {periodOption === 'current_month' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setDropdownAnchorEl(null);
                  setPickerType('month');
                  setViewYear(selectedYear);
                  setPickerAnchorEl(mainButtonRef.current);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GridIcon size={14} className="text-zinc-550" />
                  <span>Select Month</span>
                </Box>
                {periodOption === 'select_month' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setPeriodOption('last_3_months');
                  setDropdownAnchorEl(null);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <History size={14} className="text-zinc-550" />
                  <span>Last 3 Months</span>
                </Box>
                {periodOption === 'last_3_months' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setDropdownAnchorEl(null);
                  setPickerType('range');
                  setPickerAnchorEl(mainButtonRef.current);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ArrowLeftRight size={14} className="text-zinc-550" />
                  <span>Custom Range</span>
                </Box>
                {periodOption === 'custom_range' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setPeriodOption('current_year');
                  setDropdownAnchorEl(null);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircleDot size={14} className="text-zinc-550" />
                  <span>Current Year</span>
                </Box>
                {periodOption === 'current_year' && <Check size={14} className="text-zinc-800" />}
              </MenuItem>
            </Menu>

            {/* Dynamic Month/Range Picker Popover */}
            <Popover
              open={Boolean(pickerAnchorEl)}
              anchorEl={pickerAnchorEl}
              onClose={() => {
                setPickerAnchorEl(null);
                setPickerType(null);
              }}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              slotProps={{
                paper: {
                  sx: {
                    p: 2,
                    border: '1px solid #e4e4e7',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02)',
                    mt: 1,
                    maxWidth: 'calc(100vw - 32px)',
                  }
                }
              }}
            >
              {pickerType === 'month' && (
                <Box sx={{ width: 260 }}>
                  {/* Header with year pagination */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <IconButton size="small" onClick={() => setViewYear(prev => prev - 1)}>
                      <ChevronLeft size={16} />
                    </IconButton>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {viewYear}
                    </Typography>
                    <IconButton size="small" onClick={() => setViewYear(prev => prev + 1)}>
                      <ChevronRight size={16} />
                    </IconButton>
                  </Box>

                  {/* Grid of months */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {monthsList.map((m, idx) => {
                      const isSelected = selectedMonth === idx && selectedYear === viewYear;
                      return (
                        <Button
                          key={idx}
                          fullWidth
                          size="small"
                          variant={isSelected ? 'contained' : 'text'}
                          onClick={() => {
                            setSelectedMonth(idx);
                            setSelectedYear(viewYear);
                            setPeriodOption('select_month');
                            setPickerAnchorEl(null);
                            setPickerType(null);
                          }}
                          sx={{
                            textTransform: 'none',
                            fontWeight: isSelected ? 800 : 500,
                            borderRadius: '6px',
                            py: 1,
                            fontSize: '12px',
                            bgcolor: isSelected ? 'text.primary' : 'transparent',
                            color: isSelected ? 'background.paper' : 'text.primary',
                            '&:hover': {
                              bgcolor: isSelected ? 'text.secondary' : 'action.hover',
                            }
                          }}
                        >
                          {m.substring(0, 3)}
                        </Button>
                      );
                    })}
                  </div>
                </Box>
              )}

              {pickerType === 'range' && (
                isMobile ? (
                  /* Mobile View: Single Panel with tabs */
                  <Box sx={{ width: 240 }}>
                    {/* Step Toggle Tabs */}
                    <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
                      <Button
                        fullWidth
                        size="small"
                        onClick={() => setRangeStep('start')}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '11px',
                          borderRadius: 0,
                          borderBottom: rangeStep === 'start' ? '2px solid' : '2px solid transparent',
                          borderColor: rangeStep === 'start' ? 'text.primary' : 'transparent',
                          color: rangeStep === 'start' ? 'text.primary' : 'text.secondary',
                          py: 1,
                          minWidth: 0
                        }}
                      >
                        Start: {monthsList[customStartMonth].substring(0, 3)} {customStartYear}
                      </Button>
                      <Button
                        fullWidth
                        size="small"
                        onClick={() => setRangeStep('end')}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '11px',
                          borderRadius: 0,
                          borderBottom: rangeStep === 'end' ? '2px solid' : '2px solid transparent',
                          borderColor: rangeStep === 'end' ? 'text.primary' : 'transparent',
                          color: rangeStep === 'end' ? 'text.primary' : 'text.secondary',
                          py: 1,
                          minWidth: 0
                        }}
                      >
                        End: {monthsList[customEndMonth].substring(0, 3)} {customEndYear}
                      </Button>
                    </Box>

                    {rangeStep === 'start' ? (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <IconButton size="small" onClick={() => setCustomStartYear(prev => prev - 1)}>
                            <ChevronLeft size={14} />
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {customStartYear}
                          </Typography>
                          <IconButton size="small" onClick={() => setCustomStartYear(prev => prev + 1)}>
                            <ChevronRight size={14} />
                          </IconButton>
                        </Box>
                        <div className="grid grid-cols-3 gap-1">
                          {monthsList.map((m, idx) => {
                            const isSelected = customStartMonth === idx;
                            return (
                              <Button
                                key={idx}
                                fullWidth
                                size="small"
                                variant={isSelected ? 'contained' : 'text'}
                                onClick={() => {
                                  setCustomStartMonth(idx);
                                  setRangeStep('end');
                                }}
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  py: 0.5,
                                  bgcolor: isSelected ? 'text.primary' : 'transparent',
                                  color: isSelected ? 'background.paper' : 'text.primary',
                                  '&:hover': { bgcolor: isSelected ? 'text.secondary' : 'action.hover' }
                                }}
                              >
                                {m.substring(0, 3)}
                              </Button>
                            );
                          })}
                        </div>
                      </Box>
                    ) : (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <IconButton size="small" onClick={() => setCustomEndYear(prev => prev - 1)}>
                            <ChevronLeft size={14} />
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {customEndYear}
                          </Typography>
                          <IconButton size="small" onClick={() => setCustomEndYear(prev => prev + 1)}>
                            <ChevronRight size={14} />
                          </IconButton>
                        </Box>
                        <div className="grid grid-cols-3 gap-1">
                          {monthsList.map((m, idx) => {
                            const isSelected = customEndMonth === idx;
                            return (
                              <Button
                                key={idx}
                                fullWidth
                                size="small"
                                variant={isSelected ? 'contained' : 'text'}
                                onClick={() => setCustomEndMonth(idx)}
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  py: 0.5,
                                  bgcolor: isSelected ? 'text.primary' : 'transparent',
                                  color: isSelected ? 'background.paper' : 'text.primary',
                                  '&:hover': { bgcolor: isSelected ? 'text.secondary' : 'action.hover' }
                                }}
                              >
                                {m.substring(0, 3)}
                              </Button>
                            );
                          })}
                        </div>
                      </Box>
                    )}

                    {/* Validation and Apply Button */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      {!isCustomRangeValid() && (
                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 650, textAlign: 'center' }}>
                          Start month cannot be after End month.
                        </Typography>
                      )}
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        disabled={!isCustomRangeValid()}
                        onClick={() => {
                          setPeriodOption('custom_range');
                          setPickerAnchorEl(null);
                          setPickerType(null);
                        }}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          borderRadius: '6px',
                          bgcolor: 'text.primary',
                          color: 'background.paper',
                          '&:hover': { bgcolor: 'text.secondary' }
                        }}
                      >
                        Apply Range
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  /* Desktop View: Side-by-side Panels */
                  <Box sx={{ width: 440 }}>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                      {/* Left Side: Start Month Picker */}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', fontSize: '9px', tracking: '0.05em' }}>
                          Start Month
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <IconButton size="small" onClick={() => setCustomStartYear(prev => prev - 1)}>
                            <ChevronLeft size={14} />
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {customStartYear}
                          </Typography>
                          <IconButton size="small" onClick={() => setCustomStartYear(prev => prev + 1)}>
                            <ChevronRight size={14} />
                          </IconButton>
                        </Box>
                        <div className="grid grid-cols-3 gap-1">
                          {monthsList.map((m, idx) => {
                            const isSelected = customStartMonth === idx;
                            return (
                              <Button
                                key={idx}
                                fullWidth
                                size="small"
                                variant={isSelected ? 'contained' : 'text'}
                                onClick={() => setCustomStartMonth(idx)}
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  py: 0.5,
                                  bgcolor: isSelected ? 'text.primary' : 'transparent',
                                  color: isSelected ? 'background.paper' : 'text.primary',
                                  '&:hover': { bgcolor: isSelected ? 'text.secondary' : 'action.hover' }
                                }}
                              >
                                {m.substring(0, 3)}
                              </Button>
                            );
                          })}
                        </div>
                      </Box>

                      {/* Right Side: End Month Picker */}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', fontSize: '9px', tracking: '0.05em' }}>
                          End Month
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <IconButton size="small" onClick={() => setCustomEndYear(prev => prev - 1)}>
                            <ChevronLeft size={14} />
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {customEndYear}
                          </Typography>
                          <IconButton size="small" onClick={() => setCustomEndYear(prev => prev + 1)}>
                            <ChevronRight size={14} />
                          </IconButton>
                        </Box>
                        <div className="grid grid-cols-3 gap-1">
                          {monthsList.map((m, idx) => {
                            const isSelected = customEndMonth === idx;
                            return (
                              <Button
                                key={idx}
                                fullWidth
                                size="small"
                                variant={isSelected ? 'contained' : 'text'}
                                onClick={() => setCustomEndMonth(idx)}
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  py: 0.5,
                                  bgcolor: isSelected ? 'text.primary' : 'transparent',
                                  color: isSelected ? 'background.paper' : 'text.primary',
                                  '&:hover': { bgcolor: isSelected ? 'text.secondary' : 'action.hover' }
                                }}
                              >
                                {m.substring(0, 3)}
                              </Button>
                            );
                          })}
                        </div>
                      </Box>
                    </Box>

                    {/* Validation and Apply Button */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      {!isCustomRangeValid() ? (
                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 650 }}>
                          Start month cannot be after End month.
                        </Typography>
                      ) : (
                        <div />
                      )}
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!isCustomRangeValid()}
                        onClick={() => {
                          setPeriodOption('custom_range');
                          setPickerAnchorEl(null);
                          setPickerType(null);
                        }}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          borderRadius: '6px',
                          bgcolor: 'text.primary',
                          color: 'background.paper',
                          '&:hover': { bgcolor: 'text.secondary' }
                        }}
                      >
                        Apply Range
                      </Button>
                    </Box>
                  </Box>
                )
              )}
            </Popover>
          </Box>
        )}

        {/* Sorting filter */}
        {/* Polished Sort Trigger */}
        <Button
          onClick={(e) => setSortAnchorEl(e.currentTarget)}
          variant="outlined"
          startIcon={<ArrowUpDown size={15} />}
          endIcon={<span>▾</span>}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: '8px',
            borderColor: 'divider',
            color: 'text.primary',
            height: '40px',
            px: 2,
            whiteSpace: 'nowrap',
            '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' }
          }}
        >
          Sort: {getSortByLabel()}
        </Button>

        {/* Dropdown Menu for Sort options */}
        <Menu
          anchorEl={sortAnchorEl}
          open={Boolean(sortAnchorEl)}
          onClose={() => setSortAnchorEl(null)}
          slotProps={{
            paper: {
              elevation: 1,
              sx: {
                border: '1px solid #e4e4e7',
                borderRadius: '8px',
                minWidth: 180,
                '& .MuiMenuItem-root': {
                  fontSize: '13px',
                  fontWeight: 500,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  '&:hover': { bgcolor: '#f4f4f5' },
                },
              },
            },
          }}
        >
          {activeTab === 'active' && (
            <MenuItem
              onClick={() => {
                setSortBy('health_low');
                setSortAnchorEl(null);
              }}
            >
              <span>Health: Low → High</span>
              {sortBy === 'health_low' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
          )}
          {activeTab === 'active' && (
            <MenuItem
              onClick={() => {
                setSortBy('health_high');
                setSortAnchorEl(null);
              }}
            >
              <span>Health: High → Low</span>
              {sortBy === 'health_high' && <Check size={14} className="text-zinc-800" />}
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              setSortBy('name');
              setSortAnchorEl(null);
            }}
          >
            <span>Name: A → Z</span>
            {sortBy === 'name' && <Check size={14} className="text-zinc-800" />}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setSortBy('pending_high');
              setSortAnchorEl(null);
            }}
          >
            <span>Pending: High → Low</span>
            {sortBy === 'pending_high' && <Check size={14} className="text-zinc-800" />}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setSortBy('overdue_high');
              setSortAnchorEl(null);
            }}
          >
            <span>Overdue: High → Low</span>
            {sortBy === 'overdue_high' && <Check size={14} className="text-zinc-800" />}
          </MenuItem>
        </Menu>
      </Box>

      {/* Grid of Team Member Cards */}
      {processedMembers.length === 0 ? (
        <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: '16px', p: 8, textAlign: 'center', bgcolor: 'background.paper' }}>
          <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            No team members found
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            No members match the selected criteria.
          </Typography>
        </Box>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {processedMembers.map((member) => (
            <div key={member.id}>
              {activeTab === 'active' ? (
                <Paper
                  elevation={0}
                  onClick={() => handleCardClick(member.id)}
                  sx={{
                    p: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '16px',
                    bgcolor: 'background.paper',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'text.primary',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                    },
                  }}
                >
                  {/* Avatar, Name, Role, Actions Button */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={member.avatar_url || undefined}
                        sx={{
                          width: 48,
                          height: 48,
                          bgcolor: 'action.selected',
                          color: 'text.secondary',
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        {getInitials(member.name)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                          {member.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          {member.role === 'ORG_ADMIN' ? 'Org Admin' : member.role === 'ADMIN' ? 'Admin/Manager' : 'Member'}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMenu(e, member);
                      }}
                    >
                      <MoreVertical size={16} />
                    </IconButton>
                  </Box>

                  {/* Health Progress Section */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          Health
                        </Typography>
                        <Tooltip title="Health score based on completed tasks punctuality and workload.">
                          <HelpCircle size={12} className="text-zinc-400 cursor-help" />
                        </Tooltip>
                      </Box>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary' }}>
                        {member.health_score !== null && member.health_score !== undefined ? `${member.health_score}%` : '—'}
                      </Typography>
                    </Box>
                    
                    <LinearProgress
                      variant="determinate"
                      value={member.health_score !== null && member.health_score !== undefined ? member.health_score : 0}
                      color={getHealthBarColor(member.health_score, member.health_status)}
                      sx={{ 
                        height: 6, 
                        borderRadius: 3, 
                        mb: 1,
                        ...(member.health_score === null || member.health_score === undefined ? {
                          bgcolor: 'action.disabledBackground',
                          '& .MuiLinearProgress-bar': { bgcolor: 'text.disabled' }
                        } : {})
                      }}
                    />
                    
                    <span className={`text-[10px] font-bold py-0.5 px-2 rounded-full uppercase tracking-wide ${getHealthColor(member.health_score, member.health_status)}`}>
                      {member.health_status === 'no_data' ? 'no data' : (member.health_status?.replace('_', ' ') || 'healthy')}
                    </span>
                  </Box>

                  {/* Workload Counts */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, borderTop: '1px solid', borderColor: 'divider', pt: 2, mb: 2 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                        PENDING
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', mt: 0.5 }}>
                        {member.pending_tasks ?? 0}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                        TODAY
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', mt: 0.5 }}>
                        {member.today_tasks ?? 0}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                        OVERDUE
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: member.overdue_tasks && member.overdue_tasks > 0 ? 'error.main' : 'text.primary', mt: 0.5 }}>
                        {member.overdue_tasks ?? 0}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                      Completed: <span className="font-bold text-text-primary">{member.completed_this_week ?? 0} (Wk)</span> · Late: <span className={`font-bold ${member.late_completions && member.late_completions > 0 ? 'text-red-500' : 'text-text-primary'}`}>{member.late_completions ?? 0}</span>
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.primary', fontSize: '11px', fontWeight: 700 }}>
                      <span>View Details</span>
                      <span style={{ fontSize: '12px' }}>→</span>
                    </Box>
                  </Box>
                </Paper>
              ) : (
                <Paper
                  elevation={0}
                  onClick={() => handleCardClick(member.id)}
                  sx={{
                    p: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '16px',
                    bgcolor: 'background.paper',
                    cursor: 'pointer',
                    position: 'relative',
                    opacity: 0.85,
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'text.primary',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                      opacity: 1,
                    },
                  }}
                >
                  {/* Avatar, Name, Role, Actions Button */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={member.avatar_url || undefined}
                        sx={{
                          width: 48,
                          height: 48,
                          bgcolor: 'action.selected',
                          color: 'text.secondary',
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        {getInitials(member.name)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                          {member.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          {member.role === 'ORG_ADMIN' ? 'Org Admin' : member.role === 'ADMIN' ? 'Admin/Manager' : 'Member'}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMenu(e, member);
                      }}
                    >
                      <MoreVertical size={16} />
                    </IconButton>
                  </Box>

                  {/* Deactivated status info */}
                  <Box sx={{ mb: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <span className="text-[10px] font-bold py-0.5 px-2 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-full uppercase tracking-wide w-fit">
                      Deactivated
                    </span>
                    {member.deactivated_at && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mt: 1 }}>
                        Deactivated on: {new Date(member.deactivated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                    )}
                    {member.health_score !== undefined && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 650 }}>
                        Previous Health: <span className="font-bold text-text-primary">{member.health_score}%</span>
                      </Typography>
                    )}
                  </Box>

                  {/* Workload Counts */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, borderTop: '1px solid', borderColor: 'divider', pt: 2, mb: 3 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                        PENDING TASKS
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', mt: 0.5 }}>
                        {member.pending_tasks ?? 0}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                        COMPLETED (MO)
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', mt: 0.5 }}>
                        {member.completed_this_month ?? 0}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(member.id);
                      }}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: '8px',
                        fontSize: '11px',
                        borderColor: 'divider',
                        color: 'text.primary',
                        '&:hover': { borderColor: 'text.primary' }
                      }}
                    >
                      View Profile
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      fullWidth
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenReactivate(member);
                      }}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: '8px',
                        fontSize: '11px',
                        bgcolor: 'text.primary',
                        color: 'background.paper',
                        '&:hover': { bgcolor: 'text.secondary' }
                      }}
                    >
                      Reactivate
                    </Button>
                  </Box>
                </Paper>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rounded Actions Popover Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        slotProps={{
          paper: {
            elevation: 1,
            sx: {
              border: '1px solid #e4e4e7',
              borderRadius: '8px',
              minWidth: 160,
              '& .MuiMenuItem-root': {
                fontSize: '13px',
                fontWeight: 500,
                py: 1,
                '&:hover': { bgcolor: '#f4f4f5' },
              },
            },
          },
        }}
      >
        <MenuItem onClick={handleViewWorkload}>View</MenuItem>
        <MenuItem onClick={handleOpenEdit}>Edit</MenuItem>
        <MenuItem
          onClick={handleResendInvite}
          disabled={selectedUser?.status !== 'INVITED' || resendMutation.isPending}
        >
          Resend Invitation
        </MenuItem>
        {selectedUser?.status === 'INACTIVE' ? (
          <MenuItem
            onClick={() => handleOpenReactivate(selectedUser)}
            disabled={reactivateMutation.isPending}
          >
            Reactivate
          </MenuItem>
        ) : (
          <MenuItem
            onClick={handleOpenDeactivate}
            disabled={
              selectedUser?.id === currentUser?.id ||
              deactivateMutation.isPending
            }
            sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}
          >
            Deactivate
          </MenuItem>
        )}
      </Menu>

      {/* ADD DIALOG */}
      <Dialog
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        slotProps={{
          paper: {
            sx: { borderRadius: '12px', maxWidth: '420px', width: '100%', p: 1 },
          },
        }}
      >
        <Box component="form" onSubmit={handleAddSubmit}>
          <DialogTitle sx={{ fontWeight: 750, fontSize: '18px', pb: 1 }}>Add Team Member</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '10px !important' }}>
            <TextField
              label="Name"
              placeholder="Sarah Thomas"
              required
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><UserIcon size={14} /></InputAdornment> } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />
            <TextField
              label="Email"
              placeholder="sarah@example.com"
              type="email"
              required
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Mail size={14} /></InputAdornment> } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as any)}>
                <MenuItem value="MEMBER">Member</MenuItem>
                <MenuItem value="ADMIN">Admin/Manager</MenuItem>
              </Select>
            </FormControl>


            {/* Avatar input */}
            <Box>
              <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 600, display: 'block', mb: 1 }}>
                Profile Picture (Optional)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar src={avatarPreview || undefined} sx={{ width: 44, height: 44 }} />
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  startIcon={<Upload size={14} />}
                  sx={{
                    borderRadius: '8px',
                    borderColor: '#e4e4e7',
                    color: '#27272a',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': { borderColor: '#a1a1aa', bgcolor: '#fafafa' },
                  }}
                >
                  Upload File
                  <input type="file" hidden accept="image/*" onChange={handleAvatarChange} />
                </Button>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setIsAddOpen(false)}
              color="inherit"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={inviteMutation.isPending}
              sx={{
                bgcolor: 'text.primary',
                color: 'background.paper',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                boxShadow: 'none',
                '&:hover': { bgcolor: 'text.secondary', boxShadow: 'none' },
              }}
            >
              Send Invitation
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEmailVerifyStep(1);
          setEmailVerifyOtp('');
          setVerifyError(null);
        }}
        slotProps={{
          paper: {
            sx: { borderRadius: '12px', maxWidth: '420px', width: '100%', p: 1 },
          },
        }}
      >
        <Box component="form" onSubmit={handleEditSubmit}>
          <DialogTitle sx={{ fontWeight: 750, fontSize: '18px', pb: 1 }}>
            {emailVerifyStep === 1 ? 'Edit Team Member' : 'Verify Email Change'}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '10px !important' }}>
            {verifyError && (
              <Alert severity="error" sx={{ borderRadius: '8px', fontSize: '13px' }}>
                {verifyError}
              </Alert>
            )}

            {emailVerifyStep === 1 ? (
              <>
                <TextField
                  label="Name"
                  required
                  fullWidth
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
                <TextField
                  label="Email"
                  type="email"
                  required
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
                <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
                  <InputLabel>Role</InputLabel>
                  <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as any)}>
                    <MenuItem value="MEMBER">Member</MenuItem>
                    <MenuItem value="ADMIN">Admin/Manager</MenuItem>
                  </Select>
                </FormControl>

                <Box>
                  <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 600, display: 'block', mb: 1 }}>
                    Profile Picture
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar src={avatarPreview || undefined} sx={{ width: 44, height: 44 }} />
                    <Button
                      component="label"
                      variant="outlined"
                      size="small"
                      startIcon={<Upload size={14} />}
                      sx={{
                        borderRadius: '8px',
                        borderColor: '#e4e4e7',
                        color: '#27272a',
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': { borderColor: '#a1a1aa', bgcolor: '#fafafa' },
                      }}
                    >
                      Upload File
                      <input type="file" hidden accept="image/*" onChange={handleAvatarChange} />
                    </Button>
                  </Box>
                </Box>
              </>
            ) : (
              <>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  A verification code has been sent to the new email address: <strong>{email}</strong>.
                </Typography>
                <TextField
                  label="Verification Code"
                  required
                  fullWidth
                  value={emailVerifyOtp}
                  onChange={(e) => setEmailVerifyOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  placeholder="123456"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
              </>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => {
                if (emailVerifyStep === 2) {
                  setEmailVerifyStep(1);
                  setVerifyError(null);
                } else {
                  setIsEditOpen(false);
                }
              }}
              color="inherit"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {emailVerifyStep === 2 ? 'Back' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={editMutation.isPending || isVerifyingEmail}
              sx={{
                bgcolor: 'text.primary',
                color: 'background.paper',
                fontWeight: 600,
                borderRadius: '8px',
                textTransform: 'none',
                px: 2.5,
                '&:hover': { bgcolor: 'text.secondary' },
              }}
            >
              {isVerifyingEmail 
                ? 'Verifying...' 
                : (editMutation.isPending ? 'Saving...' : (emailVerifyStep === 2 ? 'Verify & Save' : 'Save Changes'))}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* DEACTIVATE CONFIRMATION */}
      <Dialog
        open={isDeactivateOpen}
        onClose={() => setIsDeactivateOpen(false)}
        slotProps={{
          paper: {
            sx: { borderRadius: '12px', maxWidth: '380px' },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 750, fontSize: '17px' }}>
          Deactivate Member?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '13.5px', color: '#52525b', lineHeight: 1.5 }}>
            {selectedUser?.name} will be removed from the active Team and will no longer be available for new task assignments. Existing tasks and historical activity will be preserved.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setIsDeactivateOpen(false)}
            color="inherit"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeactivateConfirm}
            variant="contained"
            color="error"
            disabled={deactivateMutation.isPending}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              boxShadow: 'none',
            }}
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      {/* REACTIVATE CONFIRMATION */}
      <Dialog
        open={isReactivateOpen}
        onClose={() => setIsReactivateOpen(false)}
        slotProps={{
          paper: {
            sx: { borderRadius: '12px', maxWidth: '380px' },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 750, fontSize: '17px' }}>
          Reactivate Member?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '13.5px', color: '#52525b', lineHeight: 1.5 }}>
            {userToReactivate?.name} will return to the active Team and become available for new task assignments.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setIsReactivateOpen(false)}
            color="inherit"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReactivateConfirm}
            variant="contained"
            disabled={reactivateMutation.isPending}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              boxShadow: 'none',
              bgcolor: 'text.primary',
              color: 'background.paper',
              '&:hover': { bgcolor: 'text.secondary' }
            }}
          >
            Reactivate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar feedback toasts */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToastMessage(null)}
          severity={toastSeverity}
          sx={{ borderRadius: '8px', border: '1px solid', borderColor: toastSeverity === 'success' ? '#bbf7d0' : '#fee2e2' }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>

      {/* Team Detail Drawer */}
      <TeamDetailDrawer
        memberId={drawerMemberId}
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setDrawerMemberId(null);
        }}
        onCreateTask={(memberId) => {
          setPreselectedMemberId(memberId);
          setIsTaskFormOpen(true);
        }}
        startDate={start_date}
        endDate={end_date}
      />


      {/* Task Creation Modal Form */}
      <TaskFormModal
        isOpen={isTaskFormOpen}
        onClose={() => {
          setIsTaskFormOpen(false);
          setPreselectedMemberId(null);
        }}
        defaultAssigneeId={preselectedMemberId}
      />
    </Box>
  );
};
