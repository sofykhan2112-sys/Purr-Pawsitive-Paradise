import {
    useEffect,
    useState,
  } from 'react'
  
  import {
    Link,
    useParams,
  } from 'react-router'
  
  import './BreedLibrary.css'
  
  type PetGroup =
    | 'CAT'
    | 'DOG'
    | 'TURTLE'
  
  type RecordItem = {
    id: string
    slug: string
    petGroup: PetGroup
    name: string
    characteristics: string
    careSummary: string
    articleSlugs: string[]
  }
  
  const routeToSpecies = {
    cats: 'CAT',
    dogs: 'DOG',
    turtles: 'TURTLE',
  } as const
  
  const speciesLabels = {
    CAT: 'Cat',
    DOG: 'Dog',
    TURTLE: 'Turtle',
  } as const
  
  function BreedLibrary() {
    const { species } =
      useParams()
  
    const petGroup =
      species &&
      species in
        routeToSpecies
        ? routeToSpecies[
            species as keyof typeof routeToSpecies
          ]
        : null
  
    const [
      records,
      setRecords,
    ] =
      useState<RecordItem[]>(
        [],
      )
  
    const [
      loading,
      setLoading,
    ] = useState(true)
  
    const [
      error,
      setError,
    ] = useState('')
  
    useEffect(() => {
      if (!petGroup) {
        setLoading(false)
        return
      }
  
      const controller =
        new AbortController()
  
      async function load() {
        setLoading(true)
        setError('')
  
        try {
          const response =
            await fetch(
              `/api/breeds?species=${encodeURIComponent(
                petGroup!,
              )}`,
              {
                cache:
                  'no-store',
  
                signal:
                  controller.signal,
              },
            )
  
          const data =
            await response
              .json()
              .catch(
                () => null,
              )
  
          if (!response.ok) {
            throw new Error(
              typeof data
                ?.message ===
                'string'
                ? data.message
                : 'Could not load the library.',
            )
          }
  
          if (
            !Array.isArray(
              data?.records,
            )
          ) {
            throw new Error(
              'Invalid library response.',
            )
          }
  
          if (
            !controller.signal
              .aborted
          ) {
            setRecords(
              data.records,
            )
          }
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
                : 'Could not load the library.',
            )
          }
        } finally {
          if (
            !controller.signal
              .aborted
          ) {
            setLoading(false)
          }
        }
      }
  
      void load()
  
      return () =>
        controller.abort()
    }, [petGroup])
  
    if (!petGroup) {
      return (
        <main className="page-width breed-library-page">
          <p className="eyebrow">
            BREED & SPECIES
            LIBRARY
          </p>
  
          <h1>
            Pet group not found.
          </h1>
  
          <Link
            className="button dark-button"
            to="/"
          >
            Back to home
          </Link>
        </main>
      )
    }
  
    const title =
      petGroup === 'TURTLE'
        ? 'Turtle species & types'
        : `${speciesLabels[
            petGroup
          ]} breeds & types`
  
    return (
      <main className="page-width breed-library-page">
        <nav
          className="breadcrumbs"
          aria-label="Breadcrumb"
        >
          <Link to="/">
            Home
          </Link>
  
          <span
            aria-hidden="true"
          >
            /
          </span>
  
          <Link
            to={`/pets/${species}`}
          >
            {species}
          </Link>
  
          <span
            aria-hidden="true"
          >
            /
          </span>
  
          <span
            aria-current="page"
          >
            Library
          </span>
        </nav>
  
        <header className="breed-library-hero">
          <p className="eyebrow">
            BREED & SPECIES
            LIBRARY
          </p>
  
          <h1>{title}</h1>
  
          <p>
            Explore stable
            breed/species records
            with a clear pet-group
            label, general
            characteristics, and
            care context.
          </p>
        </header>
  
        {loading ? (
          <p role="status">
            Loading library…
          </p>
        ) : error ? (
          <p
            className="breed-library-notice"
            role="alert"
          >
            {error}
          </p>
        ) : records.length ===
          0 ? (
          <p className="breed-library-notice">
            No records are
            available for this pet
            group yet.
          </p>
        ) : (
          <section
            className="breed-library-grid"
            aria-label={title}
          >
            {records.map(
              (record) => (
                <article
                  className="breed-library-card"
                  key={
                    record.id
                  }
                >
                  <p className="eyebrow">
                    {
                      speciesLabels[
                        record
                          .petGroup
                      ]
                    }
                  </p>
  
                  <h2>
                    {
                      record.name
                    }
                  </h2>
  
                  <p>
                    {
                      record.characteristics
                    }
                  </p>
  
                  <Link
                    className="text-link"
                    to={`/pets/${species}/breeds/${record.slug}`}
                  >
                    Read record
                  </Link>
                </article>
              ),
            )}
          </section>
        )}
      </main>
    )
  }
  
  export default BreedLibrary
  