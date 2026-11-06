import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { EdgeApiError } from '../../api/edgeApi';

export interface SignInState {
  readonly username: string;
  readonly password: string;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly alreadyIn: boolean;
  readonly alreadyInUsername: string;
  readonly setUsername: (v: string) => void;
  readonly setPassword: (v: string) => void;
}

export interface SignInController {
  readonly state: SignInState;
  readonly onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

/**
 * Pure state + submit logic for the signin screen. Layout
 * wrappers consume this so the multiple visual templates
 * (standard / sidebar / hero / marketing) share one source of
 * truth for authentication state.
 */
export function useSignInController(): SignInController {
  const { signIn, state: authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyIn = authState.status === 'AUTHENTICATED';
  const alreadyInUsername = authState.status === 'AUTHENTICATED'
    ? authState.user.username : '';

  const doSubmit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
      const to = (location.state as { from?: { pathname: string } } | null)
                 ?.from?.pathname ?? '/';
      navigate(to, { replace: true });
    } catch (err) {
      if (err instanceof EdgeApiError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setError('Username or password is incorrect.');
        } else if (err.code === 'RATE_LIMITED') {
          setError('Too many sign-in attempts. Try again in a minute.');
        } else {
          setError('Edge runtime is unreachable. Check the server status.');
        }
      } else {
        setError('Unexpected error during sign-in.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return {
    state: {
      username, password, submitting, error, alreadyIn,
      alreadyInUsername, setUsername, setPassword,
    },
    onSubmit: (e: FormEvent<HTMLFormElement>): void => {
      e.preventDefault();
      void doSubmit();
    },
  };
}
