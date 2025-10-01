import React from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { User, Bell, Shield, Settings, CreditCard, Users } from 'lucide-react'; // ADDED Users icon
import ProfileSettings from '../components/settings/ProfileSettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import ApplicationPreferences from '../components/settings/ApplicationPreferences';
import BillingSettings from '../components/settings/BillingSettings';
import MembersSettings from '../components/settings/MembersSettings'; // ADDED MembersSettings
import { useTranslation } from 'react-i18next'; // ADDED

const SettingsPage: React.FC = () => {
  console.log('SettingsPage component rendered'); // Added console.log
  const location = useLocation();
  const { t } = useTranslation(); // ADDED

  const settingsNavigation = [
    {
      name: t('profile'), // MODIFIED
      href: '/settings/profile',
      icon: User,
      component: ProfileSettings
    },
    {
      name: t('notifications'), // MODIFIED
      href: '/settings/notifications',
      icon: Bell,
      component: NotificationSettings
    },
    {
      name: t('security'), // MODIFIED
      href: '/settings/security',
      icon: Shield,
      component: SecuritySettings
    },
    {
      name: t('preferences'), // MODIFIED
      href: '/settings/preferences',
      icon: Settings,
      component: ApplicationPreferences
    },
    {
      name: t('billing'), // MODIFIED
      href: '/settings/billing',
      icon: CreditCard,
      component: BillingSettings
    },
    { // ADDED Members navigation item
      name: t('members'), // MODIFIED
      href: '/settings/members',
      icon: Users,
      component: MembersSettings
    }
  ];

  const isActiveRoute = (href: string) => {
    return location.pathname === href;
  };

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('settings')}</h1> {/* MODIFIED */}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Settings Navigation Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              {settingsNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    // REMOVED: onClick={item.href === '/settings/preferences' ? () => window.location.reload() : undefined}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                      ${isActiveRoute(item.href)
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                  >
                    <Icon
                      className={`flex-shrink-0 -ml-1 mr-3 h-5 w-5
                        ${isActiveRoute(item.href)
                          ? 'text-blue-500'
                          : 'text-gray-400 group-hover:text-gray-500'
                        }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            <Routes>
              <Route index element={<Navigate to="/settings/profile" replace />} />
              <Route path="profile" element={<ProfileSettings />} />
              <Route path="notifications" element={<NotificationSettings />} />
              <Route path="security" element={<SecuritySettings />} />
              <Route path="preferences" element={<ApplicationPreferences />} />
              <Route path="billing" element={<BillingSettings />} />
              <Route path="members" element={<MembersSettings />} /> {/* ADDED Members route */}
            </Routes>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;