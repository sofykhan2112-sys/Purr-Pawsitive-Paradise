import { Router } from 'express'
import { prisma } from './db.js'
import { Prisma } from './generated/prisma/client.js'
import type {} from './auth.js'

export const petsRouter = Router()

// Every pet request requires an active owner account.
petsRouter.use(async (req, res, next) => {
  try {
    if (!req.session.userId) {
      res.status(401).json({ message: 'Please sign in.' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: {
        status: true,
        role: true,
      },
    })

    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({ message: 'Please sign in again.' })
      return
    }

    if (user.role !== 'OWNER') {
      res.status(403).json({
        message: 'Pet profiles are available to owner accounts.',
      })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
})

// Protect requests that change pet records.
petsRouter.use((req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    const allowedOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

    const origin = req.get('origin')

    if (origin && origin !== allowedOrigin) {
      res.status(403).json({ message: 'Request origin is not allowed.' })
      return
    }

    if (!req.is('application/json')) {
      res.status(415).json({ message: 'Send the request as JSON.' })
      return
    }
  }

  next()
})

// GET /api/pets — list the signed-in owner's pets.
petsRouter.get('/', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')

  try {
    const pets = await prisma.pet.findMany({
      where: {
        ownerId: req.session.userId!,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        species: true,
        breedOrType: true,
        ageGroup: true,
        createdAt: true,
      },
    })

    res.json({ pets })
  } catch (error) {
    next(error)
  }
})

// POST /api/pets — create a pet for the signed-in owner.
petsRouter.post('/', async (req, res, next) => {
  const body = req.body

  if (
    !body ||
    typeof body.name !== 'string' ||
    typeof body.species !== 'string'
  ) {
    res.status(400).json({
      message: 'Pet name and species are required.',
    })
    return
  }

  const name = body.name.trim()
  const species = body.species

  if (name.length < 1 || name.length > 100) {
    res.status(400).json({
      message: 'Pet name must contain between 1 and 100 characters.',
    })
    return
  }

  if (species !== 'CAT' && species !== 'DOG' && species !== 'TURTLE') {
    res.status(400).json({
      message: 'Choose CAT, DOG, or TURTLE.',
    })
    return
  }

  if (
    body.breedOrType !== undefined &&
    typeof body.breedOrType !== 'string'
  ) {
    res.status(400).json({
      message: 'Breed or type must be text.',
    })
    return
  }

  if (
    body.ageGroup !== undefined &&
    typeof body.ageGroup !== 'string'
  ) {
    res.status(400).json({
      message: 'Age information must be text.',
    })
    return
  }

  const breedOrType = body.breedOrType?.trim() || null
  const ageGroup = body.ageGroup?.trim() || null

  if (
    (breedOrType && breedOrType.length > 100) ||
    (ageGroup && ageGroup.length > 50)
  ) {
    res.status(400).json({
      message: 'Breed/type must be at most 100 characters; age at most 50.',
    })
    return
  }

  try {
    const pet = await prisma.pet.create({
      data: {
        name,
        species,
        breedOrType,
        ageGroup,
        ownerId: req.session.userId!,
      },
      select: {
        id: true,
        name: true,
        species: true,
        breedOrType: true,
        ageGroup: true,
        createdAt: true,
      },
    })

    res.status(201).json({
      message: 'Pet profile created successfully.',
      pet,
    })
  } catch (error) {
    next(error)
  }
})
// PUT /api/pets/:id — replace a pet's editable details.
petsRouter.put('/:id', async (req, res, next) => {
  const id = req.params.id

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (typeof id !== 'string' || !uuidPattern.test(id)) {
    res.status(400).json({ message: 'Invalid pet ID.' })
    return
  }

  const body = req.body

  if (
    !body ||
    typeof body.name !== 'string' ||
    typeof body.species !== 'string'
  ) {
    res.status(400).json({
      message: 'Pet name and species are required.',
    })
    return
  }

  const name = body.name.trim()
  const species = body.species

  if (name.length < 1 || name.length > 100) {
    res.status(400).json({
      message: 'Pet name must contain between 1 and 100 characters.',
    })
    return
  }

  if (species !== 'CAT' && species !== 'DOG' && species !== 'TURTLE') {
    res.status(400).json({
      message: 'Choose CAT, DOG, or TURTLE.',
    })
    return
  }

  if (
    (body.breedOrType !== undefined &&
      typeof body.breedOrType !== 'string') ||
    (body.ageGroup !== undefined &&
      typeof body.ageGroup !== 'string')
  ) {
    res.status(400).json({
      message: 'Breed/type and age must be text.',
    })
    return
  }

  const breedOrType = body.breedOrType?.trim() || null
  const ageGroup = body.ageGroup?.trim() || null

  if (
    (breedOrType && breedOrType.length > 100) ||
    (ageGroup && ageGroup.length > 50)
  ) {
    res.status(400).json({
      message: 'Breed/type must be at most 100 characters; age at most 50.',
    })
    return
  }

  try {
    const result = await prisma.pet.updateMany({
      where: {
        id,
        ownerId: req.session.userId!,
      },
      data: {
        name,
        species,
        breedOrType,
        ageGroup,
      },
    })

    if (result.count === 0) {
      res.status(404).json({ message: 'Pet profile not found.' })
      return
    }

    res.json({ message: 'Pet profile updated successfully.' })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/pets/:id
// Delete only the signed-in owner's pet.
// The database preserves pets referenced by appointment history.
petsRouter.delete('/:id', async (req, res, next) => {
  const id = req.params.id

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (typeof id !== 'string' || !uuidPattern.test(id)) {
    res.status(400).json({
      message: 'Invalid pet ID.',
    })
    return
  }

  const ownerId = req.session.userId

  if (!ownerId) {
    res.status(401).json({
      message: 'Please sign in.',
    })
    return
  }

  try {
    const result = await prisma.pet.deleteMany({
      where: {
        id,
        ownerId,
      },
    })

    if (result.count === 0) {
      res.status(404).json({
        message: 'Pet profile not found.',
      })
      return
    }

    res.json({
      message: 'Pet profile deleted successfully.',
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      res.status(409).json({
        message:
        'This pet has appointment or transport-request history and cannot be deleted. Its profile is kept to preserve those records.',
      })
      return
    }

    next(error)
  }
})