import {
  lazy,
  Suspense,
  useEffect,
} from 'react'

import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router'

import Home from './Home'

const PetGuide = lazy(() => import('./PetGuide'))
const BreedLibrary = lazy(() => import('./BreedLibrary'))
const BreedRecord = lazy(() => import('./BreedRecord'))
const RapidRelief = lazy(() => import('./RapidRelief'))
const Signup = lazy(() => import('./Signup'))
const Login = lazy(() => import('./Login'))
const Account = lazy(() => import('./Account'))

const AdminArticles = lazy(
  () => import('./AdminArticles'),
)

const AdminArticleEditor = lazy(
  () => import('./AdminArticleEditor'),
)

const AdminContentCoverage = lazy(
  () => import('./AdminContentCoverage'),
)

const VetDirectory = lazy(
  () => import('./VetDirectory'),
)

const AdminVets = lazy(
  () => import('./AdminVets'),
)

const AdminVetCreate = lazy(
  () => import('./AdminVetCreate'),
)

const AdminVetEditor = lazy(
  () => import('./AdminVetEditor'),
)

const VetWorkspace = lazy(
  () => import('./VetWorkspace'),
)

const ProviderVetEditor = lazy(
  () => import('./ProviderVetEditor'),
)

const AdminVetBooking = lazy(
  () => import('./AdminVetBooking'),
)

const AppointmentRequest = lazy(
  () => import('./AppointmentRequest'),
)

const VetAppointments = lazy(
  () => import('./VetAppointments'),
)

const MyAppointments = lazy(
  () => import('./MyAppointments'),
)

const VetAvailability = lazy(
  () => import('./VetAvailability'),
)

const VetBlockedDates = lazy(
  () => import('./VetBlockedDates'),
)

const Notifications = lazy(
  () => import('./Notifications'),
)

const AmbulanceDirectory = lazy(
  () => import('./AmbulanceDirectory'),
)

const AdminAmbulances = lazy(
  () => import('./AdminAmbulances'),
)

const AdminAmbulanceCreate = lazy(
  () => import('./AdminAmbulanceCreate'),
)

const AdminAmbulanceEditor = lazy(
  () => import('./AdminAmbulanceEditor'),
)

const AdminAmbulanceHistory = lazy(
  () => import('./AdminAmbulanceHistory'),
)

const AmbulanceWorkspace = lazy(
  () => import('./AmbulanceWorkspace'),
)

const AmbulanceRequests = lazy(
  () => import('./AmbulanceRequests'),
)

const TransportRequestForm = lazy(
  () => import('./TransportRequestForm'),
)

const MyTransportRequests = lazy(
  () => import('./MyTransportRequests'),
)

const MyReports = lazy(
  () => import('./MyReports'),
)

const AdminReports = lazy(
  () => import('./AdminReports'),
)

const AdminReportHistory = lazy(
  () => import('./AdminReportHistory'),
)

const ReportIssue = lazy(
  () => import('./ReportIssue'),
)

const Chatbot = lazy(
  () => import('./Chatbot'),
)

const AdminUsers = lazy(
  () => import('./AdminUsers'),
)

const ForgotPassword = lazy(
  () => import('./ForgotPassword'),
)

const ResetPassword = lazy(
  () => import('./ResetPassword'),
)

const AdminMfaSetup = lazy(
  () => import('./AdminMfaSetup'),
)

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  }, [pathname])

  return null
}

function RouteLoading() {
  return (
    <main className="page-width missing-page">
      <p className="eyebrow">
        PURR-PAWSITIVE PARADISE
      </p>

      <p role="status">
        Loading…
      </p>
    </main>
  )
}

function NotFound() {
  return (
    <main className="page-width missing-page">
      <p className="eyebrow">
        404 / PAGE NOT FOUND
      </p>

      <h1>
        This path needs a
        little redirect.
      </h1>

      <p>
        The page you’re looking
        for isn’t here.
      </p>

      <Link
        className="button dark-button"
        to="/"
      >
        Back to homepage
      </Link>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route
            path="/"
            element={<Home />}
          />

          <Route
            path="/rapid-relief"
            element={<RapidRelief />}
          />

          <Route
            path="/rapid-relief/:slug"
            element={<RapidRelief />}
          />

          <Route
            path="/pets/cats"
            element={
              <PetGuide species="cats" />
            }
          />

          <Route
            path="/pets/dogs"
            element={
              <PetGuide species="dogs" />
            }
          />

          <Route
            path="/pets/turtles"
            element={
              <PetGuide species="turtles" />
            }
          />

          <Route
            path="/pets/:species/breeds"
            element={<BreedLibrary />}
          />

          <Route
            path="/pets/:species/breeds/:slug"
            element={<BreedRecord />}
          />

          <Route
            path="/signup"
            element={<Signup />}
          />

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/account"
            element={<Account />}
          />

          <Route
            path="/reports"
            element={<MyReports />}
          />

          <Route
            path="/reports/new"
            element={<ReportIssue />}
          />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          <Route
            path="/reset-password"
            element={<ResetPassword />}
          />

          <Route
            path="/appointments"
            element={<MyAppointments />}
          />

          <Route
            path="/vets"
            element={<VetDirectory />}
          />

          <Route
            path="/provider/vet"
            element={<VetWorkspace />}
          />

          <Route
            path="/provider/ambulance"
            element={<AmbulanceWorkspace />}
          />

          <Route
            path="/provider/ambulance/requests"
            element={<AmbulanceRequests />}
          />

          <Route
            path="/provider/vet/edit"
            element={<ProviderVetEditor />}
          />

          <Route
            path="/provider/availability/blocks"
            element={<VetBlockedDates />}
          />

          <Route
            path="/admin/articles"
            element={<AdminArticles />}
          />

          <Route
            path="/admin/articles/coverage"
            element={<AdminContentCoverage />}
          />

          <Route
            path="/admin/articles/:id"
            element={<AdminArticleEditor />}
          />

          <Route
            path="/admin/users"
            element={<AdminUsers />}
          />

          <Route
            path="/admin/ambulances/:id"
            element={<AdminAmbulanceEditor />}
          />

          <Route
            path="/admin/ambulances/:id/history"
            element={<AdminAmbulanceHistory />}
          />

          <Route
            path="/vets/:id/request"
            element={<AppointmentRequest />}
          />

          <Route
            path="/admin/vets"
            element={<AdminVets />}
          />

          <Route
            path="/admin/vets/new"
            element={<AdminVetCreate />}
          />

          <Route
            path="/provider/availability"
            element={<VetAvailability />}
          />

          <Route
            path="/admin/ambulances"
            element={<AdminAmbulances />}
          />

          <Route
            path="/ambulances"
            element={<AmbulanceDirectory />}
          />

          <Route
            path="/ambulances/:id/request"
            element={<TransportRequestForm />}
          />

          <Route
            path="/transport-requests"
            element={<MyTransportRequests />}
          />

          <Route
            path="/admin/ambulances/new"
            element={<AdminAmbulanceCreate />}
          />

          <Route
            path="/provider/appointments"
            element={<VetAppointments />}
          />

          <Route
            path="/notifications"
            element={<Notifications />}
          />

          <Route
            path="/admin/vets/:id"
            element={<AdminVetEditor />}
          />

          <Route
            path="/admin/vets/:id/booking"
            element={<AdminVetBooking />}
          />

          <Route
            path="/admin/reports"
            element={<AdminReports />}
          />

          <Route
            path="/admin/reports/:id/history"
            element={<AdminReportHistory />}
          />

          <Route
            path="/chat"
            element={<Chatbot />}
          />

          <Route
            path="/admin/mfa"
            element={<AdminMfaSetup />}
          />

          <Route
            path="*"
            element={<NotFound />}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App