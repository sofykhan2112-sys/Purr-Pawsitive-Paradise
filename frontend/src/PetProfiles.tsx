import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import './PetProfiles.css'

type Pet = {
  id: string
  name: string
  species: 'CAT' | 'DOG' | 'TURTLE'
  breedOrType: string | null
  ageGroup: string | null
}

const speciesLabels = {
  CAT: 'Cat',
  DOG: 'Dog',
  TURTLE: 'Turtle',
}

function PetProfiles() {
  const navigate = useNavigate()

  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [retry, setRetry] = useState(0)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadPets() {
      setLoading(true)
      setLoadError('')

      try {
        const response = await fetch('/api/pets', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (response.status === 401) {
          navigate('/login', { replace: true })
          return
        }

        const data = await response.json().catch(() => null)

        if (!response.ok || !Array.isArray(data?.pets)) {
          throw new Error(
            typeof data?.message === 'string'
              ? data.message
              : 'Could not load your pets. Please try again.',
          )
        }

        if (!controller.signal.aborted) {
          setPets(data.pets)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load your pets.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadPets()

    return () => controller.abort()
  }, [navigate, retry])

  async function handleAddPet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving || deletingId) return

    const form = event.currentTarget
    const fields = new FormData(form)
    const name = String(fields.get('name') ?? '').trim()

    setFormError('')
    setSuccess('')

    if (!name) {
      setFormError('Please enter your pet’s name.')
      return
    }

    const isEditing = editingPet !== null
    const endpoint = editingPet
      ? `/api/pets/${editingPet.id}`
      : '/api/pets'

    setSaving(true)

    try {
      const response = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          species: String(fields.get('species') ?? ''),
          breedOrType: String(fields.get('breedOrType') ?? '').trim(),
          ageGroup: String(fields.get('ageGroup') ?? '').trim(),
        }),
      })

      if (response.status === 401) {
        navigate('/login', { replace: true })
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setFormError(
          typeof data?.message === 'string'
            ? data.message
            : 'Could not save your pet.',
        )
        return
      }

      setSuccess(
        isEditing
          ? `${name}’s profile has been updated.`
          : `${name} has been added to your companions.`,
      )

      form.reset()
      setShowForm(false)
      setEditingPet(null)
      setRetry((value) => value + 1)
    } catch {
      setFormError(
        'Could not confirm whether your changes were saved. Refresh the page before trying again.',
      )
    } finally {
      setSaving(false)
    }
  }

  function startEditing(pet: Pet) {
    setEditingPet(pet)
    setFormError('')
    setSuccess('')
    setShowForm(true)
  }

  async function handleDelete(pet: Pet) {
    if (saving || deletingId) return

    const confirmed = window.confirm(
      `Delete ${pet.name}’s profile? This cannot be undone.`,
    )

    if (!confirmed) return

    setDeletingId(pet.id)
    setFormError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/pets/${pet.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (response.status === 401) {
        navigate('/login', { replace: true })
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setFormError(
          typeof data?.message === 'string'
            ? data.message
            : 'Could not delete this pet.',
        )
        return
      }

      setPets((current) => current.filter((item) => item.id !== pet.id))

      if (editingPet?.id === pet.id) {
        setEditingPet(null)
        setShowForm(false)
      }

      setSuccess(`${pet.name}’s profile has been deleted.`)
    } catch {
      setFormError(
        'Could not confirm deletion. Refresh the page to check the pet list.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  const busy = saving || deletingId !== null

  return (
    <section className="pet-profiles" aria-labelledby="pet-profiles-title">
      <div className="pet-profiles-heading">
        <div>
          <p className="eyebrow">THE ONES WHO MAKE IT HOME</p>
          <h2 id="pet-profiles-title">Your companions.</h2>
        </div>

        {!showForm && !loading && !loadError && (
          <button
            className="button dark-button account-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setEditingPet(null)
              setFormError('')
              setSuccess('')
              setShowForm(true)
            }}
          >
            Add a pet
          </button>
        )}
      </div>

      {success && (
        <p className="pet-success" role="status">
          {success}
        </p>
      )}

      {formError && !showForm && (
        <p className="account-error" role="alert">
          {formError}
        </p>
      )}

      {loading ? (
        <p className="pet-state" role="status">
          Loading your companions…
        </p>
      ) : loadError ? (
        <div className="pet-state">
          <p role="alert">{loadError}</p>
          <button
            className="button dark-button account-button"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {showForm && (
            <form
              key={editingPet?.id ?? 'new-pet'}
              className="pet-form"
              onSubmit={handleAddPet}
              aria-busy={busy}
            >
              <h3>
                {editingPet
                  ? `Edit ${editingPet.name}’s profile.`
                  : 'Meet your companion.'}
              </h3>

              <p className="pet-form-intro">
                {editingPet
                  ? 'Update their details below. Breed and age are optional.'
                  : 'Start with a few details. Breed and age are optional.'}
              </p>

              <div className="pet-form-grid">
                <div className="pet-field">
                  <label htmlFor="pet-name">Pet name</label>
                  <input
                    id="pet-name"
                    name="name"
                    defaultValue={editingPet?.name ?? ''}
                    placeholder="For example, Milo"
                    maxLength={100}
                    required
                    disabled={busy}
                  />
                </div>

                <div className="pet-field">
                  <label htmlFor="pet-species">Pet group</label>
                  <select
                    id="pet-species"
                    name="species"
                    defaultValue={editingPet?.species ?? ''}
                    required
                    disabled={busy}
                  >
                    <option value="" disabled>
                      Choose a pet group
                    </option>
                    <option value="CAT">Cat</option>
                    <option value="DOG">Dog</option>
                    <option value="TURTLE">Turtle</option>
                  </select>
                </div>

                <div className="pet-field">
                  <label htmlFor="pet-breed">
                    Breed or type — optional
                  </label>
                  <input
                    id="pet-breed"
                    name="breedOrType"
                    defaultValue={editingPet?.breedOrType ?? ''}
                    placeholder="Breed or turtle species, if known"
                    maxLength={100}
                    disabled={busy}
                  />
                </div>

                <div className="pet-field">
                  <label htmlFor="pet-age">
                    Age or age group — optional
                  </label>
                  <input
                    id="pet-age"
                    name="ageGroup"
                    defaultValue={editingPet?.ageGroup ?? ''}
                    placeholder="For example, 2 years or adult"
                    maxLength={50}
                    disabled={busy}
                  />
                </div>
              </div>

              {formError && (
                <p className="account-error" role="alert">
                  {formError}
                </p>
              )}

              <div className="pet-form-actions">
                <button
                  className="button dark-button account-button"
                  type="submit"
                  disabled={busy}
                >
                  {saving
                    ? 'Saving…'
                    : editingPet
                      ? 'Save changes'
                      : 'Save pet'}
                </button>

                <button
                  className="pet-cancel"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setShowForm(false)
                    setEditingPet(null)
                    setFormError('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {pets.length === 0 ? (
            <div className="pet-empty">
              <h3>Every companion has a story.</h3>
              <p>Add your first pet to start their profile.</p>
            </div>
          ) : (
            <div className="pet-profile-grid">
              {pets.map((pet) => (
                <article className="pet-profile-card" key={pet.id}>
                  <span className="pet-species-label">
                    {speciesLabels[pet.species]}
                  </span>

                  <h3>{pet.name}</h3>

                  <dl>
                    <dt>Breed or type</dt>
                    <dd>{pet.breedOrType || 'Not added yet'}</dd>

                    <dt>Age or age group</dt>
                    <dd>{pet.ageGroup || 'Not added yet'}</dd>
                  </dl>

                  <div className="pet-card-actions">
                    <button
                      className="pet-edit-button"
                      type="button"
                      disabled={busy}
                      aria-label={`Edit ${pet.name}`}
                      onClick={() => startEditing(pet)}
                    >
                      Edit
                    </button>

                    <button
                      className="pet-delete-button"
                      type="button"
                      disabled={busy}
                      aria-label={`Delete ${pet.name}`}
                      onClick={() => handleDelete(pet)}
                    >
                      {deletingId === pet.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default PetProfiles