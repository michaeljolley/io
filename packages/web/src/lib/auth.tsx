import { type Session, type SupabaseClient, createClient } from "@supabase/supabase-js";
import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { api, setTokenGetter, setTokenRefresher } from "./api";

interface AuthContextType {
	session: Session | null;
	supabase: SupabaseClient | null;
	loading: boolean;
	signIn: (email: string, password: string) => Promise<{ error: string | null }>;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
	session: null,
	supabase: null,
	loading: true,
	signIn: async () => ({ error: "Not initialized" }),
	signOut: async () => {},
});

export function useAuth() {
	return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);
	const sessionRef = useRef<Session | null>(null);

	// Register token getter so api.ts can attach Bearer token
	useEffect(() => {
		setTokenGetter(() => sessionRef.current?.access_token ?? null);
	}, []);

	// Store supabase client ref for the refresher
	const supabaseRef = useRef<SupabaseClient | null>(null);

	// Register token refresher so api.ts can refresh on 401
	useEffect(() => {
		setTokenRefresher(async () => {
			const client = supabaseRef.current;
			if (!client) return null;
			const { data, error } = await client.auth.refreshSession();
			if (error || !data.session) return null;
			sessionRef.current = data.session;
			setSession(data.session);
			return data.session.access_token;
		});
	}, []);

	// Fetch Supabase config from daemon and initialize client
	useEffect(() => {
		api
			.get<{ config: { supabase: { projectUrl: string | null; anonKey: string | null } } }>(
				"/config",
			)
			.then(({ config }) => {
				if (config.supabase.projectUrl && config.supabase.anonKey) {
					const client = createClient(config.supabase.projectUrl, config.supabase.anonKey);
					setSupabase(client);
					supabaseRef.current = client;

					// Get existing session
					client.auth.getSession().then(({ data }) => {
						sessionRef.current = data.session;
						setSession(data.session);
						setLoading(false);
					});

					// Listen for auth changes
					const {
						data: { subscription },
					} = client.auth.onAuthStateChange((_event, sess) => {
						sessionRef.current = sess;
						setSession(sess);
					});

					return () => subscription.unsubscribe();
				}
				// No Supabase configured — skip auth
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
			});
	}, []);

	async function signIn(email: string, password: string) {
		if (!supabase) return { error: "Supabase not configured" };
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		return { error: error?.message ?? null };
	}

	async function signOut() {
		if (!supabase) return;
		await supabase.auth.signOut();
		sessionRef.current = null;
		setSession(null);
	}

	return (
		<AuthContext.Provider value={{ session, supabase, loading, signIn, signOut }}>
			{children}
		</AuthContext.Provider>
	);
}
