import {
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useNavigate,
} from 'react-router'

import './Account.css'
import PetProfiles from './PetProfiles'
import NotificationLink from './NotificationLink'

type AccountUser = {
  id: string
  name: string
  email: string
  role: string
  status: string

  mfaEnabled?: boolean
  mfaVerifiedAt?: string | null
  recoveryCodesRemaining?: number
}

type RecoveryCodeResponse = {
  message?: string
  recoveryCodes?: string[]
}

function Account() {
  const navigate =
    useNavigate()

  const [
    user,
    setUser,
  ] =
    useState<AccountUser | null>(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    loadError,
    setLoadError,
  ] =
    useState('')

  const [
    logoutError,
    setLogoutError,
  ] =
    useState('')

  const [
    loggingOut,
    setLoggingOut,
  ] =
    useState(false)

  const [
    retry,
    setRetry,
  ] =
    useState(0)

  const [
    recoveryCode,
    setRecoveryCode,
  ] =
    useState('')

  const [
    generatingRecoveryCodes,
    setGeneratingRecoveryCodes,
  ] =
    useState(false)

  const [
    recoveryError,
    setRecoveryError,
  ] =
    useState('')

  const [
    recoveryMessage,
    setRecoveryMessage,
  ] =
    useState('')

  const [
    generatedRecoveryCodes,
    setGeneratedRecoveryCodes,
  ] =
    useState<string[]>([])

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadAccount() {
      setLoading(true)
      setLoadError('')

      try {
        const response =
          await fetch(
            '/api/auth/me',
            {
              credentials:
                'same-origin',

              cache:
                'no-store',

              signal:
                controller.signal,
            },
          )

        if (
          response.status ===
          401
        ) {
          navigate(
            '/login',
            {
              replace:
                true,
            },
          )

          return
        }

        if (!response.ok) {
          throw new Error(
            'Account request failed',
          )
        }

        const data =
          await response.json()

        if (
          !data.user?.id
        ) {
          throw new Error(
            'Invalid account response',
          )
        }

        if (
          !controller
            .signal
            .aborted
        ) {
          setUser(
            data.user,
          )
        }
      } catch {
        if (
          !controller
            .signal
            .aborted
        ) {
          setLoadError(
            'Could not load your account. Please try again.',
          )
        }
      } finally {
        if (
          !controller
            .signal
            .aborted
        ) {
          setLoading(
            false,
          )
        }
      }
    }

    void loadAccount()

    return () =>
      controller.abort()
  }, [
    navigate,
    retry,
  ])

  async function handleLogout() {
    if (loggingOut) {
      return
    }

    setLoggingOut(true)
    setLogoutError('')

    try {
      const response =
        await fetch(
          '/api/auth/logout',
          {
            method:
              'POST',

            credentials:
              'same-origin',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(
                {},
              ),
          },
        )

      if (!response.ok) {
        throw new Error(
          'Logout failed',
        )
      }

      setUser(null)

      navigate(
        '/login',
        {
          replace:
            true,
        },
      )
    } catch {
      setLogoutError(
        'Could not sign you out. Please try again.',
      )
    } finally {
      setLoggingOut(
        false,
      )
    }
  }

  async function handleGenerateRecoveryCodes() {
    if (
      generatingRecoveryCodes
    ) {
      return
    }

    setRecoveryError('')
    setRecoveryMessage('')
    setGeneratedRecoveryCodes(
      [],
    )

    const code =
      recoveryCode.trim()

    if (
      !/^\d{6}$/.test(
        code,
      )
    ) {
      setRecoveryError(
        'Enter the current 6-digit code from your authenticator app.',
      )

      return
    }

    setGeneratingRecoveryCodes(
      true,
    )

    try {
      const response =
        await fetch(
          '/api/auth/mfa/recovery-codes/regenerate',
          {
            method:
              'POST',

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
          | RecoveryCodeResponse
          | null

      if (!response.ok) {
        setRecoveryError(
          typeof data?.message ===
            'string'
            ? data.message
            : 'Could not generate recovery codes.',
        )

        return
      }

      if (
        !Array.isArray(
          data?.recoveryCodes,
        ) ||
        data.recoveryCodes
          .length === 0
      ) {
        setRecoveryError(
          'The server did not return recovery codes.',
        )

        return
      }

      setGeneratedRecoveryCodes(
        data.recoveryCodes,
      )

      setRecoveryMessage(
        typeof data.message ===
          'string'
          ? data.message
          : 'New recovery codes generated successfully.',
      )

      setRecoveryCode('')

      setUser(
        (
          current,
        ) =>
          current
            ? {
                ...current,

                recoveryCodesRemaining:
                  data
                    .recoveryCodes
                    ?.length ??
                  current
                    .recoveryCodesRemaining,
              }
            : current,
      )
    } catch {
      setRecoveryError(
        'Could not reach the server. Please try again.',
      )
    } finally {
      setGeneratingRecoveryCodes(
        false,
      )
    }
  }

  async function copyRecoveryCodes() {
    if (
      generatedRecoveryCodes
        .length === 0
    ) {
      return
    }

    try {
      await navigator
        .clipboard
        .writeText(
          generatedRecoveryCodes
            .join('\n'),
        )

      setRecoveryMessage(
        'Recovery codes copied. Store them somewhere secure.',
      )
    } catch {
      setRecoveryError(
        'Could not copy the codes automatically. Please copy them manually.',
      )
    }
  }

  if (loading) {
    return (
      <main
        className="page-width account-message"
        role="status"
      >
        Loading your account…
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="page-width account-message">
        <p role="alert">
          {loadError}
        </p>

        <button
          className="button dark-button account-button"
          onClick={() =>
            setRetry(
              (
                value,
              ) =>
                value +
                1,
            )
          }
        >
          Try again
        </button>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <>
      <header className="header">
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

        <nav aria-label="Account navigation">
          <Link to="/">
            Home
          </Link>

          <Link to="/pets/cats">
            Pet guides
          </Link>

          <Link to="/vets">
            Find a vet
          </Link>

          <Link to="/ambulances">
            Animal transport
          </Link>

          <Link to="/rapid-relief">
            Rapid Relief
          </Link>

          <Link to="/chat">
            Ask Purr-Pawsitive
          </Link>

          <Link to="/reports">
            My reports
          </Link>

          <NotificationLink />

          {user.role ===
            'OWNER' && (
            <>
              <Link to="/appointments">
                My appointments
              </Link>

              <Link to="/transport-requests">
                My transport requests
              </Link>
            </>
          )}

          {user.role ===
            'VET' && (
            <>
              <Link to="/provider/vet">
                Vet workspace
              </Link>

              <Link to="/provider/appointments">
                Appointment requests
              </Link>

              <Link to="/provider/availability">
                Working hours
              </Link>

              <Link to="/provider/availability/blocks">
                Blocked dates
              </Link>
            </>
          )}

          {user.role ===
            'AMBULANCE_PROVIDER' && (
            <>
              <Link to="/provider/ambulance">
                Ambulance workspace
              </Link>

              <Link to="/provider/ambulance/requests">
                Transport requests
              </Link>
            </>
          )}

          {user.role ===
            'ADMIN' && (
            <>
              <Link to="/admin/articles">
                Manage articles
              </Link>

              <Link to="/admin/vets">
                Manage vets
              </Link>

              <Link to="/admin/ambulances">
                Manage ambulances
              </Link>

              <Link to="/admin/reports">
                Review reports
              </Link>

              <Link to="/admin/users">
                Manage users
              </Link>

              <Link to="/admin/mfa">
                Admin security
              </Link>
            </>
          )}
        </nav>

        <button
          className="button dark-button account-button"
          onClick={
            handleLogout
          }
          disabled={
            loggingOut
          }
        >
          {loggingOut
            ? 'Signing out…'
            : 'Sign out'}
        </button>
      </header>

      <main className="page-width account-main">
        {logoutError && (
          <p
            className="account-error"
            role="alert"
          >
            {logoutError}
          </p>
        )}

        <section className="account-welcome">
          <p className="eyebrow">
            YOUR LITTLE CORNER OF PARADISE
          </p>

          <h1>
            Hello, {user.name}.
          </h1>

          <p>
            A space for you and
            the companions who
            make life special.
          </p>
        </section>

        <div className="account-grid">
          <section className="account-card">
            <p className="eyebrow">
              THE PERSON BEHIND THE PAWS
            </p>

            <h2>
              Your profile
            </h2>

            <dl className="account-details">
              <dt>
                Name
              </dt>

              <dd>
                {user.name}
              </dd>

              <dt>
                Email
              </dt>

              <dd>
                {user.email}
              </dd>

              <dt>
                Account role
              </dt>

              <dd>
                {user.role
                  .replaceAll(
                    '_',
                    ' ',
                  )
                  .toLowerCase()}
              </dd>
            </dl>
          </section>

          <section className="account-card account-pets-preview">
            <p className="eyebrow">
              A LITTLE KNOWLEDGE, A LOT OF CARE
            </p>

            <h2>
              Get to know their world.
            </h2>

            <p>
              Explore our growing
              guide collections
              for cats, dogs, and
              turtles.
            </p>

            <nav aria-label="Pet guide collections">
              <Link
                className="text-link"
                to="/pets/cats"
              >
                Cats
              </Link>

              {' · '}

              <Link
                className="text-link"
                to="/pets/dogs"
              >
                Dogs
              </Link>

              {' · '}

              <Link
                className="text-link"
                to="/pets/turtles"
              >
                Turtles
              </Link>
            </nav>
          </section>
        </div>

        {user.role ===
          'ADMIN' && (
          <section
            className="account-card"
            style={{
              marginTop:
                '2rem',
            }}
          >
            <p className="eyebrow">
              ADMIN ACCOUNT SECURITY
            </p>

            <h2>
              MFA recovery codes
            </h2>

            <p>
              Recovery codes let
              you sign in if you
              temporarily lose
              access to your
              authenticator app.
              Each recovery code
              can be used only
              once.
            </p>

            <dl className="account-details">
              <dt>
                MFA status
              </dt>

              <dd>
                {user.mfaEnabled
                  ? 'Enabled'
                  : 'Not enabled'}
              </dd>

              <dt>
                Recovery codes remaining
              </dt>

              <dd>
                {typeof user
                  .recoveryCodesRemaining ===
                'number'
                  ? user
                      .recoveryCodesRemaining
                  : 'Not available'}
              </dd>
            </dl>

            {!user.mfaEnabled ? (
              <p>
                Enable administrator
                MFA before generating
                recovery codes.
              </p>
            ) : (
              <>
                <div
                  className="signup-field"
                  style={{
                    marginTop:
                      '1.5rem',
                  }}
                >
                  <label htmlFor="recovery-authenticator-code">
                    Current authenticator code
                  </label>

                  <input
                    id="recovery-authenticator-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    placeholder="123456"
                    value={
                      recoveryCode
                    }
                    onChange={(
                      event,
                    ) =>
                      setRecoveryCode(
                        event
                          .target
                          .value
                          .replace(
                            /\D/g,
                            '',
                          )
                          .slice(
                            0,
                            6,
                          ),
                      )
                    }
                    disabled={
                      generatingRecoveryCodes
                    }
                  />
                </div>

                <p
                  style={{
                    marginTop:
                      '0.75rem',

                    maxWidth:
                      '650px',
                  }}
                >
                  Generating a new
                  set immediately
                  invalidates every
                  existing recovery
                  code.
                </p>

                {recoveryError && (
                  <p
                    className="account-error"
                    role="alert"
                  >
                    {recoveryError}
                  </p>
                )}

                {recoveryMessage && (
                  <p role="status">
                    {recoveryMessage}
                  </p>
                )}

                <button
                  className="button dark-button account-button"
                  type="button"
                  onClick={() =>
                    void handleGenerateRecoveryCodes()
                  }
                  disabled={
                    generatingRecoveryCodes ||
                    recoveryCode
                      .length !==
                      6
                  }
                >
                  {generatingRecoveryCodes
                    ? 'Generating…'
                    : 'Generate new recovery codes'}
                </button>

                {generatedRecoveryCodes
                  .length >
                  0 && (
                  <div
                    style={{
                      marginTop:
                        '1.75rem',

                      padding:
                        '1.25rem',

                      border:
                        '1px solid #d8ded6',

                      borderRadius:
                        '8px',

                      background:
                        '#f8f8f3',
                    }}
                  >
                    <h3>
                      Save these codes now
                    </h3>

                    <p>
                      These codes
                      are shown only
                      once. Do not
                      store them in
                      the project
                      source code.
                    </p>

                    <ul
                      style={{
                        paddingLeft:
                          '1.5rem',

                        fontFamily:
                          'monospace',

                        lineHeight:
                          '1.9',
                      }}
                    >
                      {generatedRecoveryCodes
                        .map(
                          (
                            code,
                          ) => (
                            <li
                              key={
                                code
                              }
                            >
                              {code}
                            </li>
                          ),
                        )}
                    </ul>

                    <button
                      className="button dark-button account-button"
                      type="button"
                      onClick={() =>
                        void copyRecoveryCodes()
                      }
                    >
                      Copy recovery codes
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {user.role ===
          'OWNER' && (
          <PetProfiles />
        )}
      </main>
    </>
  )
}

export default Account