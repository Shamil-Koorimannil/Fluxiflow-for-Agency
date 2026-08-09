import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { User } from '../../types';
import { useAuth } from '../auth/AuthContext';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Avatar,
  Snackbar,
  Alert,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
} from '@mui/material';
import {
  MoreVertical,
  Plus,
  Search,
  User as UserIcon,
  Mail,
  Lock,
  Upload,
} from 'lucide-react';

export const Team: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Dialog open states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Success toast/snackbar
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error'>('success');

  // Fetch Team List
  const { data: teamMembers, isLoading, error } = useQuery<User[]>({
    queryKey: ['team'],
    queryFn: async () => {
      const response = await api.get('/team/');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setIsAddOpen(false);
      resetForm();
      showToast('Invitation sent successfully.', 'success');
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
      navigate(`/app/team/${selectedUser.id}`);
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
    if (password) {
      formData.append('password', password);
    }
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }
    inviteMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!name || !email) {
      showToast('Please fill in Name and Email.', 'error');
      return;
    }
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('role', role);
    if (password) {
      formData.append('password', password);
    }
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
    setPassword('');
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

  const getStatusChip = (statusVal: string) => {
    switch (statusVal) {
      case 'ACTIVE':
        return (
          <Chip
            label="Active"
            size="small"
            sx={{
              bgcolor: '#f0fdf4',
              color: '#16a34a',
              border: '1px solid #bbf7d0',
              fontWeight: 600,
              fontSize: '11px',
              borderRadius: '6px',
            }}
          />
        );
      case 'INACTIVE':
        return (
          <Chip
            label="Inactive"
            size="small"
            sx={{
              bgcolor: '#f4f4f5',
              color: '#71717a',
              border: '1px solid #e4e4e7',
              fontWeight: 600,
              fontSize: '11px',
              borderRadius: '6px',
            }}
          />
        );
      case 'INVITED':
      default:
        return (
          <Chip
            label="Invited"
            size="small"
            sx={{
              bgcolor: '#f5f5f5',
              color: '#52525b',
              border: '1px solid #e5e5e5',
              fontWeight: 600,
              fontSize: '11px',
              borderRadius: '6px',
            }}
          />
        );
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
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

  // Filter members based on debounced or instant search input matching Name, Email, or Role
  const filteredMembers = (teamMembers || []).filter((m) => {
    const query = searchQuery.toLowerCase().trim();
    return (
      m.name.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query) ||
      m.role.toLowerCase().includes(query)
    );
  });

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
            px: 2.5,
            bgcolor: '#000000',
            color: '#ffffff',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: '8px',
            boxShadow: 'none',
            '&:hover': { bgcolor: '#27272a', boxShadow: 'none' },
          }}
        >
          Add Member
        </Button>
      </Box>

      {/* Search Input bar */}
      <TextField
        placeholder="Search team members..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        fullWidth
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
          maxWidth: '380px',
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            bgcolor: '#ffffff',
            '&:hover fieldset': { borderColor: '#a1a1aa' },
            '&.Mui-focused fieldset': { borderColor: '#000000', borderWidth: '1.5px' },
          },
        }}
      />

      {/* Desktop MUI Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: '1px solid #e4e4e7',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ bgcolor: '#fafafa' }}>
            <TableRow sx={{ borderBottom: '1px solid #e4e4e7' }}>
              <TableCell sx={{ fontWeight: 700, fontSize: '12px', color: '#71717a', py: 1.5 }}>MEMBER</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '12px', color: '#71717a', py: 1.5 }}>EMAIL</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '12px', color: '#71717a', py: 1.5 }}>ROLE</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '12px', color: '#71717a', py: 1.5 }}>STATUS</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '12px', color: '#71717a', py: 1.5 }}>PENDING</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '12px', color: '#71717a', py: 1.5 }}>TODAY</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '12px', color: '#71717a', py: 1.5 }}>COMPLETED</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, fontSize: '12px', color: '#71717a', py: 1.5 }}>ACTIONS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#a1a1aa' }}>
                  No members found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
                <TableRow
                  key={member.id}
                  hover
                  sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    borderBottom: '1px solid #f4f4f5',
                  }}
                >
                  {/* Name and Avatar */}
                  <TableCell sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                      <Avatar
                        src={member.avatar_url || undefined}
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: '#f4f4f5',
                          color: '#52525b',
                          fontSize: '12px',
                          fontWeight: 700,
                          border: '1px solid #e4e4e7',
                        }}
                      >
                        {getInitials(member.name)}
                      </Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#000000' }}>
                        {member.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#52525b', py: 2 }}>{member.email}</TableCell>
                  <TableCell sx={{ color: '#52525b', py: 2 }}>
                    {member.role === 'ADMIN' ? 'Admin/Manager' : 'Member'}
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>{getStatusChip(member.status)}</TableCell>
                  <TableCell sx={{ fontWeight: 500, color: '#71717a', py: 2 }}>
                    {member.pending_tasks_count !== undefined ? `${member.pending_tasks_count} Pending` : '-'}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500, color: '#71717a', py: 2 }}>
                    {member.today_tasks_count !== undefined ? `${member.today_tasks_count} Today` : '-'}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500, color: '#71717a', py: 2 }}>
                    {member.completed_tasks_count !== undefined ? `${member.completed_tasks_count} Completed` : '-'}
                  </TableCell>
                  {/* Actions three dots */}
                  <TableCell align="right" sx={{ py: 2 }}>
                    <IconButton size="small" onClick={(e) => handleOpenMenu(e, member)}>
                      <MoreVertical size={16} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

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
        <MenuItem
          onClick={handleOpenDeactivate}
          disabled={
            selectedUser?.id === currentUser?.id ||
            selectedUser?.status === 'INACTIVE' ||
            deactivateMutation.isPending
          }
          sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}
        >
          Deactivate
        </MenuItem>
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
            <TextField
              label="Password (Optional)"
              placeholder="••••••••"
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Lock size={14} /></InputAdornment> } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

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
                bgcolor: '#000000',
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#27272a', boxShadow: 'none' },
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
        onClose={() => setIsEditOpen(false)}
        slotProps={{
          paper: {
            sx: { borderRadius: '12px', maxWidth: '420px', width: '100%', p: 1 },
          },
        }}
      >
        <Box component="form" onSubmit={handleEditSubmit}>
          <DialogTitle sx={{ fontWeight: 750, fontSize: '18px', pb: 1 }}>Edit Team Member</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '10px !important' }}>
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
            <TextField
              label="New Password (Optional)"
              placeholder="••••••••"
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Lock size={14} /></InputAdornment> } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

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
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setIsEditOpen(false)}
              color="inherit"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={editMutation.isPending}
              sx={{
                bgcolor: '#000000',
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#27272a', boxShadow: 'none' },
              }}
            >
              Save Changes
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
          Deactivate {selectedUser?.name}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '13.5px', color: '#52525b', lineHeight: 1.5 }}>
            {selectedUser?.name} will no longer be able to access Fluxiflow for Agency. Their historical tasks and
            activity records will remain.
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
    </Box>
  );
};
