import {
  useState,
} from 'react'

import type {
  FormEvent,
} from 'react'

import {
  Link,
  useNavigate,
} from 'react-router'

import './Signup.css'

type LoginResponse = {
  message?: string
  mfaRequired?: boolean
  recoveryCodeSupported?: boolean
  recoveryCodeUsed?: boolean

  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}

function Login() {
  const navigate =
    useNavigate()

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    mfaRequired,
    setMfaRequired,
  ] = useState(false)

  async function handleLogin(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (loading) {
      return
    }

    setError('')

    const form =
      event.currentTarget

    const fields =
      new FormData(form)

    const email =
      String(
        fields.get(
          'email',
        ) ?? '',
      ).trim()

    const password =
      String(
        fields.get(
          'password',
        ) ?? '',
      )

    if (
      !email ||
      email.length > 254
    ) {
      setError(
        'Enter a valid email address.',
      )

      return
    }

    if (
      !password ||
      password.length > 128
    ) {
      setError(
        'Enter your password.',
      )

      return
    }

    setLoading(true)

    try {
      const response =
        await fetch(
          '/api/auth/login',
          {
            method: 'POST',

            credentials:
              'same-origin',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                email,
                password,
              }),
          },
        )

      const data =
        (await response
          .json()
          .catch(
            () => null,
          )) as
          | LoginResponse
          | null

      if (!response.ok) {
        setError(
          typeof data?.message ===
            'string'
            ? data.message
            : 'Unable to sign in. Please try again.',
        )

        return
      }

      if (
        data?.mfaRequired ===
        true
      ) {
        setMfaRequired(true)
        return
      }

      navigate(
        '/account',
        {
          replace: true,
        },
      )
    } catch {
      setError(
        'Could not reach the server. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleMfa(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (loading) {
      return
    }

    setError('')

    const form =
      event.currentTarget

    const fields =
      new FormData(form)

    const code =
      String(
        fields.get(
          'code',
        ) ?? '',
      ).trim()

    const normalizedRecoveryCode =
      code
        .toUpperCase()
        .replace(
          /[\s-]+/g,
          '',
        )

    const isAuthenticatorCode =
      /^\d{6}$/.test(
        code,
      )

    const isRecoveryCode =
      /^[A-F0-9]{20}$/.test(
        normalizedRecoveryCode,
      )

    if (
      !isAuthenticatorCode &&
      !isRecoveryCode
    ) {
      setError(
        'Enter a valid 6-digit authenticator code or recovery code.',
      )

      return
    }

    setLoading(true)

    try {
      const response =
        await fetch(
          '/api/auth/mfa/verify-login',
          {
            method: 'POST',

            credentials:
              'same-origin',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                code,
              }),
          },
        )

      const data =
        (await response
          .json()
          .catch(
            () => null,
          )) as
          | LoginResponse
          | null

      if (!response.ok) {
        setError(
          typeof data?.message ===
            'string'
            ? data.message
            : 'Unable to verify the security code.',
        )

        return
      }

      navigate(
        '/account',
        {
          replace: true,
        },
      )
    } catch {
      setError(
        'Could not reach the server. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  function restartLogin() {
    setMfaRequired(false)
    setError('')
  }

  return (
    <main className="signup-page">
      <section
        className="signup-story"
        aria-label="Welcome back"
      >
        <Link
          className="brand"
          to="/"
        >
          <span
            className="brand-mark"
            aria-hidden="true"
          >
            pp.
          </span>

          <span>
            Purr-Pawsitive
            <small>
              PARADISE
            </small>
          </span>
        </Link>

        <div className="signup-story-copy">
          <p className="eyebrow">
            YOUR LITTLE CORNER OF PARADISE
          </p>

          <h1>
            Familiar faces.
            <br />

            <em>
              A warm welcome.
            </em>
          </h1>

          <p>
            Come on in. Your next
            chapter with your
            companion starts
            right here.
          </p>
        </div>

        <img
          className="signup-photo"
          src="/images/pet-hero.png"
          alt="A golden retriever sitting beside a cream-coloured cat"
          width="1122"
          height="1402"
        />
      </section>

      <section
        className="signup-form-panel"
        aria-labelledby="login-title"
      >
        <Link
          className="text-link signup-back"
          to="/"
        >
          Back to home
        </Link>

        <div className="signup-form-content">
          {mfaRequired ? (
            <>
              <p className="eyebrow">
                ADMIN SECURITY
              </p>

              <h2 id="login-title">
                Verify your sign in.
              </h2>

              <p className="signup-intro">
                Enter the 6-digit
                code from your
                authenticator app,
                or use one of your
                saved recovery
                codes.
              </p>

              <form
                onSubmit={
                  handleMfa
                }
                aria-busy={
                  loading
                }
              >
                <div className="signup-field">
                  <label htmlFor="login-mfa-code">
                    Authenticator or recovery code
                  </label>

                  <input
                    id="login-mfa-code"
                    name="code"
                    type="text"
                    inputMode="text"
                    autoComplete="one-time-code"
                    maxLength={64}
                    placeholder="123456 or AB12-CD34-EF56-7890-ABCD"
                    required
                    autoFocus
                    disabled={
                      loading
                    }
                    spellCheck={false}
                    autoCapitalize="characters"
                  />

                  <small>
                    Recovery codes are single-use.
                    After one is used successfully,
                    it cannot be used again.
                  </small>
                </div>

                {error && (
                  <p
                    className="signup-error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <button
                  className="button dark-button signup-submit"
                  type="submit"
                  disabled={
                    loading
                  }
                >
                  {loading
                    ? 'Verifying…'
                    : 'Verify and sign in'}
                </button>
              </form>

              <p className="signup-note">
                <button
                  className="text-link"
                  type="button"
                  onClick={
                    restartLogin
                  }
                  disabled={
                    loading
                  }
                  style={{
                    border: 0,
                    background:
                      'transparent',
                    padding: 0,
                    font: 'inherit',
                    cursor:
                      'pointer',
                  }}
                >
                  Use another account
                </button>
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">
                GOOD TO SEE YOU AGAIN
              </p>

              <h2 id="login-title">
                Welcome back.
              </h2>

              <p className="signup-intro">
                Sign in to your
                Purr-Pawsitive
                account.
              </p>

              <form
                onSubmit={
                  handleLogin
                }
                aria-busy={
                  loading
                }
              >
                <div className="signup-field">
                  <label htmlFor="login-email">
                    Email address
                  </label>

                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@example.com"
                    maxLength={254}
                    required
                    disabled={
                      loading
                    }
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="login-password">
                    Password
                  </label>

                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    maxLength={128}
                    required
                    disabled={
                      loading
                    }
                  />
                </div>

                <p
                  style={{
                    marginTop:
                      '-0.25rem',
                    marginBottom:
                      '1rem',
                  }}
                >
                  <Link
                    className="text-link"
                    to="/forgot-password"
                  >
                    Forgot password?
                  </Link>
                </p>

                {error && (
                  <p
                    className="signup-error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <button
                  className="button dark-button signup-submit"
                  type="submit"
                  disabled={
                    loading
                  }
                >
                  {loading
                    ? 'Signing you in…'
                    : 'Sign in'}
                </button>
              </form>

              <p className="signup-note">
                New here?{' '}

                <Link to="/signup">
                  Create an account
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default Login