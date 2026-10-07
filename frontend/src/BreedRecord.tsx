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
  
  function BreedRecord() {
    const {
      species,
      slug,
    } = useParams()
  
    const [
      record,
      setRecord,
    ] =
      useState<RecordItem | null>(
        null,
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
      if (!slug) {
        setLoading(false)
        setError(
          'Record not found.',
        )
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
              `/api/breeds/${encodeURIComponent(
                slug!,
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
                : 'Could not load this record.',
            )
          }
  
          if (!data?.record) {
            throw new Error(
              'Invalid record response.',
            )
          }
  
          const expected =
            species &&
            species in
              routeToSpecies
              ? routeToSpecies[
                  species as keyof typeof routeToSpecies
                ]
              : null
  
          if (
            expected &&
            data.record
              .petGroup !==
              expected
          ) {
            throw new Error(
              'This record does not belong to this pet group.',
            )
          }
  
          if (
            !controller.signal
              .aborted
          ) {
            setRecord(
              data.record,
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
                : 'Could not load this record.',
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
    }, [slug, species])
  
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
            to={`/pets/${species ?? 'cats'}`}
          >
            {species ??
              'Pets'}
          </Link>
  
          <span
            aria-hidden="true"
          >
            /
          </span>
  
          <Link
            to={`/pets/${species ?? 'cats'}/breeds`}
          >
            Library
          </Link>
        </nav>
  
        {loading ? (
          <p role="status">
            Loading record…
          </p>
        ) : error ? (
          <section>
            <p
              className="breed-library-notice"
              role="alert"
            >
              {error}
            </p>
  
            <Link
              className="button dark-button"
              to={`/pets/${species ?? 'cats'}/breeds`}
            >
              Back to library
            </Link>
          </section>
        ) : record ? (
          <article className="breed-record">
            <p className="eyebrow">
              {
                speciesLabels[
                  record.petGroup
                ]
              }{' '}
              RECORD
            </p>
  
            <h1>
              {record.name}
            </h1>
  
            <section>
              <h2>
                Characteristics
              </h2>
  
              <p>
                {
                  record.characteristics
                }
              </p>
            </section>
  
            <section>
              <h2>
                Care context
              </h2>
  
              <p>
                {
                  record.careSummary
                }
              </p>
            </section>
  
            {record
              .articleSlugs
              .length > 0 && (
              <section>
                <h2>
                  Related reading
                </h2>
  
                <ul>
                  {record.articleSlugs.map(
                    (
                      articleSlug,
                    ) => (
                      <li
                        key={
                          articleSlug
                        }
                      >
                        <Link
                          className="text-link"
                          to={`/articles/${articleSlug}`}
                        >
                          {
                            articleSlug
                          }
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </section>
            )}
  
            <aside className="breed-library-notice">
              This record is
              educational care
              context. It does not
              diagnose a condition
              or replace individual
              veterinary advice.
            </aside>
  
            <Link
              className="text-link"
              to={`/pets/${species ?? 'cats'}/breeds`}
            >
              Back to library
            </Link>
          </article>
        ) : null}
      </main>
    )
  }
  
  export default BreedRecord