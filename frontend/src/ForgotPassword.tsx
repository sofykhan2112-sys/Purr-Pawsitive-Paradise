import {
    useState,
  } from 'react'
  
  import type {
    FormEvent,
  } from 'react'
  
  import {
    Link,
  } from 'react-router'
  
  import './Signup.css'
  
  type ResetResponse = {
    message?: string
    developmentResetUrl?: string
  }
  
  function ForgotPassword() {
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
    ] = useState('')
  
    const [
      developmentUrl,
      setDevelopmentUrl,
    ] = useState('')
  
    async function handleSubmit(
      event: FormEvent<HTMLFormElement>,
    ) {
      event.preventDefault()
  
      if (loading) {
        return
      }
  
      setError('')
      setSuccess('')
      setDevelopmentUrl('')
  
      const form =
        event.currentTarget
  
      const fields =
        new FormData(form)
  
      const email =
        String(
          fields.get('email') ?? '',
        ).trim()
  
      if (
        !email ||
        email.length > 254
      ) {
        setError(
          'Enter a valid email address.',
        )
  
        return
      }
  
      setLoading(true)
  
      try {
        const response =
          await fetch(
            '/api/auth/forgot-password',
            {
              method: 'POST',
  
              headers: {
                'Content-Type':
                  'application/json',
              },
  
              body:
                JSON.stringify({
                  email,
                }),
            },
          )
  
        const data =
          (await response
            .json()
            .catch(
              () => null,
            )) as ResetResponse | null
  
        if (!response.ok) {
          setError(
            typeof data?.message ===
              'string'
              ? data.message
              : 'Unable to start password reset.',
          )
  
          return
        }
  
        setSuccess(
          typeof data?.message ===
            'string'
            ? data.message
            : 'Reset request created.',
        )
  
        if (
          typeof data?.developmentResetUrl ===
          'string'
        ) {
          setDevelopmentUrl(
            data.developmentResetUrl,
          )
        }
  
        form.reset()
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
          aria-label="Reset access"
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
              Find your way
              <br />
              <em>
                back home.
              </em>
            </h1>
  
            <p>
              Request a secure
              password-reset link
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
          aria-labelledby="forgot-password-title"
        >
          <Link
            className="text-link signup-back"
            to="/login"
          >
            Back to sign in
          </Link>
  
          <div className="signup-form-content">
            <p className="eyebrow">
              RESET ACCESS
            </p>
  
            <h2 id="forgot-password-title">
              Forgot your password?
            </h2>
  
            <p className="signup-intro">
              Enter the email
              connected to your
              account.
            </p>
  
            <form
              onSubmit={
                handleSubmit
              }
              aria-busy={
                loading
              }
            >
              <div className="signup-field">
                <label htmlFor="reset-email">
                  Email address
                </label>
  
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  maxLength={254}
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
  
              {success && (
                <p role="status">
                  {success}
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
                  ? 'Creating reset link…'
                  : 'Reset password'}
              </button>
            </form>
  
            {developmentUrl && (
              <section
                style={{
                  marginTop:
                    '1.5rem',
                }}
              >
                <p className="eyebrow">
                  DEVELOPMENT MODE
                </p>
  
                <p>
                  Email delivery
                  is not configured
                  yet. Use this
                  local reset link:
                </p>
  
                <a
                  className="text-link"
                  href={
                    developmentUrl
                  }
                >
                  Continue to reset password
                </a>
              </section>
            )}
          </div>
        </section>
      </main>
    )
  }
  
  export default ForgotPassword