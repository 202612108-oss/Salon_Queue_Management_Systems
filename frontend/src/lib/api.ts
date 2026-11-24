const RAW_BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_BASE = RAW_BACKEND_URL ? `${RAW_BACKEND_URL}/api` : '/api';

export async function fetchHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  return response.json();
}

export async function fetchSalonStatus() {
  const response = await fetch(`${API_BASE}/salon`);
  if (!response.ok) {
    throw new Error('Failed to load salon details');
  }
  return response.json();
}

export async function fetchServices() {
  const response = await fetch(`${API_BASE}/services`);
  if (!response.ok) {
    throw new Error('Failed to load salon services');
  }
  return response.json();
}

export async function fetchBarbers() {
  const response = await fetch(`${API_BASE}/barbers`);
  if (!response.ok) {
    throw new Error('Failed to load barbers');
  }
  return response.json();
}

export async function checkActivePhone(phone: string) {
  const response = await fetch(`${API_BASE}/queue/by-phone/${encodeURIComponent(phone)}`);
  if (!response.ok) {
    return { activeEntry: null };
  }
  return response.json();
}

export interface JoinQueuePayload {
  customerName: string;
  customerPhone: string;
  serviceIds: string[];
  preferredBarberId: string | null;
  source?: 'online' | 'walk-in';
}

export async function joinQueueApi(payload: JoinQueuePayload) {
  const response = await fetch(`${API_BASE}/queue/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to join queue');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function fetchQueueEntry(id: string) {
  const response = await fetch(`${API_BASE}/queue/${encodeURIComponent(id)}`);
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || 'Failed to load queue entry');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function cancelQueueEntry(id: string) {
  const response = await fetch(`${API_BASE}/queue/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || 'Failed to cancel queue spot');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

// -------------------------------------------------------------
// Reception API Endpoints
// -------------------------------------------------------------

export async function fetchReceptionDashboard() {
  const response = await fetch(`${API_BASE}/reception/dashboard`);
  if (!response.ok) {
    throw new Error('Failed to load reception dashboard');
  }
  return response.json();
}

export async function callNextCustomer(barberId?: string) {
  const response = await fetch(`${API_BASE}/reception/call-next`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ barberId }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to call next customer');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function markNoShow(id: string) {
  const response = await fetch(`${API_BASE}/reception/no-show/${encodeURIComponent(id)}`, {
    method: 'POST',
  });

  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || 'Failed to mark customer as no-show');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function cancelReceptionEntry(id: string) {
  const response = await fetch(`${API_BASE}/reception/cancel/${encodeURIComponent(id)}`, {
    method: 'POST',
  });

  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || 'Failed to cancel customer entry');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function addWalkInCustomer(payload: {
  customerName: string;
  customerPhone: string;
  serviceIds: string[];
  preferredBarberId: string | null;
}) {
  const response = await fetch(`${API_BASE}/reception/walk-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to add walk-in customer');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function seedDummyCustomers() {
  const response = await fetch(`${API_BASE}/reception/seed-dummy-data`, {
    method: 'POST',
  });
  return response.json();
}

// -------------------------------------------------------------
// Barber View API Endpoints
// -------------------------------------------------------------

export async function fetchBarberDetails(slug: string) {
  const response = await fetch(`${API_BASE}/barber/details/${encodeURIComponent(slug)}`);
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to fetch barber details');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function startBarberService(barberId: string) {
  const response = await fetch(`${API_BASE}/barber/${encodeURIComponent(barberId)}/start`, {
    method: 'POST',
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to start service');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function completeBarberService(barberId: string) {
  const response = await fetch(`${API_BASE}/barber/${encodeURIComponent(barberId)}/done`, {
    method: 'POST',
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to complete service');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function updateBarberStatus(barberId: string, status: 'Available' | 'On Break') {
  const response = await fetch(`${API_BASE}/barber/${encodeURIComponent(barberId)}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to update barber status');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

// -------------------------------------------------------------
// Waiting Area TV Display API Endpoints
// -------------------------------------------------------------

export async function fetchDisplayData() {
  const response = await fetch(`${API_BASE}/display`);
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || 'Failed to load display data');
    error.status = response.status;
    throw error;
  }
  return data;
}

// -------------------------------------------------------------
// Screen 7: Owner Settings (Admin) API Endpoints
// -------------------------------------------------------------

export async function fetchAdminDashboard() {
  const response = await fetch(`${API_BASE}/admin/dashboard`);
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || 'Failed to load admin dashboard');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function createAdminService(payload: {
  nameEn: string;
  nameGu?: string;
  nameHi?: string;
  durationMinutes: number;
  price: number;
  active?: boolean;
}) {
  const response = await fetch(`${API_BASE}/admin/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to create service');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function updateAdminService(
  id: string,
  payload: {
    nameEn: string;
    nameGu?: string;
    nameHi?: string;
    durationMinutes: number;
    price: number;
    active?: boolean;
  }
) {
  const response = await fetch(`${API_BASE}/admin/services/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to update service');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function deleteAdminService(id: string) {
  const response = await fetch(`${API_BASE}/admin/services/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to delete service');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function toggleAdminService(id: string) {
  const response = await fetch(`${API_BASE}/admin/services/${encodeURIComponent(id)}/toggle`, {
    method: 'PATCH',
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to toggle service');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function createAdminBarber(payload: {
  name: string;
  workingToday?: boolean;
  active?: boolean;
}) {
  const response = await fetch(`${API_BASE}/admin/barbers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to add barber');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function updateAdminBarber(
  id: string,
  payload: { name: string; active?: boolean }
) {
  const response = await fetch(`${API_BASE}/admin/barbers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to update barber');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function deleteAdminBarber(id: string) {
  const response = await fetch(`${API_BASE}/admin/barbers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to remove barber');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function setAdminBarberDuty(id: string, workingToday: boolean) {
  const response = await fetch(`${API_BASE}/admin/barbers/${encodeURIComponent(id)}/duty`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workingToday }),
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to update barber duty');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function updateAdminQueueStatus(payload: { isOpen: boolean; isPaused?: boolean }) {
  const response = await fetch(`${API_BASE}/admin/queue/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to update queue status');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function updateAdminQueueHours(payload: { openingTime: string; closingTime: string }) {
  const response = await fetch(`${API_BASE}/admin/queue/hours`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || data.error || 'Failed to update salon hours');
    error.status = response.status;
    throw error;
  }
  return data;
}
