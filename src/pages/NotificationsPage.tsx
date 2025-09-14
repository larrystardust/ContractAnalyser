import React from 'react';
import { useNotifications } from '../hooks/useNotifications';
import Card, { CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Bell, CheckCircle, XCircle, Info, Trash2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ADDED

const NotificationsPage: React.FC = () => {
  const { notifications, loading, error, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { t } = useTranslation(); // ADDED

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'warning':
        return <XCircle className="h-6 w-6 text-amber-500" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-red-500" />;
      case 'info':
      default:
        return <Info className="h-6 w-6 text-blue-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900 mx-auto"></div>
        <p className="text-gray-500 mt-2">{t('loading_notifications')}...</p> {/* MODIFIED */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p className="text-red-600">{t('error_loading_notifications', { message: error.message })}</p> {/* MODIFIED */}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{t('your_notifications')}</h1> {/* MODIFIED */}
        <Button
          variant="secondary"
          onClick={markAllAsRead}
          disabled={unreadCount === 0}
          icon={<Mail className="h-4 w-4" />}
        >
          {t('mark_all_as_read')} {/* MODIFIED */}
        </Button>
      </div>
      
      {notifications.length === 0 ? (
        <Card>
          <CardBody className="text-center py-8">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t('no_new_notifications')}</p> {/* MODIFIED */}
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`border-l-4 ${notification.is_read ? 'border-gray-200' : 'border-blue-500'} transition-all duration-200`}
            >
              <CardBody className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className={`text-lg font-semibold ${notification.is_read ? 'text-gray-600' : 'text-gray-900'}`}>
                      {notification.title}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {formatDate(notification.created_at)}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${notification.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                    {notification.message}
                  </p>
                  <div className="mt-3 flex space-x-2">
                    {!notification.is_read && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => markAsRead(notification.id)}
                      >
                        {t('mark_as_read')} {/* MODIFIED */}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => deleteNotification(notification.id)}
                    >
                      {t('delete')} {/* MODIFIED */}
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;