import { useQuery, useQueryClient } from "@tanstack/react-query";

async function fetchUser() {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });
  if (!response.ok) {
    if (response.status === 401) {
      return null;
    }
    throw new Error("Failed to fetch user");
  }
  return response.json();
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  
  const logout = () => {
    queryClient.clear();
    window.location.href = "/api/logout";
  };

  return logout;
}

export function useLogin() {
  const login = () => {
    window.location.href = "/api/login";
  };

  return login;
}
