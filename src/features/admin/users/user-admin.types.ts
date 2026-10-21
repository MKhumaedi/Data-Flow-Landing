export interface UserFilterParams {
  search?: string;
  role?: string;
  verificationStatus?: string;
  statusFilter?: 'ALL' | 'ACTIVE' | 'SUSPENDED';
  showDeleted?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateAdminUserParams {
  name: string;
  email: string;
  password: string;
  role?: 'FREE' | 'PREMIUM' | 'SUPERADMIN';
  verificationStatus?: 'VERIFIED' | 'PENDING' | 'REJECTED';
}

export interface EditAdminUserParams {
  name?: string;
  email?: string;
}

export interface AdminActor {
  id: string;
  email: string;
}
