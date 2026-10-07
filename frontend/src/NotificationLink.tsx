import { useEffect, useState } from 'react'
import { Link } from 'react-router'

function NotificationLink() {
  const [unreadCount, setUnreadCount] = useState<number | null>(null)

  useEffect(() => {
    let stopped = false
    let authenticationRequired = false
    let inFlight = false
    let controller: AbortController | null = null

    async function refreshCount() {
      if (
        stopped ||
        authenticationRequired ||
        inFlight ||
        document.visibilityState !== 'visible'
      ) {
        return
      }

      inFlight = true
      controller = new AbortController()

      const timeout = window.setTimeout(() => {
        controller?.abort()
      }, 10000)

      try {
        const response = await fetch(
          '/api/notifications/unread-count',
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        if (stopped) return

        if (response.status === 401) {
          authenticationRequired = true
          setUnreadCount(null)
          return
        }

        if (!response.ok) {
          throw new Error('Could not load unread count.')
        }

        const data = await response.json()

        if (
          !Number.isSafeInteger(data.unreadCount) ||
          data.unreadCount < 0
        ) {
          throw new Error('Invalid unread count.')
        }

        if (!stopped) {
          setUnreadCount(data.unreadCount)
        }
      } catch {
        if (!stopped) {
          // An unavailable count is not the same as zero unread.
          setUnreadCount(null)
        }
      } finally {
        window.clearTimeout(timeout)
        inFlight = false
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshCount()
      }
    }

    function onFocus() {
      void refreshCount()
    }

    void refreshCount()

    const interval = window.setInterval(() => {
      void refreshCount()
    }, 30000)

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)

    return () => {
      stopped = true
      controller?.abort()
      window.clearInterval(interval)
      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      )
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return (
    <Link
      to="/notifications"
      aria-label={
        unreadCount === null
          ? 'Notifications'
          : `Notifications, ${unreadCount} unread`
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}
    >
      Notifications

      {unreadCount !== null && unreadCount > 0 && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '1.4rem',
            height: '1.4rem',
            padding: '0 0.35rem',
            borderRadius: '999px',
            backgroundColor: '#14564b',
            color: '#ffffff',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}

export default NotificationLink