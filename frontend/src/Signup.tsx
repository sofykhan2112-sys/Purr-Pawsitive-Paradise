import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import './Signup.css'

function Signup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loading) return

    setError('')

    const form = event.currentTarget
    const fields = new FormData(form)

    const name = String(fields.get('name') ?? '').trim()
    const email = String(fields.get('email') ?? '').trim()
    const password = String(fields.get('password') ?? '')
    const confirmPassword = String(fields.get('confirmPassword') ?? '')

    if (name.length < 2) {
      setError('Please enter a name with at least 2 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(
          typeof data?.message === 'string'
            ? data.message
            : 'Registration failed. Please try again.',
        )
        return
      }

      form.reset()
      setSuccess(true)
    } catch {
      setError(
        'We could not reach the server. Please check your connection and try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="signup-page">
      <section className="signup-story" aria-label="Welcome">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">pp.</span>
          <span>
            Purr-Pawsitive
            <small>PARADISE</small>
          </span>
        </Link>

        <div className="signup-story-copy">
          <p className="eyebrow">A PLACE FOR YOU AND YOUR COMPANION</p>
          <h1>
            Big love.
            <br />
            <em>Little beginnings.</em>
          </h1>
          <p>
            Your journey towards a more thoughtful life with
            your companion starts here.
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

      <section className="signup-form-panel" aria-labelledby="signup-title">
        <Link className="text-link signup-back" to="/">
          Back to home
        </Link>

        <div className="signup-form-content">
          {success ? (
            <div className="signup-success" role="status">
              <p className="eyebrow">YOUR ACCOUNT IS READY</p>
              <h2 id="signup-title">Welcome to the family.</h2>
              <p>
                Your owner account has been created successfully.
                Sign in to visit your account.
              </p>
              <Link className="button dark-button" to="/login">
                Sign in to your account
             </Link>
            </div>
          ) : (
            <>
              <p className="eyebrow">LET’S GET ACQUAINTED</p>
              <h2 id="signup-title">Create your account.</h2>
              <p className="signup-intro">
                A little about you, for a world built around them.
              </p>

              <form onSubmit={handleSubmit} aria-busy={loading}>
                <div className="signup-field">
                  <label htmlFor="signup-name">Your name</label>
                  <input
                    id="signup-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Enter your name"
                    minLength={2}
                    maxLength={100}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-email">Email address</label>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    maxLength={254}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-password">Password</label>
                  <input
                    id="signup-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={15}
                    maxLength={128}
                    aria-describedby="password-help"
                    required
                    disabled={loading}
                  />
                  <small id="password-help">
                    Use 15–128 characters. A memorable passphrase works well.
                  </small>
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-confirm">Confirm password</label>
                  <input
                    id="signup-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={15}
                    maxLength={128}
                    required
                    disabled={loading}
                  />
                </div>

                {error && (
                  <p className="signup-error" role="alert">
                    {error}
                  </p>
                )}

                <button
                  className="button dark-button signup-submit"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Creating your account…' : 'Create account'}
                </button>

                <p className="signup-note">
                  Creating an account registers you as a pet owner.
                </p>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default Signup