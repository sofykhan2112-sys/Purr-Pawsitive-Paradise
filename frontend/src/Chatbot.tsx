import {
  useEffect,
  useRef,
  useState,
} from 'react'
import type { FormEvent } from 'react'
import {
  Link,
  useNavigate,
} from 'react-router'
import './Chatbot.css'

type Species = 'CAT' | 'DOG' | 'TURTLE'

type Pet = {
  id: string
  name: string
  species: Species
  breedOrType: string | null
  ageGroup: string | null
}

type ChatSource = {
  id: string
  slug: string
  title: string
  summary: string
  species: Species
  topic: string
  sourceUrls: string[]
  reviewerName: string | null
  reviewerCredentials: string | null
  reviewedAt: string | null
  reviewDueAt: string | null
  publishedAt: string | null
  href: string
}

type ChatAction = {
  label: string
  href: string
}

type UserMessage = {
  id: string
  role: 'user'
  text: string
}

type AssistantMessage = {
  id: string
  role: 'assistant'
  text: string
  mode: string
  sources: ChatSource[]
  actions: ChatAction[]
}

type ChatMessage =
  | UserMessage
  | AssistantMessage

type ChatResponse = {
  mode: string
  message: string
  species?: Species | null
  pet?: Pet | null
  sources?: ChatSource[]
  actions?: ChatAction[]
}

type StoredChat = {
  contextSelection: string
  messages: ChatMessage[]
}

const chatStorageKey =
  'purr-pawsitive-chat-session-v1'

const maxConversationMessages = 40

const speciesLabels: Record<
  Species,
  string
> = {
  CAT: 'Cat',
  DOG: 'Dog',
  TURTLE: 'Turtle',
}

const genericContextOptions = [
  {
    value: 'GENERAL',
    label: 'General pet-care question',
  },
  {
    value: 'SPECIES:CAT',
    label: 'Cat',
  },
  {
    value: 'SPECIES:DOG',
    label: 'Dog',
  },
  {
    value: 'SPECIES:TURTLE',
    label: 'Turtle',
  },
]

const starterPrompts = [
  'How should I care for my pet every day?',
  'What should I know about grooming?',
  'What should I know about feeding?',
]

function createMessageId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function isChatSource(
  value: unknown,
): value is ChatSource {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false
  }

  const source =
    value as Record<string, unknown>

  return (
    typeof source.id === 'string' &&
    typeof source.title === 'string' &&
    typeof source.href === 'string'
  )
}

function isChatAction(
  value: unknown,
): value is ChatAction {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false
  }

  const action =
    value as Record<string, unknown>

  return (
    typeof action.label === 'string' &&
    typeof action.href === 'string'
  )
}

function isStoredMessage(
  value: unknown,
): value is ChatMessage {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false
  }

  const message =
    value as Record<string, unknown>

  if (
    typeof message.id !== 'string' ||
    typeof message.text !== 'string'
  ) {
    return false
  }

  if (message.role === 'user') {
    return true
  }

  if (message.role !== 'assistant') {
    return false
  }

  return (
    typeof message.mode === 'string' &&
    Array.isArray(message.sources) &&
    message.sources.every(
      isChatSource,
    ) &&
    Array.isArray(message.actions) &&
    message.actions.every(
      isChatAction,
    )
  )
}

function readStoredChat():
  StoredChat | null {
  try {
    const raw =
      window.sessionStorage.getItem(
        chatStorageKey,
      )

    if (!raw) {
      return null
    }

    const parsed =
      JSON.parse(raw) as unknown

    if (
      !parsed ||
      typeof parsed !== 'object'
    ) {
      return null
    }

    const stored =
      parsed as Record<string, unknown>

    if (
      typeof stored.contextSelection !==
        'string' ||
      !Array.isArray(stored.messages) ||
      !stored.messages.every(
        isStoredMessage,
      )
    ) {
      return null
    }

    return {
      contextSelection:
        stored.contextSelection,
      messages:
        stored.messages as ChatMessage[],
    }
  } catch {
    return null
  }
}

function formatSpecies(
  species: Species,
) {
  return speciesLabels[species]
}

function Chatbot() {
  const navigate = useNavigate()

  const storedChat = useRef(
    readStoredChat(),
  )

  const [
    contextSelection,
    setContextSelection,
  ] = useState(
    storedChat.current
      ?.contextSelection ?? 'GENERAL',
  )

  const [pets, setPets] =
    useState<Pet[]>([])

  const [petsLoading, setPetsLoading] =
    useState(true)

  const [question, setQuestion] =
    useState('')

  const [messages, setMessages] =
    useState<ChatMessage[]>(
      storedChat.current?.messages ?? [],
    )

    const [sending, setSending] =
    useState(false)
  
  const [
    deletingConversation,
    setDeletingConversation,
  ] = useState(false)
  
  const [error, setError] =
    useState('')
  
  const [
    privacyMessage,
    setPrivacyMessage,
  ] = useState('')

  const [
    unavailableSourceIds,
    setUnavailableSourceIds,
  ] = useState<string[]>([])

  const requestController =
    useRef<AbortController | null>(null)

  const chatEndRef =
    useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadPets() {
      try {
        const response = await fetch(
          '/api/pets',
          {
            credentials:
              'same-origin',
            cache: 'no-store',
            signal:
              controller.signal,
          },
        )

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          if (
            !controller.signal.aborted
          ) {
            setPets([])
          }

          return
        }

        const data = await response
          .json()
          .catch(() => null)

        if (
          response.ok &&
          Array.isArray(data?.pets) &&
          !controller.signal.aborted
        ) {
          setPets(data.pets)
        }
      } catch {
        // General chatbot remains
        // available if pets cannot load.
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setPetsLoading(false)
        }
      }
    }

    void loadPets()

    return () =>
      controller.abort()
  }, [])

  useEffect(() => {
    if (petsLoading) {
      return
    }

    if (
      !contextSelection.startsWith(
        'PET:',
      )
    ) {
      return
    }

    const selectedPetId =
      contextSelection.slice(4)

    const selectedPetExists =
      pets.some(
        (pet) =>
          pet.id === selectedPetId,
      )

    if (!selectedPetExists) {
      setContextSelection(
        'GENERAL',
      )
    }
  }, [
    pets,
    petsLoading,
    contextSelection,
  ])

  useEffect(() => {
    try {
      if (
        messages.length === 0 &&
        contextSelection === 'GENERAL'
      ) {
        window.sessionStorage.removeItem(
          chatStorageKey,
        )
  
        return
      }
  
      const stored: StoredChat = {
        contextSelection,
  
        messages:
          messages.slice(-20),
      }
  
      window.sessionStorage.setItem(
        chatStorageKey,
        JSON.stringify(stored),
      )
    } catch {
      // Chat continues to work if
      // sessionStorage is unavailable.
    }
  }, [
    contextSelection,
    messages,
  ])

  useEffect(() => {
    const sourceIds = [
      ...new Set(
        messages.flatMap(
          (message) =>
            message.role ===
            'assistant'
              ? message.sources.map(
                  (source) =>
                    source.id,
                )
              : [],
        ),
      ),
    ].slice(0, 20)

    if (sourceIds.length === 0) {
      setUnavailableSourceIds(
        [],
      )
      return
    }

    const controller =
      new AbortController()

    async function validateSources() {
      try {
        const response =
          await fetch(
            '/api/chatbot/validate-sources',
            {
              method: 'POST',

              credentials:
                'same-origin',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                ids: sourceIds,
              }),

              signal:
                controller.signal,
            },
          )

        const result =
          await response
            .json()
            .catch(() => null)

        if (
          !response.ok ||
          !Array.isArray(
            result?.availableIds,
          )
        ) {
          return
        }

        const available =
          new Set(
            result.availableIds.filter(
              (id: unknown) =>
                typeof id ===
                'string',
            ),
          )

        if (
          !controller.signal.aborted
        ) {
          setUnavailableSourceIds(
            sourceIds.filter(
              (id) =>
                !available.has(id),
            ),
          )
        }
      } catch {
        // Do not mark sources stale if
        // validation itself failed.
      }
    }

    void validateSources()

    return () =>
      controller.abort()
  }, [messages])

  useEffect(() => {
    chatEndRef.current
      ?.scrollIntoView({
        behavior: 'smooth',
      })
  }, [messages, sending])

  function getSelectedPet() {
    if (
      !contextSelection.startsWith(
        'PET:',
      )
    ) {
      return null
    }

    const petId =
      contextSelection.slice(4)

    return (
      pets.find(
        (pet) =>
          pet.id === petId,
      ) ?? null
    )
  }

  function reportAssistantMessage(
    message: AssistantMessage,
    messageIndex: number,
  ) {
    const previousUserMessage =
      messages
        .slice(0, messageIndex)
        .reverse()
        .find(
          (
            candidate,
          ): candidate is UserMessage =>
            candidate.role ===
            'user',
        )

    if (!previousUserMessage) {
      setError(
        'The question connected to this response could not be found.',
      )
      return
    }

    const reportTargetId =
      crypto.randomUUID()

    const snapshot = {
      question:
        previousUserMessage.text,

      response:
        message.text,

      mode:
        message.mode,
    }

    try {
      sessionStorage.setItem(
        `chatbot-report-target:${reportTargetId}`,
        JSON.stringify(snapshot),
      )
    } catch {
      setError(
        'Browser session storage is unavailable, so this response cannot be prepared for reporting.',
      )
      return
    }

    navigate(
      `/reports/new?type=CHATBOT&id=${encodeURIComponent(
        reportTargetId,
      )}`,
    )
  }

  async function sendQuestion(
    cleanQuestion: string,
  ) {
    if (
      sending ||
      cleanQuestion.length < 3
    ) {
      return
    }

    if (
      messages.length >=
      maxConversationMessages
    ) {
      setError(
        'This conversation has reached its message limit. Start a new conversation to continue.',
      )
      return
    }

    const recentQuestions =
      messages
        .filter(
          (
            message,
          ): message is UserMessage =>
            message.role ===
            'user',
        )
        .slice(-4)
        .map(
          (message) =>
            message.text,
        )

    const userMessage: UserMessage =
      {
        id: createMessageId(),
        role: 'user',
        text: cleanQuestion,
      }

    setMessages(
      (current) => [
        ...current,
        userMessage,
      ],
    )

    setQuestion('')
    setError('')
    setSending(true)

    requestController.current
      ?.abort()

    const controller =
      new AbortController()

    requestController.current =
      controller

    const body: {
      question: string
      species?: Species
      petId?: string
      history?: string[]
    } = {
      question: cleanQuestion,
      history: recentQuestions,
    }

    if (
      contextSelection.startsWith(
        'SPECIES:',
      )
    ) {
      body.species =
        contextSelection.slice(
          'SPECIES:'.length,
        ) as Species
    }

    if (
      contextSelection.startsWith(
        'PET:',
      )
    ) {
      body.petId =
        contextSelection.slice(
          'PET:'.length,
        )
    }

    try {
      const response =
        await fetch(
          '/api/chatbot',
          {
            method: 'POST',

            credentials:
              'same-origin',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(body),

            signal:
              controller.signal,
          },
        )

      const data =
        (await response
          .json()
          .catch(
            () => null,
          )) as
          | ChatResponse
          | {
              message?: string
            }
          | null

      if (!response.ok) {
        throw new Error(
          data?.message ??
            'The assistant could not answer right now.',
        )
      }

      if (
        !data ||
        typeof data.message !==
          'string'
      ) {
        throw new Error(
          'The assistant returned an invalid response.',
        )
      }

      const assistantData =
        data as ChatResponse

      const assistantMessage:
        AssistantMessage = {
        id: createMessageId(),

        role: 'assistant',

        text:
          assistantData.message,

        mode:
          typeof assistantData.mode ===
          'string'
            ? assistantData.mode
            : 'GUIDED_SEARCH',

        sources:
          Array.isArray(
            assistantData.sources,
          )
            ? assistantData.sources
            : [],

        actions:
          Array.isArray(
            assistantData.actions,
          )
            ? assistantData.actions
            : [],
      }

      if (
        !controller.signal.aborted
      ) {
        setMessages(
          (current) => [
            ...current,
            assistantMessage,
          ],
        )
      }
    } catch (requestError) {
      if (
        controller.signal.aborted
      ) {
        return
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The assistant could not answer right now.',
      )
    } finally {
      if (
        !controller.signal.aborted
      ) {
        setSending(false)
      }

      if (
        requestController.current ===
        controller
      ) {
        requestController.current =
          null
      }
    }
  }

  async function submitQuestion(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const cleanQuestion =
      question.trim()

    if (
      cleanQuestion.length < 3
    ) {
      setError(
        'Please enter a question of at least 3 characters.',
      )
      return
    }

    await sendQuestion(
      cleanQuestion,
    )
  }

  async function deleteConversation() {
    if (deletingConversation) {
      return
    }
  
    const confirmed =
      window.confirm(
        'Delete this chatbot conversation from this browser session? Your selected pet or species context will also be cleared.',
      )
  
    if (!confirmed) {
      return
    }
  
    requestController.current
      ?.abort()
  
    requestController.current =
      null
  
    setSending(false)
    setDeletingConversation(true)
    setError('')
    setPrivacyMessage('')
  
    try {
      const response =
        await fetch(
          '/api/chatbot/conversation',
          {
            method: 'DELETE',
  
            credentials:
              'same-origin',
  
            headers: {
              'Content-Type':
                'application/json',
            },
  
            body:
              JSON.stringify({}),
          },
        )
  
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
            : 'Could not confirm conversation deletion.',
        )
      }
  
      setMessages([])
      setQuestion('')
  
      // Removing personalization also clears
      // selected-pet context from future answers.
      setContextSelection(
        'GENERAL',
      )
  
      setUnavailableSourceIds(
        [],
      )
  
      try {
        window.sessionStorage.removeItem(
          chatStorageKey,
        )
      } catch {
        // The in-memory conversation is still removed.
      }
  
      setPrivacyMessage(
        'Conversation deleted. This chatbot does not retain a server-side transcript.',
      )
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete the conversation.',
      )
    } finally {
      setDeletingConversation(
        false,
      )
    }
  }

  function handlePrompt(
    prompt: string,
  ) {
    if (sending) {
      return
    }

    void sendQuestion(prompt)
  }

  const selectedPet =
    getSelectedPet()

  const conversationLimitReached =
    messages.length >=
    maxConversationMessages

  return (
    <main className="chatbot-page">
      <header className="chatbot-header">
        <div className="chatbot-header-inner">
          <Link
            className="chatbot-brand"
            to="/"
          >
            Purr-Pawsitive Paradise
          </Link>

          <nav
            className="chatbot-nav"
            aria-label="Chatbot navigation"
          >
            <Link to="/vets">
              Find a vet
            </Link>

            <Link to="/rapid-relief">
              Rapid Relief
            </Link>

            <Link to="/account">
              My account
            </Link>
          </nav>
        </div>
      </header>

      <section className="chatbot-intro">
        <div>
          <p className="chatbot-eyebrow">
            GUIDED PET CARE
          </p>

          <h1>
            Ask Purr-Pawsitive
          </h1>

          <p className="chatbot-intro-copy">
            Ask questions about cat,
            dog, or turtle care. Answers
            are based on currently
            approved information from
            the Purr-Pawsitive content
            library.
          </p>
        </div>

        <div className="chatbot-safety-note">
          <strong>
            Important
          </strong>

          <div className="chatbot-safety-note">
  <strong>
    Conversation privacy
  </strong>

  <p>
    This conversation is kept
    only in this browser session
    so you can continue chatting.
    The server uses your current
    question and a small amount
    of recent context to answer,
    but this MVP does not store
    a normal chatbot transcript
    in the database.
  </p>

  <p>
    Use Delete conversation to
    clear the browser copy and
    remove the selected pet or
    species context.
  </p>
</div>

          <p>
            This assistant does not
            diagnose conditions,
            prescribe treatment, or
            provide medication doses.
            Urgent concerns should be
            handled by a veterinarian.
          </p>
        </div>
      </section>

      <section className="chatbot-shell">
        <div className="chatbot-toolbar">
          <div className="chatbot-context-field">
            <label
              htmlFor="chatbot-context"
            >
              Ask about
            </label>

            <select
              id="chatbot-context"
              value={
                contextSelection
              }
              onChange={(event) => {
                setContextSelection(
                  event.target.value,
                )

                setError('')
              }}
              disabled={sending}
            >
              <optgroup label="General">
                {genericContextOptions.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </optgroup>

              {pets.length > 0 && (
                <optgroup label="My pets">
                  {pets.map(
                    (pet) => (
                      <option
                        key={pet.id}
                        value={`PET:${pet.id}`}
                      >
                        {pet.name}
                        {' — '}
                        {formatSpecies(
                          pet.species,
                        )}
                      </option>
                    ),
                  )}
                </optgroup>
              )}
            </select>

            {selectedPet && (
              <small>
                Using{' '}
                <strong>
                  {
                    selectedPet.name
                  }
                </strong>
                {' · '}
                {formatSpecies(
                  selectedPet.species,
                )}

                {selectedPet.ageGroup
                  ? ` · ${selectedPet.ageGroup}`
                  : ''}

                {selectedPet.breedOrType
                  ? ` · ${selectedPet.breedOrType}`
                  : ''}
              </small>
            )}
          </div>

          {messages.length > 0 && (
  <button
    className="chatbot-start-over"
    type="button"
    onClick={() =>
      void deleteConversation()
    }
    disabled={
      deletingConversation
    }
  >
    {deletingConversation
      ? 'Deleting conversation…'
      : 'Delete conversation'}
  </button>
)}
        </div>

        <div
          className="chatbot-messages"
          aria-live="polite"
        >

{privacyMessage && (
  <p
    className="chatbot-notice"
    role="status"
  >
    {privacyMessage}
  </p>
)}
          {messages.length === 0 && (
            <div className="chatbot-empty-state">
              <p className="chatbot-empty-eyebrow">
                START A CONVERSATION
              </p>

              <h2>
                What would you like to
                understand?
              </h2>

              <p>
                Choose a general
                species or one of your
                saved pets, then ask a
                care question.
              </p>

              <div className="chatbot-prompt-list">
                {starterPrompts.map(
                  (prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() =>
                        handlePrompt(
                          prompt,
                        )
                      }
                      disabled={
                        sending
                      }
                    >
                      {prompt}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {messages.map(
            (
              message,
              messageIndex,
            ) => {
              if (
                message.role ===
                'user'
              ) {
                return (
                  <article
                    className="chatbot-message chatbot-message-user"
                    key={message.id}
                  >
                    <div className="chatbot-message-label">
                      You
                    </div>

                    <div className="chatbot-bubble">
                      <p>
                        {
                          message.text
                        }
                      </p>
                    </div>
                  </article>
                )
              }

              return (
                <article
                  className="chatbot-message chatbot-message-assistant"
                  key={message.id}
                >
                  <div className="chatbot-message-label">
                    Purr-Pawsitive
                  </div>

                  <div className="chatbot-bubble">
                    <p>
                      {message.text}
                    </p>
                  </div>

                  {message.sources
                    .length > 0 && (
                    <div className="chatbot-sources">
                      <p className="chatbot-source-heading">
                        Reviewed sources
                      </p>

                      <div className="chatbot-source-grid">
                        {message.sources.map(
                          (
                            source,
                          ) => (
                            <article
                              className="chatbot-source-card"
                              key={
                                source.id
                              }
                            >
                              <div>
                                <span className="chatbot-source-species">
                                  {formatSpecies(
                                    source.species,
                                  )}
                                </span>

                                <h3>
                                  {
                                    source.title
                                  }
                                </h3>

                                <p>
                                  {
                                    source.summary
                                  }
                                </p>
                              </div>

                              {source.reviewerName && (
                                <small>
                                  Reviewed
                                  by{' '}
                                  {
                                    source.reviewerName
                                  }

                                  {source.reviewerCredentials
                                    ? ` · ${source.reviewerCredentials}`
                                    : ''}
                                </small>
                              )}

                              {unavailableSourceIds.includes(
                                source.id,
                              ) ? (
                                <div className="chatbot-stale-source">
                                  <strong>
                                    Source no longer currently available
                                  </strong>

                                  <span>
                                    This article may have been archived,
                                    unpublished, or reached its review
                                    expiry since this response was created.
                                  </span>
                                </div>
                              ) : (
                                <Link
                                  className="chatbot-source-link"
                                  to={
                                    source.href
                                  }
                                >
                                  Read reviewed guidance
                                </Link>
                              )}
                            </article>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {message.actions
                    .length > 0 && (
                    <div className="chatbot-actions">
                      {message.actions.map(
                        (
                          action,
                        ) => (
                          <Link
                            key={`${message.id}-${action.label}-${action.href}`}
                            className="chatbot-action-link"
                            to={
                              action.href
                            }
                          >
                            {
                              action.label
                            }
                          </Link>
                        ),
                      )}
                    </div>
                  )}

                  <div className="chatbot-response-tools">
                    <button
                      type="button"
                      className="chatbot-report-button"
                      onClick={() =>
                        reportAssistantMessage(
                          message,
                          messageIndex,
                        )
                      }
                    >
                      Report this response
                    </button>
                  </div>
                </article>
              )
            },
          )}

          {sending && (
            <article className="chatbot-message chatbot-message-assistant">
              <div className="chatbot-message-label">
                Purr-Pawsitive
              </div>

              <div className="chatbot-bubble chatbot-thinking">
                <span>
                  Finding approved
                  guidance…
                </span>
              </div>
            </article>
          )}

          <div ref={chatEndRef} />
        </div>

        {conversationLimitReached && (
          <div
            className="chatbot-limit-notice"
            role="status"
          >
            <strong>
              Conversation limit
              reached.
            </strong>

            <span>
              Start a new conversation
              to continue asking
              questions.
            </span>
          </div>
        )}

        {error && (
          <div
            className="chatbot-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <form
          className="chatbot-composer"
          onSubmit={submitQuestion}
        >
          <label
            className="sr-only"
            htmlFor="chatbot-question"
          >
            Ask a pet-care question
          </label>

          <textarea
            id="chatbot-question"
            value={question}
            onChange={(event) => {
              setQuestion(
                event.target.value,
              )

              if (error) {
                setError('')
              }
            }}
            placeholder="Ask a pet-care question…"
            minLength={3}
            maxLength={500}
            rows={3}
            disabled={
              sending ||
              conversationLimitReached
            }
          />

          <div className="chatbot-composer-footer">
            <small>
              {question.length}/500
            </small>

            <button
              className="chatbot-send-button"
              type="submit"
              disabled={
                sending ||
                question.trim()
                  .length < 3 ||
                conversationLimitReached
              }
            >
              {sending
                ? 'Finding guidance…'
                : 'Ask'}
            </button>
          </div>
        </form>

        <p className="chatbot-disclaimer">
          Purr-Pawsitive provides
          educational guidance only.
          For urgent symptoms,
          diagnosis, treatment, or
          medication advice, contact a
          qualified veterinarian.
        </p>
      </section>
    </main>
  )
}

export default Chatbot