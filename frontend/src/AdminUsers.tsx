import {
    useEffect,
    useRef,
    useState,
  } from 'react'
  
  import type {
    FormEvent,
  } from 'react'
  import { Link } from 'react-router'
  import './AdminVetEditor.css'
  
  type UserRole =
    | 'OWNER'
    | 'VET'
    | 'AMBULANCE_PROVIDER'
    | 'ADMIN'
  
  type AccountStatus =
    | 'ACTIVE'
    | 'SUSPENDED'
  
  type AdminUser = {
    id: string
    name: string
    email: string
    role: UserRole
    status: AccountStatus
    createdAt: string
    updatedAt: string
  }
  
  type UserResponse = {
    users: AdminUser[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  
  type RoleFilter =
    | ''
    | UserRole
  
  type StatusFilter =
    | ''
    | AccountStatus
  
  function formatLabel(
    value: string,
  ) {
    return value
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase(),
      )
  }
  
  function formatDate(
    value: string,
  ) {
    return new Date(
      value,
    ).toLocaleString(
      'en-IN',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone:
          'Asia/Kolkata',
      },
    )
  }
  
  function AdminUsers() {
    const [
      data,
      setData,
    ] =
      useState<UserResponse | null>(
        null,
      )
  
    const [
      searchInput,
      setSearchInput,
    ] =
      useState('')
  
    const [
      search,
      setSearch,
    ] =
      useState('')
  
    const [
      role,
      setRole,
    ] =
      useState<RoleFilter>('')
  
    const [
      status,
      setStatus,
    ] =
      useState<StatusFilter>('')
  
    const [
      page,
      setPage,
    ] =
      useState(1)
  
    const [
      refresh,
      setRefresh,
    ] =
      useState(0)
  
    const [
      loading,
      setLoading,
    ] =
      useState(true)
  
    const [
      error,
      setError,
    ] =
      useState('')
  
    const [
      notice,
      setNotice,
    ] =
      useState('')
  
    const [
      access,
      setAccess,
    ] =
      useState<
        | 'allowed'
        | 'signin'
        | 'forbidden'
      >('allowed')
  
    const [
      busyId,
      setBusyId,
    ] =
      useState<string | null>(
        null,
      )
  
    const mutationInFlight =
      useRef(false)
  
    useEffect(() => {
      const controller =
        new AbortController()
  
      async function loadUsers() {
        setLoading(true)
        setError('')
        setAccess('allowed')
  
        try {
          const params =
            new URLSearchParams({
              page:
                String(page),
            })
  
          if (search) {
            params.set(
              'q',
              search,
            )
          }
  
          if (role) {
            params.set(
              'role',
              role,
            )
          }
  
          if (status) {
            params.set(
              'status',
              status,
            )
          }
  
          const response =
            await fetch(
              `/api/admin/users?${params.toString()}`,
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
            controller.signal
              .aborted
          ) {
            return
          }
  
          if (
            response.status ===
            401
          ) {
            setAccess(
              'signin',
            )
  
            setData(null)
  
            return
          }
  
          if (
            response.status ===
            403
          ) {
            setAccess(
              'forbidden',
            )
  
            setData(null)
  
            return
          }
  
          const result =
            await response
              .json()
              .catch(
                () => null,
              )
  
          if (!response.ok) {
            throw new Error(
              typeof result?.message ===
                'string'
                ? result.message
                : 'Could not load users.',
            )
          }
  
          if (
            !Array.isArray(
              result?.users,
            ) ||
            !Number.isInteger(
              result?.total,
            ) ||
            !Number.isInteger(
              result?.totalPages,
            )
          ) {
            throw new Error(
              'Invalid users response.',
            )
          }
  
          const lastPage =
            Math.max(
              1,
              result.totalPages,
            )
  
          if (
            page > lastPage
          ) {
            setPage(
              lastPage,
            )
  
            return
          }
  
          setData(result)
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
                : 'Could not load users.',
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
  
      void loadUsers()
  
      return () =>
        controller.abort()
    }, [
      search,
      role,
      status,
      page,
      refresh,
    ])
  
    function submitSearch(
      event: FormEvent,
    ) {
      event.preventDefault()
  
      setSearch(
        searchInput.trim(),
      )
  
      setPage(1)
  
      setNotice('')
      setError('')
    }
  
    function clearFilters() {
      setSearchInput('')
      setSearch('')
      setRole('')
      setStatus('')
      setPage(1)
      setNotice('')
      setError('')
    }
  
    async function changeStatus(
      user: AdminUser,
    ) {
      if (
        mutationInFlight.current
      ) {
        return
      }
  
      const nextStatus:
        AccountStatus =
        user.status ===
        'ACTIVE'
          ? 'SUSPENDED'
          : 'ACTIVE'
  
      const action =
        nextStatus ===
        'SUSPENDED'
          ? 'suspend'
          : 'reactivate'
  
      const confirmed =
        window.confirm(
          `Are you sure you want to ${action} ${user.name} (${user.email})?`,
        )
  
      if (!confirmed) {
        return
      }
  
      mutationInFlight.current =
        true
  
      setBusyId(user.id)
      setError('')
      setNotice('')
  
      try {
        const response =
          await fetch(
            `/api/admin/users/${encodeURIComponent(
              user.id,
            )}/status`,
            {
              method:
                'PATCH',
  
              credentials:
                'same-origin',
  
              headers: {
                'Content-Type':
                  'application/json',
              },
  
              body:
                JSON.stringify({
                  status:
                    nextStatus,
                }),
            },
          )
  
        const result =
          await response
            .json()
            .catch(
              () => null,
            )
  
        if (
          response.status ===
          401
        ) {
          setAccess(
            'signin',
          )
  
          setData(null)
  
          return
        }
  
        if (
          response.status ===
          403
        ) {
          setAccess(
            'forbidden',
          )
  
          setData(null)
  
          return
        }
  
        if (!response.ok) {
          throw new Error(
            typeof result?.message ===
              'string'
              ? result.message
              : 'Could not update the account.',
          )
        }
  
        setNotice(
          typeof result?.message ===
            'string'
            ? result.message
            : nextStatus ===
                'SUSPENDED'
              ? 'User suspended successfully.'
              : 'User reactivated successfully.',
        )
  
        setRefresh(
          (value) =>
            value + 1,
        )
      } catch (
        updateError
      ) {
        setError(
          updateError instanceof
            Error
            ? updateError.message
            : 'Could not update the account.',
        )
      } finally {
        mutationInFlight.current =
          false
  
        setBusyId(null)
      }
    }
  
    return (
      <main className="page-width vet-editor-main">
        <p className="eyebrow">
          ADMINISTRATION
        </p>
  
        <h1>
          Manage users
        </h1>
  
        <p>
          Review registered
          accounts and control
          whether an account may
          use authenticated
          services.
        </p>
  
        <Link
          className="text-link"
          to="/account"
        >
          Back to account
        </Link>
  
        <form
          onSubmit={
            submitSearch
          }
          style={{
            display: 'grid',
            gap: '1rem',
            margin:
              '1.5rem 0',
            padding:
              '1.25rem',
            border:
              '1px solid #dfe4df',
            borderRadius:
              '12px',
            background:
              '#fff',
          }}
        >
          <div>
            <label
              htmlFor="user-search"
            >
              <strong>
                Search users
              </strong>
            </label>
  
            <input
              id="user-search"
              type="search"
              value={
                searchInput
              }
              maxLength={100}
              placeholder="Search by name or email"
              onChange={(
                event,
              ) =>
                setSearchInput(
                  event.target
                    .value,
                )
              }
              style={{
                width: '100%',
                boxSizing:
                  'border-box',
                marginTop:
                  '0.5rem',
                padding:
                  '0.75rem',
                font: 'inherit',
              }}
            />
          </div>
  
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              flexWrap:
                'wrap',
            }}
          >
            <label>
              <span
                style={{
                  display:
                    'block',
                  marginBottom:
                    '0.5rem',
                }}
              >
                Role
              </span>
  
              <select
                value={role}
                disabled={
                  busyId !==
                  null
                }
                onChange={(
                  event,
                ) => {
                  setRole(
                    event.target
                      .value as RoleFilter,
                  )
  
                  setPage(1)
                }}
                style={{
                  padding:
                    '0.7rem',
                }}
              >
                <option value="">
                  All roles
                </option>
  
                <option value="OWNER">
                  Owner
                </option>
  
                <option value="VET">
                  Vet
                </option>
  
                <option value="AMBULANCE_PROVIDER">
                  Ambulance
                  provider
                </option>
  
                <option value="ADMIN">
                  Administrator
                </option>
              </select>
            </label>
  
            <label>
              <span
                style={{
                  display:
                    'block',
                  marginBottom:
                    '0.5rem',
                }}
              >
                Status
              </span>
  
              <select
                value={
                  status
                }
                disabled={
                  busyId !==
                  null
                }
                onChange={(
                  event,
                ) => {
                  setStatus(
                    event.target
                      .value as StatusFilter,
                  )
  
                  setPage(1)
                }}
                style={{
                  padding:
                    '0.7rem',
                }}
              >
                <option value="">
                  All statuses
                </option>
  
                <option value="ACTIVE">
                  Active
                </option>
  
                <option value="SUSPENDED">
                  Suspended
                </option>
              </select>
            </label>
          </div>
  
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              flexWrap:
                'wrap',
            }}
          >
            <button
              type="submit"
              className="button dark-button"
              disabled={
                loading ||
                busyId !== null
              }
            >
              Search
            </button>
  
            <button
              type="button"
              className="button"
              disabled={
                loading ||
                busyId !== null
              }
              onClick={
                clearFilters
              }
            >
              Clear filters
            </button>
  
            <button
              type="button"
              className="button"
              disabled={
                loading ||
                busyId !== null
              }
              onClick={() =>
                setRefresh(
                  (value) =>
                    value + 1,
                )
              }
            >
              Refresh
            </button>
          </div>
        </form>
  
        {notice && (
          <p role="status">
            {notice}
          </p>
        )}
  
        {error && (
          <p role="alert">
            {error}
          </p>
        )}
  
        {loading ? (
          <p role="status">
            Loading users…
          </p>
        ) : access ===
          'signin' ? (
          <p>
            Please{' '}
            <Link to="/login">
              sign in
            </Link>{' '}
            with an administrator
            account.
          </p>
        ) : access ===
          'forbidden' ? (
          <p role="alert">
            Administrator access
            is required.
          </p>
        ) : data ? (
          <>
            <p>
              {data.total}{' '}
              {data.total === 1
                ? 'user'
                : 'users'}{' '}
              found.
            </p>
  
            {data.users
              .length ===
            0 ? (
              <p>
                No users match
                these filters.
              </p>
            ) : (
              <div
                style={{
                  display:
                    'grid',
                  gap:
                    '1.25rem',
                }}
              >
                {data.users.map(
                  (user) => {
                    const busy =
                      busyId ===
                      user.id
  
                    const suspended =
                      user.status ===
                      'SUSPENDED'
  
                    return (
                      <article
                        key={
                          user.id
                        }
                        style={{
                          border:
                            '1px solid #d8d8d8',
                          borderRadius:
                            '12px',
                          padding:
                            '1.5rem',
                          background:
                            '#fff',
                          overflowWrap:
                            'anywhere',
                        }}
                      >
                        <div
                          style={{
                            display:
                              'flex',
                            justifyContent:
                              'space-between',
                            alignItems:
                              'flex-start',
                            gap:
                              '1rem',
                            flexWrap:
                              'wrap',
                          }}
                        >
                          <div>
                            <p className="eyebrow">
                              {formatLabel(
                                user.role,
                              )}
                            </p>
  
                            <h2
                              style={{
                                marginBottom:
                                  '0.35rem',
                              }}
                            >
                              {
                                user.name
                              }
                            </h2>
  
                            <p
                              style={{
                                marginTop:
                                  0,
                              }}
                            >
                              {
                                user.email
                              }
                            </p>
                          </div>
  
                          <strong
                            style={{
                              padding:
                                '0.4rem 0.75rem',
                              border:
                                '1px solid #d8d8d8',
                              borderRadius:
                                '999px',
                            }}
                          >
                            {formatLabel(
                              user.status,
                            )}
                          </strong>
                        </div>
  
                        <p>
                          <strong>
                            Role:
                          </strong>{' '}
                          {formatLabel(
                            user.role,
                          )}
                        </p>
  
                        <p>
                          <strong>
                            Status:
                          </strong>{' '}
                          {formatLabel(
                            user.status,
                          )}
                        </p>
  
                        <p>
                          <strong>
                            Registered:
                          </strong>{' '}
                          {formatDate(
                            user.createdAt,
                          )}{' '}
                          IST
                        </p>
  
                        <p>
                          <strong>
                            Last account
                            update:
                          </strong>{' '}
                          {formatDate(
                            user.updatedAt,
                          )}{' '}
                          IST
                        </p>
  
                        <p>
                          <small>
                            User reference:{' '}
                            {
                              user.id
                            }
                          </small>
                        </p>
  
                        <button
                          type="button"
                          className={
                            suspended
                              ? 'button dark-button'
                              : 'button'
                          }
                          disabled={
                            busyId !==
                            null
                          }
                          onClick={() =>
                            void changeStatus(
                              user,
                            )
                          }
                        >
                          {busy
                            ? 'Saving…'
                            : suspended
                              ? 'Reactivate account'
                              : 'Suspend account'}
                        </button>
                      </article>
                    )
                  },
                )}
              </div>
            )}
  
            {data.totalPages >
              1 && (
              <nav
                aria-label="User pages"
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  gap: '1rem',
                  marginTop:
                    '1.5rem',
                }}
              >
                <button
                  type="button"
                  className="button"
                  disabled={
                    page <= 1 ||
                    busyId !==
                      null
                  }
                  onClick={() =>
                    setPage(
                      (value) =>
                        value - 1,
                    )
                  }
                >
                  Previous
                </button>
  
                <span>
                  Page {page} of{' '}
                  {
                    data.totalPages
                  }
                </span>
  
                <button
                  type="button"
                  className="button"
                  disabled={
                    page >=
                      data.totalPages ||
                    busyId !==
                      null
                  }
                  onClick={() =>
                    setPage(
                      (value) =>
                        value + 1,
                    )
                  }
                >
                  Next
                </button>
              </nav>
            )}
          </>
        ) : null}
      </main>
    )
  }
  
  export default AdminUsers