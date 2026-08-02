const API_BASE_URL = 'http://localhost:4000/api';

// Helper for making fetch requests with headers & credentials
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Ensures cookies are passed for gateway auth
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// 1. Auth API
export const authApi = {
  sendOtp: (payload: { firstName: string; lastName: string; email: string; password: string; confirmPassword: string }) =>
    request<{ success: boolean; message: string }>('/users/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyOtp: (otp: string) =>
    request<{ success: boolean; message: string; data: string }>('/users/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ success: boolean; message: string; loggedInUser: any; accessToken?: string }>('/users/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getProfile: () =>
    request<{ success: boolean; user: any; data?: any }>('/users/user/get-profile'),

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  },
};

// 2. Search API
export const searchApi = {
  autocomplete: (query: string) =>
    request<{ success: boolean; data: Array<{ id: string; name: string; code: string; city: string; state: string }> }>(
      `/search/search/autocomplete?q=${encodeURIComponent(query)}`
    ),

  searchTrains: (from: string, to: string, date?: string) =>
    request<{ success: boolean; data: any[] }>(
      `/search/search/trains?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${date ? `&date=${encodeURIComponent(date)}` : ''}`
    ),
};

// 3. Inventory API
export const inventoryApi = {
  getAvailability: (scheduleId: string) =>
    request<{ success: boolean; data: any }>(`/inventory/schedules/${scheduleId}/availability`),

  getSeats: (scheduleId: string, seatIds: string[], fromSeq: number, toSeq: number) => {
    const seatQuery = seatIds.length > 0 ? `&seatIds=${seatIds.join(',')}` : '';
    return request<{ success: boolean; data: any[] }>(
      `/inventory/schedules/${scheduleId}/seats?fromSeq=${fromSeq}&toSeq=${toSeq}${seatQuery}`
    );
  },

  lockSeats: (payload: { scheduleId: string; seatIds: string[]; fromSeq: number; toSeq: number }) =>
    request<{ success: boolean; message: string }>('/inventory/seats/lock', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  unlockSeats: (payload: { scheduleId: string; seatIds: string[]; fromSeq: number; toSeq: number }) =>
    request<{ success: boolean; message: string }>('/inventory/seats/unlock', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// 4. Booking API
export const bookingApi = {
  createBooking: (payload: {
    scheduleId: string;
    seatIds: string[];
    passengers: Array<{ name: string; age: number; gender: string }>;
    idempotencyKey: string;
    fromStationId: string;
    toStationId: string;
    fromSeq: number;
    toSeq: number;
    trainId: string;
  }) =>
    request<{ success: boolean; message: string; data: any }>('/bookings/booking', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getUserBookings: () =>
    request<{ success: boolean; data: any[] }>('/bookings/booking/my-bookings'),

  getBookingById: (id: string) =>
    request<{ success: boolean; data: any }>(`/bookings/booking/${id}`),

  cancelBooking: (id: string, reason?: string) =>
    request<{ success: boolean; message: string; data: any }>(`/bookings/booking/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Cancelled by passenger' }),
    }),
};

// 5. Payment API
export const paymentApi = {
  createOrder: (payload: { bookingId: string; amount: number; currency?: string }) =>
    request<{ success: boolean; data: any }>('/payments/payment/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyPayment: (payload: { bookingId: string; paymentId?: string }) =>
    request<{ success: boolean; message: string; data: any }>('/payments/payment/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOrderStatus: (bookingId: string) =>
    request<{ success: boolean; data: any }>(`/payments/payment/orders/${bookingId}`),
};

// 6. Admin API
export const adminApi = {
  getStations: () =>
    request<{ success: boolean; data: any[] }>('/admins/station/all'),

  createStation: (payload: { name: string; code: string; city: string; state: string }) =>
    request<{ success: boolean; message: string; data: any }>('/admins/station/station', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getTrains: () =>
    request<{ success: boolean; data: any[] }>('/admins/train/all'),

  getTrainById: (id: string) =>
    request<{ success: boolean; data: any }>(`/admins/train/train/${id}`),

  createTrain: (payload: {
    trainNumber: string;
    name: string;
    coaches: Array<{
      coachNumber: string;
      coachType: string;
      seats: Array<{ seatNumber: number; seatLabel: string; seatType: string }>;
    }>;
    fares?: Array<{ fromStationId: string; toStationId: string; coachType: string; fare: number }>;
  }) =>
    request<{ success: boolean; message: string; data: any }>('/admins/train/train', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createRoute: (payload: {
    trainId: string;
    stops: Array<{
      stationId: string;
      sequence: number;
      arrivalMinute?: number;
      departureMinute?: number;
      arrivalDay?: number;
      departureDay?: number;
      haltMinutes?: number;
    }>;
  }) =>
    request<{ success: boolean; message: string; data: any }>('/admins/train/route', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createSchedule: (payload: { trainId: string; departureDate: string; status?: string }) =>
    request<{ success: boolean; message: string; data: any }>('/admins/train/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createFares: (payload: {
    trainId: string;
    fares: Array<{ fromStationId: string; toStationId: string; coachType: string; fare: number }>;
  }) =>
    request<{ success: boolean; message: string; data: any }>('/admins/train/fare', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
