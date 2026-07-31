'use client';

import {
  Bell,
  AlertCircle,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  Info,
  Zap,
  Calendar,
  User,
} from 'lucide-react';
import { ReactNode } from 'react';

interface NotificationDriverProps {
  type: string;
  priority?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const NotificationDriver = ({
  type,
  priority = 'medium',
  size = 'md',
  showLabel = false,
  className = '',
}: NotificationDriverProps) => {
  const getTypeConfig = () => {
    switch (type?.toLowerCase()) {
      case 'emergency':
        return {
          icon: Zap,
          bgColor: 'bg-red-500',
          iconColor: 'text-white',
          borderColor: 'border-red-500',
          label: 'Emergency',
          pulse: true,
        };
      case 'alert':
        return {
          icon: AlertCircle,
          bgColor: 'bg-orange-500',
          iconColor: 'text-white',
          borderColor: 'border-orange-500',
          label: 'Alert',
          pulse: false,
        };
      case 'reminder':
        return {
          icon: Clock,
          bgColor: 'bg-yellow-500',
          iconColor: 'text-white',
          borderColor: 'border-yellow-500',
          label: 'Reminder',
          pulse: false,
        };
      case 'announcement':
      default:
        return {
          icon: Bell,
          bgColor: 'bg-blue-500',
          iconColor: 'text-white',
          borderColor: 'border-blue-500',
          label: 'Announcement',
          pulse: false,
        };
    }
  };

  const getPriorityConfig = () => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return {
          badgeColor: 'bg-red-100 text-red-800 border-red-300',
          glow: 'shadow-red-500/50',
        };
      case 'high':
        return {
          badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
          glow: 'shadow-orange-500/50',
        };
      case 'medium':
        return {
          badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          glow: 'shadow-yellow-500/50',
        };
      case 'low':
        return {
          badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
          glow: 'shadow-blue-500/50',
        };
      default:
        return {
          badgeColor: 'bg-gray-100 text-gray-800 border-gray-300',
          glow: 'shadow-gray-500/50',
        };
    }
  };

  const typeConfig = getTypeConfig();
  const priorityConfig = getPriorityConfig();
  const IconComponent = typeConfig.icon;

  const sizeClasses = {
    sm: {
      icon: 'w-4 h-4',
      container: 'w-8 h-8',
      badge: 'text-xs px-1.5 py-0.5',
    },
    md: {
      icon: 'w-5 h-5',
      container: 'w-12 h-12',
      badge: 'text-xs px-2 py-1',
    },
    lg: {
      icon: 'w-6 h-6',
      container: 'w-16 h-16',
      badge: 'text-sm px-3 py-1.5',
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <div
        className={`
          ${currentSize.container}
          ${typeConfig.bgColor}
          rounded-xl
          flex items-center justify-center
          ${priorityConfig.glow}
          shadow-lg
          ${typeConfig.pulse ? 'animate-pulse' : ''}
          transition-all duration-300
          hover:scale-110
          hover:shadow-xl
        `}
      >
        <IconComponent className={`${currentSize.icon} ${typeConfig.iconColor}`} />
      </div>
      {showLabel && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-gray-900">{typeConfig.label}</span>
          <span className={`${currentSize.badge} rounded-full border font-medium ${priorityConfig.badgeColor}`}>
            {priority}
          </span>
        </div>
      )}
    </div>
  );
};

export default NotificationDriver;

