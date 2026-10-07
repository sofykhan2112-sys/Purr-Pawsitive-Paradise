import {

  useEffect,

  useState,

} from 'react'

import type {

  FormEvent,

} from 'react'

import {

  Link,

} from 'react-router'

import './VetDirectory.css'

type Species =

  | 'CAT'

  | 'DOG'

  | 'TURTLE'

type SpeciesFilter =

  | ''

  | Species

type LocationFilter = {

  latitude: number

  longitude: number

  radiusKm: number

}

type VetListing = {

  id: string

  slug: string

  vetName: string

  clinicName: string

  qualifications: string | null

  description: string | null

  species: Species[]

  addressLine1: string

  addressLine2: string | null

  city: string

  state: string

  postalCode: string | null

  countryCode: string

  phone: string | null

  email: string | null

  websiteUrl: string | null

  openingHours: string | null

  isDemo: boolean

  lastConfirmedAt: string | null

  distanceKm: number | null

}

type DirectoryFilters = {

  city: string

  postalCode: string

  q: string

  species: SpeciesFilter

  location: LocationFilter | null

}

const speciesLabels:

  Record<Species, string> = {

    CAT: 'Cats',

    DOG: 'Dogs',

    TURTLE: 'Turtles',

  }

function safeWebsite(

  value: string | null,

): string | null {

  if (!value) {

    return null

  }

  try {

    const url =

      new URL(value)

    if (

      url.protocol !== 'http:' &&

      url.protocol !== 'https:'

    ) {

      return null

    }

    return url.href

  } catch {

    return null

  }

}

function phoneLink(

  value: string | null,

): string | null {

  if (!value) {

    return null

  }

  const number =

    value.replace(

      /[\s().-]/g,

      '',

    )

  return /^\+?\d{7,15}$/.test(

    number,

  )

    ? `tel:${number}`

    : null

}

function VetDirectory() {

  const [

    cityInput,

    setCityInput,

  ] = useState('')

  const [

    postalCodeInput,

    setPostalCodeInput,

  ] = useState('')

  const [

    searchInput,

    setSearchInput,

  ] = useState('')

  const [

    speciesInput,

    setSpeciesInput,

  ] =

    useState<SpeciesFilter>('')

  const [

    filters,

    setFilters,

  ] =

    useState<DirectoryFilters>({

      city: '',

      postalCode: '',

      q: '',

      species: '',

      location: null,

    })

  const [

    vets,

    setVets,

  ] =

    useState<VetListing[]>([])

  const [

    page,

    setPage,

  ] =

    useState(1)

  const [

    total,

    setTotal,

  ] =

    useState(0)

  const [

    totalPages,

    setTotalPages,

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

    retry,

    setRetry,

  ] =

    useState(0)

  const [

    locating,

    setLocating,

  ] =

    useState(false)

  const [

    locationMessage,

    setLocationMessage,

  ] =

    useState('')

  const [

    locationSearch,

    setLocationSearch,

  ] =

    useState(false)

  const [

    activeRadiusKm,

    setActiveRadiusKm,

  ] =

    useState<number | null>(

      null,

    )

  useEffect(() => {

    const controller =

      new AbortController()

    async function loadVets() {

      setLoading(true)

      setError('')

      const params =

        new URLSearchParams({

          page:

            String(page),

        })

      if (filters.city) {

        params.set(

          'city',

          filters.city,

        )

      }

      if (filters.postalCode) {

        params.set(

          'postalCode',

          filters.postalCode,

        )

      }

      if (filters.q) {

        params.set(

          'q',

          filters.q,

        )

      }

      if (filters.species) {

        params.set(

          'species',

          filters.species,

        )

      }

      if (filters.location) {

        params.set(

          'latitude',

          String(

            filters

              .location

              .latitude,

          ),

        )

        params.set(

          'longitude',

          String(

            filters

              .location

              .longitude,

          ),

        )

        params.set(

          'radiusKm',

          String(

            filters

              .location

              .radiusKm,

          ),

        )

      }

      try {

        const response =

          await fetch(

            `/api/vets?${params}`,

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

            typeof data?.message ===

              'string'

              ? data.message

              : 'Directory request failed.',

          )

        }

        if (

          !Array.isArray(

            data?.vets,

          ) ||

          !Number.isInteger(

            data.total,

          ) ||

          data.total < 0 ||

          !Number.isInteger(

            data.totalPages,

          ) ||

          data.totalPages < 0

        ) {

          throw new Error(

            'Invalid directory response.',

          )

        }

        const validVets =

          data.vets.every(

            (

              vet: unknown,

            ) => {

              if (

                !vet ||

                typeof vet !==

                  'object'

              ) {

                return false

              }

              const value =

                vet as {

                  id?: unknown

                  clinicName?: unknown

                  distanceKm?:

                    unknown

                }

              if (

                typeof value.id !==

                  'string' ||

                typeof value

                  .clinicName !==

                  'string'

              ) {

                return false

              }

              return (

                value.distanceKm ===

                  null ||

                value.distanceKm ===

                  undefined ||

                (

                  typeof value

                    .distanceKm ===

                    'number' &&

                  Number.isFinite(

                    value.distanceKm,

                  ) &&

                  value.distanceKm >=

                    0

                )

              )

            },

          )

        if (!validVets) {

          throw new Error(

            'Invalid vet listing response.',

          )

        }

        if (

          !controller.signal

            .aborted

        ) {

          setVets(

            data.vets,

          )

          setTotal(

            data.total,

          )

          setTotalPages(

            data.totalPages,

          )

          const nearby =

            data.locationSearch ===

            true

          setLocationSearch(

            nearby,

          )

          setActiveRadiusKm(

            nearby &&

              typeof data.radiusKm ===

                'number'

              ? data.radiusKm

              : null,

          )

        }

      } catch (loadError) {

        if (

          !controller.signal

            .aborted

        ) {

          setError(

            loadError instanceof

              Error

              ? loadError.message

              : 'We couldn’t load the directory. Please try again.',

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

    void loadVets()

    return () =>

      controller.abort()

  }, [

    filters,

    page,

    retry,

  ])

  function handleSearch(

    event:

      FormEvent<HTMLFormElement>,

  ) {

    event.preventDefault()

    setLocationMessage('')

    setLocationSearch(false)

    setActiveRadiusKm(null)

    setLoading(true)

    setPage(1)

    setFilters({

      city:

        cityInput.trim(),

      postalCode:

        postalCodeInput.trim(),

      q:

        searchInput.trim(),

      species:

        speciesInput,

      location:

        null,

    })

  }

  function clearFilters() {

    setCityInput('')

    setPostalCodeInput('')

    setSearchInput('')

    setSpeciesInput('')

    setLocationMessage('')

    setLocationSearch(false)

    setActiveRadiusKm(null)

    setPage(1)

    setLoading(true)

    setFilters({

      city: '',

      postalCode: '',

      q: '',

      species: '',

      location: null,

    })

  }

  function useMyLocation() {

    if (

      locating ||

      loading

    ) {

      return

    }

    setError('')

    setLocationMessage('')

    if (

      !(

        'geolocation' in

        navigator

      )

    ) {

      setLocationMessage(

        'Location is not available in this browser. You can still search manually by city or postcode.',

      )

      return

    }

    setLocating(true)

    navigator.geolocation

      .getCurrentPosition(

        (position) => {

          const latitude =

            position.coords

              .latitude

          const longitude =

            position.coords

              .longitude

          if (

            !Number.isFinite(

              latitude,

            ) ||

            !Number.isFinite(

              longitude,

            )

          ) {

            setLocationMessage(

              'Your location could not be read. You can still search manually by city or postcode.',

            )

            setLocating(

              false,

            )

            return

          }

          setCityInput('')

          setPostalCodeInput('')

          setPage(1)

          setLocationMessage(

            'Using your location to find clinics within 25 km.',

          )

          setLoading(true)

          setFilters({

            city: '',

            postalCode: '',

            q:

              searchInput

                .trim(),

            species:

              speciesInput,

            location: {

              latitude,

              longitude,

              radiusKm: 25,

            },

          })

          setLocating(false)

        },

        (locationError) => {

          if (

            locationError.code ===

            locationError

              .PERMISSION_DENIED

          ) {

            setLocationMessage(

              'Location permission was denied. You can still search manually by city or postcode.',

            )

          } else if (

            locationError.code ===

            locationError

              .POSITION_UNAVAILABLE

          ) {

            setLocationMessage(

              'Your location is currently unavailable. You can still search manually by city or postcode.',

            )

          } else if (

            locationError.code ===

            locationError

              .TIMEOUT

          ) {

            setLocationMessage(

              'Finding your location took too long. You can still search manually by city or postcode.',

            )

          } else {

            setLocationMessage(

              'Your location could not be used. You can still search manually by city or postcode.',

            )

          }

          setLocating(false)

        },

        {

          enableHighAccuracy:

            false,

          timeout:

            10000,

          maximumAge:

            300000,

        },

      )

  }

  function changePage(

    nextPage: number,

  ) {

    if (

      loading ||

      nextPage < 1 ||

      nextPage >

        totalPages

    ) {

      return

    }

    setLoading(true)

    setPage(nextPage)

  }

  return (

    <div className="vet-directory-page">

      <a

        className="skip-link"

        href="#vet-main"

      >

        Skip to content

      </a>

      <header className="header">

        <Link

          className="brand"

          to="/"

        >

          <span

            className="brand-mark"

            aria-hidden="true"

          >

            pp.

          </span>

          <span>

            Purr-Pawsitive

            <small>

              PARADISE

            </small>

          </span>

        </Link>

        <nav aria-label="Directory navigation">

          <Link to="/">

            Home

          </Link>

          <Link to="/pets/cats">

            Pet guides

          </Link>

          <Link to="/account">

            My account

          </Link>

        </nav>

      </header>

      <main

        className="page-width vet-main"

        id="vet-main"

      >

        <nav

          className="vet-breadcrumbs"

          aria-label="Breadcrumb"

        >

          <Link to="/">

            Home

          </Link>

          <span aria-hidden="true">

            /

          </span>

          <span aria-current="page">

            Find a vet

          </span>

        </nav>

        <section

          className="vet-hero"

          aria-labelledby="vet-title"

        >

          <p className="eyebrow">

            CARE STARTS WITH THE RIGHT CONNECTION

          </p>

          <h1 id="vet-title">

            A little help.

            <br />

            <em>

              A lot of care.

            </em>

          </h1>

          <p className="vet-introduction">

            Explore veterinary

            listings manually or,

            if you choose, use

            your device location

            to find nearby

            clinics. You can

            continue using the

            directory without

            sharing location.

          </p>

        </section>

        <section

          className="vet-search-panel"

          aria-labelledby="vet-search-title"

        >

          <h2 id="vet-search-title">

            Find care for your

            companion.

          </h2>

          <form

            onSubmit={

              handleSearch

            }

          >

            <div className="vet-search-grid">

              <div className="vet-field">

                <label htmlFor="vet-city">

                  City

                </label>

                <input

                  id="vet-city"

                  type="search"

                  value={

                    cityInput

                  }

                  onChange={(

                    event,

                  ) =>

                    setCityInput(

                      event.target

                        .value,

                    )

                  }

                  placeholder="For example, Mumbai"

                  maxLength={100}

                />

              </div>

              <div className="vet-field">

                <label htmlFor="vet-postcode">

                  Postcode

                </label>

                <input

                  id="vet-postcode"

                  type="search"

                  value={

                    postalCodeInput

                  }

                  onChange={(

                    event,

                  ) =>

                    setPostalCodeInput(

                      event.target

                        .value,

                    )

                  }

                  placeholder="For example, 400001"

                  maxLength={20}

                  inputMode="numeric"

                />

              </div>

              <div className="vet-field">

                <label htmlFor="vet-species">

                  Your companion

                </label>

                <select

                  id="vet-species"

                  value={

                    speciesInput

                  }

                  onChange={(

                    event,

                  ) =>

                    setSpeciesInput(

                      event.target

                        .value as

                        SpeciesFilter,

                    )

                  }

                >

                  <option value="">

                    All pet groups

                  </option>

                  <option value="CAT">

                    Cats

                  </option>

                  <option value="DOG">

                    Dogs

                  </option>

                  <option value="TURTLE">

                    Turtles

                  </option>

                </select>

              </div>

              <div className="vet-field">

                <label htmlFor="vet-keyword">

                  Vet or clinic name

                </label>

                <input

                  id="vet-keyword"

                  type="search"

                  value={

                    searchInput

                  }

                  onChange={(

                    event,

                  ) =>

                    setSearchInput(

                      event.target

                        .value,

                    )

                  }

                  placeholder="Optional keyword"

                  maxLength={100}

                />

              </div>

            </div>

            <div className="vet-search-actions">

              <button

                className="button dark-button"

                type="submit"

                disabled={

                  loading ||

                  locating

                }

              >

                {loading &&

                !locating

                  ? 'Searching…'

                  : 'Search directory'}

              </button>

              <button

                className="vet-verification-button"

                type="button"

                disabled={

                  loading ||

                  locating

                }

                onClick={

                  useMyLocation

                }

              >

                {locating

                  ? 'Finding your location…'

                  : 'Use my location'}

              </button>

              <button

                className="vet-text-button"

                type="button"

                disabled={

                  locating

                }

                onClick={

                  clearFilters

                }

              >

                Clear filters

              </button>

            </div>

            <p

              style={{

                marginTop:

                  '1rem',

              }}

            >

              <small>

                Location is

                requested only

                after you choose

                “Use my

                location”.

                Manual city

                search remains

                available.

              </small>

            </p>

            {locationMessage && (

              <p

                className="vet-notice"

                role="status"

              >

                {

                  locationMessage

                }

              </p>

            )}

          </form>

        </section>

        <section

          className="vet-results"

          aria-labelledby="vet-results-title"

          aria-busy={

            loading

          }

        >

          <div className="vet-results-heading">

            <div>

              <p className="eyebrow">

                THE DIRECTORY

              </p>

              <h2 id="vet-results-title">

                Explore your

                options.

              </h2>

            </div>

            {!loading &&

              !error && (

                <p role="status">

                  {total}{' '}

                  {total === 1

                    ? 'listing'

                    : 'listings'}{' '}

                  found

                </p>

              )}

          </div>

          {!loading &&

            !error &&

            locationSearch && (

              <p className="vet-demo-notice">

                Showing clinics

                with saved

                coordinates

                {activeRadiusKm !==

                null

                  ? ` within ${activeRadiusKm} km of your location`

                  : ' near your location'}

                . Distance is

                calculated from

                the clinic

                coordinates

                recorded in the

                directory.

              </p>

            )}

          {loading ? (

            <p

              className="vet-notice"

              role="status"

            >

              Finding listings…

            </p>

          ) : error ? (

            <div className="vet-notice">

              <p role="alert">

                {error}

              </p>

              <button

                className="button dark-button"

                type="button"

                onClick={() => {

                  setLoading(

                    true,

                  )

                  setRetry(

                    (

                      value,

                    ) =>

                      value +

                      1,

                  )

                }}

              >

                Try again

              </button>

            </div>

          ) : vets.length ===

            0 ? (

            <div className="vet-notice">

              <h3>

                No listings

                found.

              </h3>

              {locationSearch ? (

                <p>

                  No clinics

                  with recorded

                  coordinates

                  were found

                  within this

                  distance. You

                  can still

                  search

                  manually by

                  city.

                </p>

              ) : (

                <p>

                  Try another

                  city, select

                  all pet

                  groups, or

                  clear your

                  filters. Our

                  directory is

                  still

                  growing.

                </p>

              )}

              <button

                className="vet-text-button"

                type="button"

                onClick={

                  clearFilters

                }

              >

                Clear filters

              </button>

            </div>

          ) : (

            <>

              {vets.some(

                (vet) =>

                  vet.isDemo,

              ) && (

                <p className="vet-demo-notice">

                  Listings

                  marked “Demo”

                  are fictional

                  examples for

                  testing. They

                  are not real

                  care

                  providers.

                </p>

              )}

              <div className="vet-card-grid">

                {vets.map(

                  (vet) => {

                    const website =

                      safeWebsite(

                        vet.websiteUrl,

                      )

                    const telephone =

                      phoneLink(

                        vet.phone,

                      )

                    return (

                      <article

                        className="vet-card"

                        key={

                          vet.id

                        }

                      >

                        <div className="vet-card-top">

                          <p className="eyebrow">

                            {

                              vet.city

                            }

                            ,{' '}

                            {

                              vet.state

                            }

                          </p>

                          {vet.isDemo && (

                            <span className="vet-demo-badge">

                              Demo

                            </span>

                          )}

                        </div>

                        <h3>

                          {

                            vet.clinicName

                          }

                        </h3>

                        {typeof vet.distanceKm ===

                          'number' && (

                          <p>

                            <strong>

                              {

                                vet.distanceKm

                              }{' '}

                              km away

                            </strong>

                          </p>

                        )}

                        <Link

                          className="vet-text-link"

                          to={`/vets/${vet.id}/request`}

                        >

                          Check appointment

                          requests

                        </Link>

                        <p className="vet-name">

                          {

                            vet.vetName

                          }

                        </p>

                        {vet.qualifications && (

                          <p className="vet-qualifications">

                            {

                              vet.qualifications

                            }

                          </p>

                        )}

                        <ul

                          className="vet-species"

                          aria-label="Animals treated"

                        >

                          {vet.species.map(

                            (

                              species,

                            ) => (

                              <li

                                key={

                                  species

                                }

                              >

                                {

                                  speciesLabels[

                                    species

                                  ]

                                }

                              </li>

                            ),

                          )}

                        </ul>

                        {vet.description && (

                          <p className="vet-description">

                            {

                              vet.description

                            }

                          </p>

                        )}

                        <dl className="vet-details">

                          <div>

                            <dt>

                              Address

                            </dt>

                            <dd>

                              {[

                                vet.addressLine1,

                                vet.addressLine2,

                                vet.city,

                                vet.state,

                                vet.postalCode,

                                vet.countryCode,

                              ]

                                .filter(

                                  Boolean,

                                )

                                .join(

                                  ', ',

                                )}

                            </dd>

                          </div>

                          {vet.openingHours && (

                            <div>

                              <dt>

                                Opening

                                hours

                              </dt>

                              <dd>

                                {

                                  vet.openingHours

                                }

                              </dd>

                            </div>

                          )}

                          {!vet.isDemo &&

                            vet.phone && (

                              <div>

                                <dt>

                                  Phone

                                </dt>

                                <dd>

                                  {

                                    vet.phone

                                  }

                                </dd>

                              </div>

                            )}

                          {!vet.isDemo &&

                            vet.email && (

                              <div>

                                <dt>

                                  Email

                                </dt>

                                <dd>

                                  {

                                    vet.email

                                  }

                                </dd>

                              </div>

                            )}

                        </dl>

                        {vet.isDemo ? (

                          <p className="vet-card-note">

                            Demonstration

                            only. Contact

                            and booking

                            are

                            unavailable.

                          </p>

                        ) : (

                          <div className="vet-contact">

                            {(telephone ||

                              website) && (

                              <div className="vet-contact-actions">

                                {telephone && (

                                  <a

                                    className="button dark-button"

                                    href={

                                      telephone

                                    }

                                  >

                                    Call

                                    clinic

                                  </a>

                                )}

                                {website && (

                                  <a

                                    className="vet-text-link"

                                    href={

                                      website

                                    }

                                    target="_blank"

                                    rel="noopener noreferrer"

                                  >

                                    Visit

                                    website

                                  </a>

                                )}

                              </div>

                            )}

                            <p className="vet-card-note">

                              Contact the

                              clinic

                              directly to

                              confirm

                              details. An

                              appointment

                              request is

                              not a

                              confirmed

                              booking.

                            </p>

                            <p>

                              <Link

                                className="vet-text-link"

                                to={`/reports/new?type=VET&id=${encodeURIComponent(

                                  vet.id,

                                )}`}

                                aria-label={`Report an issue with ${vet.clinicName}`}

                              >

                                Report an

                                issue

                              </Link>

                            </p>

                          </div>

                        )}

                      </article>

                    )

                  },

                )}

              </div>

              {totalPages >

                1 && (

                <nav

                  className="vet-pagination"

                  aria-label="Directory pages"

                >

                  <button

                    type="button"

                    disabled={

                      page <= 1 ||

                      loading

                    }

                    onClick={() =>

                      changePage(

                        page -

                          1,

                      )

                    }

                  >

                    Previous

                  </button>

                  <span>

                    Page {page}{' '}

                    of{' '}

                    {

                      totalPages

                    }

                  </span>

                  <button

                    type="button"

                    disabled={

                      page >=

                        totalPages ||

                      loading

                    }

                    onClick={() =>

                      changePage(

                        page +

                          1,

                      )

                    }

                  >

                    Next

                  </button>

                </nav>

              )}

            </>

          )}

        </section>

        <Link

          className="vet-text-link"

          to="/"

        >

          Back to

          Purr-Pawsitive

          Paradise

        </Link>

      </main>

      <footer className="footer">

        <div className="page-width footer-inner">

          <Link

            className="footer-brand"

            to="/"

          >

            Purr-Pawsitive

            Paradise

          </Link>

          <p>

            For the love of

            little companions.

          </p>

          <span>

            ©{' '}

            {new Date()

              .getFullYear()}

          </span>

        </div>

      </footer>

    </div>

  )

}

export default VetDirectory
