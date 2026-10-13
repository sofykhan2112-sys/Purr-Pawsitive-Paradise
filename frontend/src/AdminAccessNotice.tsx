import { Link } from 'react-router'
import type { AdminAccessFailure } from './adminAccess'

const content: Record<
  AdminAccessFailure,
  {
    heading: string
    message: string
    link: string
    linkLabel: string
  }
> = {
  signin: {
    heading: 'Sign in required.',
    message: 'Please sign in with an administrator account.',
    link: '/login',
    linkLabel: 'Sign in',
  },
  forbidden: {
    heading: 'Administrator access required.',
    message: 'This account does not have the administrator role.',
    link: '/account',
    linkLabel: 'Back to account',
  },
  'mfa-setup': {
    heading: 'Administrator MFA setup required.',
    message:
      'This administrator account must enable multi-factor authentication before using admin tools.',
    link: '/admin/mfa',
    linkLabel: 'Set up MFA',
  },
  'mfa-verification': {
    heading: 'Administrator MFA verification required.',
    message:
      'Sign in again and complete multi-factor authentication before using admin tools.',
    link: '/login',
    linkLabel: 'Sign in and verify',
  },
}

export function AdminAccessNotice({
  failure,
  className,
}: {
  failure: AdminAccessFailure
  className?: string
}) {
  const details = content[failure]

  return (
    <section className={className} aria-labelledby="admin-access-heading">
      <h2 id="admin-access-heading">{details.heading}</h2>
      <p role="alert">{details.message}</p>
      <Link className="text-link" to={details.link}>
        {details.linkLabel}
      </Link>
    </section>
  )
}
