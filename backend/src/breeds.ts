import { Router } from 'express'
import { prisma } from './db.js'

export const breedsRouter = Router()

const allowedSpecies = new Set([
  'CAT',
  'DOG',
  'TURTLE',
])

breedsRouter.get(
  '/',
  async (req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store',
    )

    const species =
      req.query.species

    if (
      species !== undefined &&
      (
        typeof species !==
          'string' ||
        !allowedSpecies.has(
          species,
        )
      )
    ) {
      res.status(400).json({
        message:
          'Species must be CAT, DOG, or TURTLE.',
      })

      return
    }

    try {
      const records =
        await prisma
          .breedSpeciesRecord
          .findMany({
            where:
              typeof species ===
              'string'
                ? {
                    petGroup:
                      species as
                        | 'CAT'
                        | 'DOG'
                        | 'TURTLE',
                  }
                : undefined,

            orderBy: [
              {
                petGroup:
                  'asc',
              },
              {
                name: 'asc',
              },
            ],

            select: {
              id: true,
              slug: true,
              petGroup: true,
              name: true,
              characteristics:
                true,
              careSummary: true,
              articleSlugs: true,
            },
          })

      res.json({
        records,
        total:
          records.length,
      })
    } catch (error) {
      next(error)
    }
  },
)

breedsRouter.get(
  '/:slug',
  async (req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store',
    )

    const slug =
      req.params.slug

    if (
      typeof slug !==
        'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        slug,
      ) ||
      slug.length > 180
    ) {
      res.status(400).json({
        message:
          'Invalid breed or species record.',
      })

      return
    }

    try {
      const record =
        await prisma
          .breedSpeciesRecord
          .findUnique({
            where: {
              slug,
            },

            select: {
              id: true,
              slug: true,
              petGroup: true,
              name: true,
              characteristics:
                true,
              careSummary: true,
              articleSlugs: true,
            },
          })

      if (!record) {
        res.status(404).json({
          message:
            'Breed or species record not found.',
        })

        return
      }

      res.json({
        record,
      })
    } catch (error) {
      next(error)
    }
  },
)
