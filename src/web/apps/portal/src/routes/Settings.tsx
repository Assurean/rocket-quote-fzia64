import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Box, 
  Typography, 
  Button, 
  Switch, 
  Dialog,
  CircularProgress 
} from '@mui/material';
import QRCode from 'qrcode.react';
import Input from '@shared/components/forms/Input';
import Card from '@shared/components/layout/Card';
import Alert from '@shared/components/feedback/Alert';
import { useAuth } from '../../hooks/useAuth';

// Types for settings management
interface SecuritySettings {
  twoFactorEnabled: boolean;
  backupCodes: string[];
  lastPasswordChange: Date;
  activeSessions: Array<{
    id: string;
    device: string;
    lastActive: Date;
    location: string;
  }>;
}

interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  leadAlerts: boolean;
  campaignUpdates: boolean;
  securityAlerts: boolean;
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
}

const Settings: React.FC = () => {
  const { user, updateProfile, setup2FA, verify2FA, disable2FA, generateBackupCodes } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // State for different settings sections
  const [profileData, setProfileData] = useState<ProfileFormData>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    company: user?.company || ''
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    backupCodes: [],
    lastPasswordChange: new Date(),
    activeSessions: []
  });

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    emailNotifications: true,
    pushNotifications: true,
    leadAlerts: true,
    campaignUpdates: true,
    securityAlerts: true
  });

  // 2FA setup states
  const [show2FADialog, setShow2FADialog] = useState<boolean>(false);
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [totpCode, setTotpCode] = useState<string>('');

  // Load user settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        // Load security settings, profile data, and notification preferences
        // Implementation would fetch from API
        setLoading(false);
      } catch (err) {
        setError('Failed to load settings');
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await updateProfile(profileData);
      setSuccess('Profile updated successfully');
      setLoading(false);
    } catch (err) {
      setError('Failed to update profile');
      setLoading(false);
    }
  };

  // Handle 2FA setup
  const handle2FASetup = async () => {
    try {
      setLoading(true);
      const { qrCode, secret } = await setup2FA();
      setQrCodeData(qrCode);
      setShow2FADialog(true);
      setLoading(false);
    } catch (err) {
      setError('Failed to setup 2FA');
      setLoading(false);
    }
  };

  // Verify 2FA setup
  const handleVerify2FA = async () => {
    try {
      setLoading(true);
      await verify2FA(totpCode);
      const backupCodes = await generateBackupCodes();
      setSecuritySettings(prev => ({
        ...prev,
        twoFactorEnabled: true,
        backupCodes
      }));
      setSuccess('2FA enabled successfully. Please save your backup codes.');
      setShow2FADialog(false);
      setLoading(false);
    } catch (err) {
      setError('Invalid verification code');
      setLoading(false);
    }
  };

  // Handle session termination
  const handleTerminateSession = async (sessionId: string) => {
    try {
      setLoading(true);
      // Implementation would call API to terminate session
      setSecuritySettings(prev => ({
        ...prev,
        activeSessions: prev.activeSessions.filter(session => session.id !== sessionId)
      }));
      setSuccess('Session terminated successfully');
      setLoading(false);
    } catch (err) {
      setError('Failed to terminate session');
      setLoading(false);
    }
  };

  return (
    <Box sx={{ padding: 3 }}>
      {/* Alerts */}
      {error && (
        <Alert 
          severity="error" 
          message={error}
          onClose={() => setError(null)}
        />
      )}
      {success && (
        <Alert 
          severity="success" 
          message={success}
          onClose={() => setSuccess(null)}
        />
      )}

      {/* Profile Settings */}
      <Card elevation={1} padding="lg">
        <Typography variant="h5" gutterBottom>Profile Settings</Typography>
        <form onSubmit={handleProfileUpdate}>
          <Input
            id="firstName"
            name="firstName"
            label="First Name"
            value={profileData.firstName}
            onChange={e => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
            required
          />
          <Input
            id="lastName"
            name="lastName"
            label="Last Name"
            value={profileData.lastName}
            onChange={e => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
            required
          />
          <Input
            id="email"
            name="email"
            type="email"
            label="Email"
            value={profileData.email}
            onChange={e => setProfileData(prev => ({ ...prev, email: e.target.value }))}
            required
          />
          <Input
            id="phone"
            name="phone"
            type="tel"
            label="Phone"
            value={profileData.phone}
            onChange={e => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
          />
          <Input
            id="company"
            name="company"
            label="Company"
            value={profileData.company}
            onChange={e => setProfileData(prev => ({ ...prev, company: e.target.value }))}
          />
          <Button 
            type="submit" 
            variant="contained" 
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Update Profile'}
          </Button>
        </form>
      </Card>

      {/* Security Settings */}
      <Card elevation={1} padding="lg" sx={{ mt: 3 }}>
        <Typography variant="h5" gutterBottom>Security Settings</Typography>
        
        {/* 2FA Configuration */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Two-Factor Authentication</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Switch
              checked={securitySettings.twoFactorEnabled}
              onChange={() => !securitySettings.twoFactorEnabled && handle2FASetup()}
              disabled={loading}
            />
            <Typography>
              {securitySettings.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </Typography>
          </Box>
          {securitySettings.twoFactorEnabled && (
            <Button 
              variant="outlined" 
              color="error"
              onClick={() => disable2FA()}
              disabled={loading}
            >
              Disable 2FA
            </Button>
          )}
        </Box>

        {/* Active Sessions */}
        <Box>
          <Typography variant="h6" gutterBottom>Active Sessions</Typography>
          {securitySettings.activeSessions.map(session => (
            <Box 
              key={session.id} 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 2 
              }}
            >
              <Box>
                <Typography variant="body1">{session.device}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {session.location} • Last active: {new Date(session.lastActive).toLocaleString()}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => handleTerminateSession(session.id)}
                disabled={loading}
              >
                Terminate
              </Button>
            </Box>
          ))}
        </Box>
      </Card>

      {/* Notification Preferences */}
      <Card elevation={1} padding="lg" sx={{ mt: 3 }}>
        <Typography variant="h5" gutterBottom>Notification Preferences</Typography>
        <Box>
          {Object.entries(notificationPrefs).map(([key, value]) => (
            <Box 
              key={key} 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 2 
              }}
            >
              <Typography>
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </Typography>
              <Switch
                checked={value}
                onChange={e => setNotificationPrefs(prev => ({ 
                  ...prev, 
                  [key]: e.target.checked 
                }))}
                disabled={loading}
              />
            </Box>
          ))}
        </Box>
      </Card>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2FADialog} onClose={() => setShow2FADialog(false)}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Setup Two-Factor Authentication</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <QRCode value={qrCodeData} size={200} />
          </Box>
          <Typography variant="body2" gutterBottom>
            Scan this QR code with your authenticator app and enter the verification code below.
          </Typography>
          <Input
            id="totpCode"
            name="totpCode"
            label="Verification Code"
            value={totpCode}
            onChange={e => setTotpCode(e.target.value)}
            maxLength={6}
          />
          <Button
            variant="contained"
            onClick={handleVerify2FA}
            disabled={loading || totpCode.length !== 6}
            fullWidth
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Verify'}
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
};

export default Settings;