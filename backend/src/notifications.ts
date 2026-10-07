import { Router } from 'express'
import { prisma } from './db.js'
import { Prisma } from './generated/prisma/client.js'
import type {} from './auth.js'

export const notificationsRouter = Router()

notificationsRouter.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')

  try {
    const userId = req.session.userId

    if (!userId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    })

    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({
        message: 'Please sign in with an active account.',
      })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
})

// GET /api/notifications/unread-count
notificationsRouter.get('/unread-count', async (req, res, next) => {
    const userId = req.session.userId
  
    if (!userId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }
  
    try {
      const unreadCount = await prisma.notification.count({
        where: {
          userId,
          readAt: null,
        },
      })
  
      res.json({ unreadCount })
    } catch (error) {
      next(error)
    }
  })

// GET /api/notifications?page=1
notificationsRouter.get('/', async (req, res, next) => {
  const page = req.query.page
  const unread = req.query.unread

if (
  unread !== undefined &&
  unread !== 'true' &&
  unread !== 'false'
) {
  res.status(400).json({
    message: 'Unread must be true or false.',
  })
  return
}

  if (
    page !== undefined &&
    (typeof page !== 'string' || !/^[1-9]\d{0,4}$/.test(page))
  ) {
    res.status(400).json({
      message: 'Page must be a positive number up to 99999.',
    })
    return
  }

  const userId = req.session.userId

  if (!userId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  const pageNumber = page === undefined ? 1 : Number(page)
  const pageSize = 12

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(unread === 'true' ? { readAt: null } : {}),
  }

  try {
    const [notifications, total, unreadCount] =
      await prisma.$transaction(
        [
          prisma.notification.findMany({
            where,
            orderBy: [
              { createdAt: 'desc' },
              { id: 'asc' },
            ],
            skip: (pageNumber - 1) * pageSize,
            take: pageSize,
            select: {
              id: true,
              readAt: true,
              createdAt: true,
              appointmentEvent: {
                select: {
                  action: true,
                  newStatus: true,
                  createdAt: true,
                  appointment: {
                    select: {
                      id: true,
                      ownerId: true,
                      providerUserId: true,
                      isDemo: true,
                      pet: {
                        select: { name: true },
                      },
                      listing: {
                        select: { clinicName: true },
                      },
                    },
                  },
                },
              },
            },
          }),
          prisma.notification.count({ where }),
          prisma.notification.count({
            where: { userId, readAt: null },
          }),
        ],
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.RepeatableRead,
        },
      )

    res.json({
      notifications: notifications.map((notification) => {
        const event = notification.appointmentEvent
        const appointment = event.appointment

        return {
          id: notification.id,
          readAt: notification.readAt,
          createdAt: notification.createdAt,
          action: event.action,
          eventStatus: event.newStatus,
          eventCreatedAt: event.createdAt,
          appointmentId: appointment.id,
          isDemo: appointment.isDemo,
          petName: appointment.pet.name,
          clinicName: appointment.listing.clinicName,
          destination:
             appointment.ownerId === userId
             ? `/appointments?appointmentId=${encodeURIComponent(appointment.id)}`
              : appointment.providerUserId === userId
             ? `/provider/appointments?appointmentId=${encodeURIComponent(appointment.id)}`
             : '/account',
        }
      }),
      total,
      unreadCount,
      page: pageNumber,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/notifications/read-all
notificationsRouter.post('/read-all', async (req, res, next) => {
    const allowedOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
  
    const origin = req.get('origin')
  
    if (
      (origin && origin !== allowedOrigin) ||
      req.get('sec-fetch-site') === 'cross-site'
    ) {
      res.status(403).json({
        message: 'Request origin is not allowed.',
      })
      return
    }
  
    if (!req.is('application/json')) {
      res.status(415).json({ message: 'Send the request as JSON.' })
      return
    }
  
    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body) ||
      Object.keys(req.body).length !== 0
    ) {
      res.status(400).json({
        message: 'Send an empty JSON object.',
      })
      return
    }
  
    const userId = req.session.userId
  
    if (!userId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }
  
    const now = new Date()
  
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          readAt: null,
          createdAt: { lte: now },
        },
        data: {
          readAt: now,
        },
      })
  
      res.json({
        message: 'Notifications marked as read.',
        updatedCount: result.count,
      })
    } catch (error) {
      next(error)
    }
  })

// POST /api/notifications/:id/read
notificationsRouter.post('/:id/read', async (req, res, next) => {
  const allowedOrigin =
    process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

  const origin = req.get('origin')

  if (
    (origin && origin !== allowedOrigin) ||
    req.get('sec-fetch-site') === 'cross-site'
  ) {
    res.status(403).json({
      message: 'Request origin is not allowed.',
    })
    return
  }

  if (!req.is('application/json')) {
    res.status(415).json({ message: 'Send the request as JSON.' })
    return
  }

  if (
    !req.body ||
    typeof req.body !== 'object' ||
    Array.isArray(req.body) ||
    Object.keys(req.body).length !== 0
  ) {
    res.status(400).json({ message: 'Send an empty JSON object.' })
    return
  }

  const id = req.params.id
  const userId = req.session.userId

  if (!userId) {
    res.status(401).json({ message: 'Please sign in.' })
    return
  }

  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    res.status(400).json({ message: 'Invalid notification ID.' })
    return
  }

  try {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    })

    if (!notification) {
      res.status(404).json({ message: 'Notification not found.' })
      return
    }

    // Repeated clicks preserve the original read timestamp.
    await prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    })

    res.json({ message: 'Notification marked as read.' })
  } catch (error) {
    next(error)
  }
})