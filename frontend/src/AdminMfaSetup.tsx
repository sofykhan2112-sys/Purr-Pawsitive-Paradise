import {
    useEffect,
    useState,
  } from 'react'
  
  import type {
    FormEvent,
  } from 'react'
  
  import {
    Link,
    useNavigate,
  } from 'react-router'
  
  import './AdminVetEditor.css'
  
  type AccountResponse = {
    user?: {
      id: string
      name: string
      email: string
      role: string
      status: string
      mfaEnabled?: boolean
      mfaVerifiedAt?: string | null
    }
  
    message?: string
  }
  
  type SetupResponse = {
    message?: string
    manualSecret?: string
    otpauthUri?: string
  }
  
  function AdminMfaSetup() {
    const navigate =
      useNavigate()
  
    const [
      loading,
      setLoading,
    ] = useState(true)
  
    const [
      saving,
      setSaving,
    ] = useState(false)
  
    const [
      error,
      setError,
    ] = useState('')
  
    const [
      user,
      setUser,
    ] =
      useState<
        AccountResponse['user'] |
          null
      >(null)
  
    const [
      manualSecret,
      setManualSecret,
    ] = useState('')
  
    const [
      otpauthUri,
      setOtpauthUri,
    ] = useState('')
  
    const [
      success,
      setSuccess,
    ] = useState('')
  
    useEffect(() => {
      const controller =
        new AbortController()
  
      async function load() {
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
  
          const data =
            (await response
              .json()
              .catch(
                () => null,
              )) as
              | AccountResponse
              | null
  
          if (
            controller.signal
              .aborted
          ) {
            return
          }
  
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
              data?.message ??
                'Could not load your account.',
            )
          }
  
          if (
            !data?.user ||
            data.user.role !==
              'ADMIN'
          ) {
            throw new Error(
              'Administrator access is required.',
            )
          }
  
          setUser(
            data.user,
          )
        } catch (
          loadError
        ) {
          if (
            !controller.signal
              .aborted
          ) {
            setError(
              loadError instanceof
                Error
                ? loadError.message
                : 'Could not load MFA settings.',
            )
          }
        } finally {
          if (
            !controller.signal
              .aborted
          ) {
            setLoading(
              false,
            )
          }
        }
      }
  
      void load()
  
      return () =>
        controller.abort()
    }, [navigate])
  
    async function startSetup() {
      if (saving) {
        return
      }
  
      setSaving(true)
      setError('')
      setSuccess('')
  
      try {
        const response =
          await fetch(
            '/api/auth/mfa/setup',
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
  
        const data =
          (await response
            .json()
            .catch(
              () => null,
            )) as
            | SetupResponse
            | null
  
        if (!response.ok) {
          throw new Error(
            data?.message ??
              'Could not start MFA setup.',
          )
        }
  
        if (
          typeof data?.manualSecret !==
            'string' ||
          typeof data?.otpauthUri !==
            'string'
        ) {
          throw new Error(
            'The MFA setup response was incomplete.',
          )
        }
  
        setManualSecret(
          data.manualSecret,
        )
  
        setOtpauthUri(
          data.otpauthUri,
        )
      } catch (
        setupError
      ) {
        setError(
          setupError instanceof
            Error
            ? setupError.message
            : 'Could not start MFA setup.',
        )
      } finally {
        setSaving(false)
      }
    }
  
    async function enableMfa(
      event:
        FormEvent<HTMLFormElement>,
    ) {
      event.preventDefault()
  
      if (saving) {
        return
      }
  
      setError('')
      setSuccess('')
  
      const fields =
        new FormData(
          event.currentTarget,
        )
  
      const code =
        String(
          fields.get(
            'code',
          ) ?? '',
        ).trim()
  
      if (
        !/^\d{6}$/.test(
          code,
        )
      ) {
        setError(
          'Enter the 6-digit code from your authenticator app.',
        )
  
        return
      }
  
      setSaving(true)
  
      try {
        const response =
          await fetch(
            '/api/auth/mfa/enable',
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
          await response
            .json()
            .catch(
              () => null,
            )
  
        if (!response.ok) {
          throw new Error(
            typeof data?.message ===
              'string'
              ? data.message
              : 'Could not enable MFA.',
          )
        }
  
        setManualSecret('')
        setOtpauthUri('')
  
        setUser(
          (current) =>
            current
              ? {
                  ...current,
                  mfaEnabled:
                    true,
                  mfaVerifiedAt:
                    new Date()
                      .toISOString(),
                }
              : current,
        )
  
        setSuccess(
          'Multi-factor authentication is now enabled. Your next administrator login will require a 6-digit authenticator code.',
        )
      } catch (
        enableError
      ) {
        setError(
          enableError instanceof
            Error
            ? enableError.message
            : 'Could not enable MFA.',
        )
      } finally {
        setSaving(false)
      }
    }
  
    if (loading) {
      return (
        <main className="page-width vet-editor-main">
          <p role="status">
            Loading MFA
            settings…
          </p>
        </main>
      )
    }
  
    if (
      !user ||
      user.role !== 'ADMIN'
    ) {
      return (
        <main className="page-width vet-editor-main">
          <p className="eyebrow">
            ADMIN SECURITY
          </p>
  
          <h1>
            MFA settings
          </h1>
  
          <p
            className="vet-editor-error"
            role="alert"
          >
            {error ||
              'Administrator access is required.'}
          </p>
  
          <Link
            className="button dark-button"
            to="/account"
          >
            Back to account
          </Link>
        </main>
      )
    }
  
    return (
      <main className="page-width vet-editor-main">
        <Link
          className="text-link"
          to="/account"
        >
          Back to account
        </Link>
  
        <header className="vet-editor-heading">
          <p className="eyebrow">
            ADMIN SECURITY
          </p>
  
          <h1>
            Multi-factor
            authentication
          </h1>
  
          <p>
            Protect administrator
            access with a
            time-based
            authenticator code.
          </p>
        </header>
  
        <section className="vet-editor-summary">
          <p>
            <strong>
              Administrator
            </strong>
            <br />
            {user.name}
          </p>
  
          <p>
            <strong>
              Email
            </strong>
            <br />
            {user.email}
          </p>
  
          <p>
            <strong>
              MFA status
            </strong>
            <br />
  
            {user.mfaEnabled
              ? 'Enabled'
              : 'Not enabled'}
          </p>
  
          <p>
            <strong>
              Verified
            </strong>
            <br />
  
            {user.mfaVerifiedAt
              ? new Date(
                  user.mfaVerifiedAt,
                ).toLocaleString()
              : 'Not yet'}
          </p>
        </section>
  
        {error && (
          <p
            className="vet-editor-error"
            role="alert"
          >
            {error}
          </p>
        )}
  
        {success && (
          <p
            className="vet-editor-success"
            role="status"
          >
            {success}
          </p>
        )}
  
        {user.mfaEnabled ? (
          <section className="vet-editor-form">
            <h2>
              MFA is enabled
            </h2>
  
            <p>
              Administrator login
              now requires both
              the account password
              and the 6-digit code
              from the configured
              authenticator app.
            </p>
  
            <p>
              Keep access to your
              authenticator
              device. MFA disable
              and recovery should
              be handled as a
              separate controlled
              administrator
              recovery process.
            </p>
          </section>
        ) : !manualSecret ? (
          <section className="vet-editor-form">
            <h2>
              Set up an
              authenticator app
            </h2>
  
            <p>
              You can use Google
              Authenticator,
              Microsoft
              Authenticator,
              Authy, or another
              compatible TOTP
              application.
            </p>
  
            <button
              className="button dark-button"
              type="button"
              disabled={
                saving
              }
              onClick={() =>
                void startSetup()
              }
            >
              {saving
                ? 'Starting setup…'
                : 'Start MFA setup'}
            </button>
          </section>
        ) : (
          <section className="vet-editor-form">
            <h2>
              Add the account to
              your authenticator
            </h2>
  
            <p>
              In your
              authenticator app,
              choose to add a
              setup key manually.
            </p>
  
            <div className="vet-editor-field">
              <label htmlFor="mfa-secret">
                Setup key
              </label>
  
              <input
                id="mfa-secret"
                type="text"
                value={
                  manualSecret
                }
                readOnly
                autoComplete="off"
              />
  
              <small>
                Do not share this
                key. It provides
                access to future
                authenticator
                codes.
              </small>
            </div>
  
            <details>
              <summary>
                Advanced setup URI
              </summary>
  
              <p
                style={{
                  overflowWrap:
                    'anywhere',
                }}
              >
                {otpauthUri}
              </p>
            </details>
  
            <form
              onSubmit={
                enableMfa
              }
            >
              <div className="vet-editor-field">
                <label htmlFor="mfa-confirm-code">
                  Current
                  6-digit code
                </label>
  
                <input
                  id="mfa-confirm-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  placeholder="123456"
                  required
                  disabled={
                    saving
                  }
                />
              </div>
  
              <div className="vet-editor-actions">
                <button
                  className="button dark-button"
                  type="submit"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? 'Verifying…'
                    : 'Verify and enable MFA'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    )
  }
  
  export default AdminMfaSetup