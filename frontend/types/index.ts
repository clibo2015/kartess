export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
}

export interface Profile {
  id: string;
  bio?: string;
  company?: string;
  position?: string;
  phone?: string;
  education?: string;
  avatar_url?: string;
  handles?: {
    connect?: string;
    visuals?: string;
    threads?: string;
    careernet?: string;
  };
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: User;
  profileComplete?: boolean;
  qrContact?: {
    id: string;
    user?: User;
    [key: string]: any;
  };
}
