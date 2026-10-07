import {
    useState,
  } from 'react'
  
  import type {
    FormEvent,
  } from 'react'
  
  import {
    Link,
    useSearchParams,
  } from 'react-router'
  
  import './Signup.css'
  
  function ResetPassword() {
    const [
      searchParams,
    ] = useSearchParams()
  
    const token =
      searchParams.get(
        'token',
      ) ?? ''
  
    const [
      loading,
      setLoading,
    ] = useState(false)
  
    const [
      error,
      setError,
    ] = useState('')
  
    const [
      success,
      setSuccess,
    ] = useState(false)
  
    const tokenLooksValid =
      /^[0-9a-f]{64}$/i.test(
        token,
      )
  
    async function handleSubmit(
      event: FormEvent<HTMLFormElement>,
    ) {
      event.preventDefault()
  
      if (
        loading ||
        success
      ) {
        return
      }
  
      setError('')
  
      if (!tokenLooksValid) {
        setError(
          'This reset link is invalid.',
        )
  
        return
      }
  
      const form =
        event.currentTarget
  
      const fields =
        new FormData(form)
  
      const password =
        String(
          fields.get(
            'password',
          ) ?? '',
        )
  
      const confirmPassword =
        String(
          fields.get(
            'confirmPassword',
          ) ?? '',
        )
  
      if (
        password.length < 15 ||
        password.length > 128
      ) {
        setError(
          'Password must contain between 15 and 128 characters.',
        )
  
        return
      }
  
      if (
        password !==
        confirmPassword
      ) {
        setError(
          'Your passwords do not match.',
        )
  
        return
      }
  
      setLoading(true)
  
      try {
        const response =
          await fetch(
            '/api/auth/reset-password',
            {
              method: 'POST',
  
              headers: {
                'Content-Type':
                  'application/json',
              },
  
              body:
                JSON.stringify({
                  token,
                  password,
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
          setError(
            typeof data?.message ===
              'string'
              ? data.message
              : 'Unable to reset the password.',
          )
  
          return
        }
  
        form.reset()
        setSuccess(true)
      } catch {
        setError(
          'Could not reach the server. Please try again.',
        )
      } finally {
        setLoading(false)
      }
    }
  
    return (
      <main className="signup-page">
        <section
          className="signup-story"
          aria-label="Choose a new password"
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
              ACCOUNT RECOVERY
            </p>
  
            <h1>
              A fresh key
              <br />
              <em>
                to your account.
              </em>
            </h1>
  
            <p>
              Choose a new,
              strong password
              for your account.
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
          aria-labelledby="reset-password-title"
        >
          <Link
            className="text-link signup-back"
            to="/login"
          >
            Back to sign in
          </Link>
  
          <div className="signup-form-content">
            <p className="eyebrow">
              NEW PASSWORD
            </p>
  
            <h2 id="reset-password-title">
              Reset your password.
            </h2>
  
            {!tokenLooksValid ? (
              <>
                <p
                  className="signup-error"
                  role="alert"
                >
                  This reset link
                  is invalid or
                  incomplete.
                </p>
  
                <Link
                  className="button dark-button"
                  to="/forgot-password"
                >
                  Request a new link
                </Link>
              </>
            ) : success ? (
              <>
                <p role="status">
                  Your password
                  was reset
                  successfully.
                </p>
  
                <p>
                  Existing login
                  sessions have
                  been revoked.
                  Sign in again
                  with your new
                  password.
                </p>
  
                <Link
                  className="button dark-button"
                  to="/login"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <form
                onSubmit={
                  handleSubmit
                }
                aria-busy={
                  loading
                }
              >
                <div className="signup-field">
                  <label htmlFor="new-password">
                    New password
                  </label>
  
                  <input
                    id="new-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={15}
                    maxLength={128}
                    required
                    disabled={
                      loading
                    }
                  />
  
                  <small>
                    Use 15–128
                    characters.
                  </small>
                </div>
  
                <div className="signup-field">
                  <label htmlFor="confirm-new-password">
                    Confirm new password
                  </label>
  
                  <input
                    id="confirm-new-password"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={15}
                    maxLength={128}
                    required
                    disabled={
                      loading
                    }
                  />
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
                    ? 'Resetting password…'
                    : 'Set new password'}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    )
  }
  
  export default ResetPassword