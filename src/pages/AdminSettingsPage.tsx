import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, Palette, Globe, Mail, Bell } from 'lucide-react'; // ADDED Bell icon
import Card, { CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAppSettings, AppSettings } from '../hooks/useAppSettings';
import { getAllJurisdictions } from '../utils/jurisdictionUtils';
import { Jurisdiction } from '../types';
import Modal from '../components/ui/Modal'; // ADDED Modal import
import adminService from '../services/adminService'; // ADDED adminService import

const AdminSettingsPage: React.FC = () => {
  const { settings, loading, error, updateSettings } = useAppSettings();
  const [formData, setFormData] = useState<Partial<AppSettings>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // State for System Notification Modal
  const [showSystemNotificationModal, setShowSystemNotificationModal] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationSendError, setNotificationSendError] = useState<string | null>(null);
  const [notificationSendSuccess, setNotificationSendSuccess] = useState<string | null>(null);


  useEffect(() => {
    if (settings) {
      setFormData({
        default_theme: settings.default_theme,
        default_jurisdictions: settings.default_jurisdictions,
        global_email_reports_enabled: settings.global_email_reports_enabled,
      });
    }
  }, [settings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleJurisdictionToggle = (jurisdiction: Jurisdiction) => {
    setFormData(prev => {
      const currentJurisdictions = (prev.default_jurisdictions || []) as Jurisdiction[];
      const updatedJurisdictions = currentJurisdictions.includes(jurisdiction)
        ? currentJurisdictions.filter(j => j !== jurisdiction)
        : [...currentJurisdictions, jurisdiction];
      return {
        ...prev,
        default_jurisdictions: updatedJurisdictions,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    const success = await updateSettings(formData);
    if (success) {
      setSaveMessage('Settings updated successfully!');
    } else {
      setSaveError('Failed to update settings. Please try again.');
    }
    setIsSaving(false);
  };

  const handleSendSystemNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingNotification(true);
    setNotificationSendError(null);
    setNotificationSendSuccess(null);

    try {
      await adminService.sendSystemNotification(notificationTitle, notificationMessage);
      setNotificationSendSuccess('System notification sent successfully!');
      setNotificationTitle('');
      setNotificationMessage('');
      setShowSystemNotificationModal(false);
    } catch (err: any) {
      console.error('Error sending system notification:', err);
      setNotificationSendError(err.message || 'Failed to send system notification.');
    } finally {
      setSendingNotification(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900 mx-auto"></div>
        <p className="text-gray-500 mt-2">Loading application settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Application Settings</h1>
      <p className="text-gray-700 mb-8">Configure global parameters for the entire application.</p>

      <Card>
        <CardBody>
          {saveMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
              {saveMessage}
            </div>
          )}
          {saveError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              {saveError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Default Theme */}
            <div>
              <label htmlFor="default_theme" className="block text-sm font-medium text-gray-700 mb-2">
                <Palette className="h-4 w-4 inline-block mr-1 text-blue-900" /> Default Theme for New Users
              </label>
              <select
                id="default_theme"
                name="default_theme"
                value={formData.default_theme || 'system'}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={isSaving}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">This theme will be applied to new user accounts by default.</p>
            </div>

            {/* Default Jurisdictions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="h-4 w-4 inline-block mr-1 text-blue-900" /> Default Jurisdictions for New Contracts
              </label>
              <div className="flex flex-wrap gap-2">
                {getAllJurisdictions().map((jurisdiction) => (
                  <button
                    key={jurisdiction}
                    type="button"
                    onClick={() => handleJurisdictionToggle(jurisdiction)}
                    className={`py-2 px-3 rounded-full text-sm font-medium transition-colors
                      ${(formData.default_jurisdictions || []).includes(jurisdiction)
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'
                      }`}
                    disabled={isSaving}
                  >
                    {jurisdiction}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">These jurisdictions will be pre-selected by default when any user uploads a new contract.</p>
            </div>

            {/* Global Email Reports Enabled */}
            <div>
              <label htmlFor="global_email_reports_enabled" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Mail className="h-4 w-4 inline-block mr-1 text-blue-900" /> Global Email Reports Enabled
              </label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="global_email_reports_enabled"
                  name="global_email_reports_enabled"
                  checked={formData.global_email_reports_enabled || false}
                  onChange={handleInputChange}
                  className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={isSaving}
                />
                <span className="ml-2 text-sm text-gray-700">Enable all email reports across the application.</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">If disabled, no email reports will be sent, regardless of individual user settings.</p>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                variant="primary"
                disabled={isSaving}
                icon={<Settings className="w-4 h-4" />}
              >
                {isSaving ? 'Saving Settings...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Send System Notification */}
      <Card>
        <CardBody>
          <h2 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <Bell className="h-5 w-5 mr-2 text-blue-900" /> Send System Notification
          </h2>
          <p className="text-gray-700 mb-4">
            Send an in-app notification to all users. Use this for important announcements, new features, or maintenance alerts.
          </p>
          {notificationSendSuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
              {notificationSendSuccess}
            </div>
          )}
          {notificationSendError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              {notificationSendError}
            </div>
          )}
          <Button
            variant="primary"
            onClick={() => setShowSystemNotificationModal(true)}
            icon={<Bell className="w-4 h-4" />}
          >
            Send New Notification
          </Button>
        </CardBody>
      </Card>

      {/* System Notification Modal */}
      <Modal
        isOpen={showSystemNotificationModal}
        onClose={() => setShowSystemNotificationModal(false)}
        title="Send System Notification to All Users"
      >
        <form onSubmit={handleSendSystemNotification} className="space-y-4">
          <div>
            <label htmlFor="notificationTitle" className="block text-sm font-medium text-gray-700 mb-1">
              Notification Title
            </label>
            <input
              type="text"
              id="notificationTitle"
              name="notificationTitle"
              value={notificationTitle}
              onChange={(e) => setNotificationTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
              disabled={sendingNotification}
            />
          </div>
          <div>
            <label htmlFor="notificationMessage" className="block text-sm font-medium text-gray-700 mb-1">
              Notification Message
            </label>
            <textarea
              id="notificationMessage"
              name="notificationMessage"
              rows={4}
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
              disabled={sendingNotification}
            ></textarea>
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSystemNotificationModal(false)}
              disabled={sendingNotification}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={sendingNotification || !notificationTitle || !notificationMessage}
            >
              {sendingNotification ? 'Sending...' : 'Send Notification'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminSettingsPage;