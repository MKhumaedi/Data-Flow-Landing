export type NotificationScope = 'USER' | 'BROADCAST';

export type NotificationType =
  | 'TRANSACTION_SUCCESS'
  | 'TRANSACTION_FAILED'
  | 'PREMIUM_EXPIRING_SOON'
  | 'PREMIUM_EXPIRED'
  | 'CONTENT_UPDATE'
  | 'FEATURE_UPDATE'
  | 'GENERAL';

export interface NotificationRecord {
  id: string;
  scope: NotificationScope;
  userId?: string | null;
  user_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  createdAt: string;
  created_at?: string;
  deletedAt?: string | null;
  deleted_at?: string | null;
  isRead?: boolean;
  is_read?: boolean;
}

export interface CreateNotificationDto {
  scope?: NotificationScope;
  userId?: string | null;
  user_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
}

export interface BroadcastNotificationDto {
  title: string;
  message: string;
  type: 'CONTENT_UPDATE' | 'FEATURE_UPDATE' | 'GENERAL';
  link?: string | null;
}
