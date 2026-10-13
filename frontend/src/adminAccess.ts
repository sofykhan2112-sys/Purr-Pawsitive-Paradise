export type AdminAccessFailure =
  | 'signin'
  | 'forbidden'
  | 'mfa-setup'
  | 'mfa-verification'

type ErrorResponse = {
  code?: unknown
}

export async function getAdminAccessFailure(
  response: Response,
): Promise<AdminAccessFailure | null> {
  if (response.status !== 401 && response.status !== 403) {
    return null
  }

  const data = (await response
    .clone()
    .json()
    .catch(() => null)) as ErrorResponse | null

  if (data?.code === 'ADMIN_MFA_SETUP_REQUIRED') {
    return 'mfa-setup'
  }

  if (data?.code === 'ADMIN_MFA_VERIFICATION_REQUIRED') {
    return 'mfa-verification'
  }

  return response.status === 401 ? 'signin' : 'forbidden'
}
