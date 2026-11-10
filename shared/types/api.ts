// ─── Generic API Responses ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  date_of_birth?: string;
}

// ─── Appointments ────────────────────────────────────────────────────────────

export interface BookAppointmentData {
  doctor_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  notes?: string;
}
