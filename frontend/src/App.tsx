import { useEffect } from 'react'
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router'

import Home from './Home'
import PetGuide from './PetGuide'
import BreedLibrary from './BreedLibrary'
import BreedRecord from './BreedRecord'
import RapidRelief from './RapidRelief'
import Signup from './Signup'
import Login from './Login'
import Account from './Account'
import AdminArticles from './AdminArticles'
import AdminArticleEditor from './AdminArticleEditor'
import AdminContentCoverage from './AdminContentCoverage'
import VetDirectory from './VetDirectory'
import AdminVets from './AdminVets'
import AdminVetCreate from './AdminVetCreate'
import AdminVetEditor from './AdminVetEditor'
import VetWorkspace from './VetWorkspace'
import ProviderVetEditor from './ProviderVetEditor'
import AdminVetBooking from './AdminVetBooking'
import AppointmentRequest from './AppointmentRequest'
import VetAppointments from './VetAppointments'
import MyAppointments from './MyAppointments'
import VetAvailability from './VetAvailability'
import VetBlockedDates from './VetBlockedDates'
import Notifications from './Notifications'
import AmbulanceDirectory from './AmbulanceDirectory'
import AdminAmbulances from './AdminAmbulances'
import AdminAmbulanceCreate from './AdminAmbulanceCreate'
import AdminAmbulanceEditor from './AdminAmbulanceEditor'
import AdminAmbulanceHistory from './AdminAmbulanceHistory'
import AmbulanceWorkspace from './AmbulanceWorkspace'
import AmbulanceRequests from './AmbulanceRequests'
import TransportRequestForm from './TransportRequestForm'
import MyTransportRequests from './MyTransportRequests'
import MyReports from './MyReports'
import AdminReports from './AdminReports'
import AdminReportHistory from './AdminReportHistory'
import ReportIssue from './ReportIssue'
import Chatbot from './Chatbot'
import AdminUsers from './AdminUsers'
import ForgotPassword from './ForgotPassword'
import ResetPassword from './ResetPassword'
import AdminMfaSetup from './AdminMfaSetup'

function ScrollToTop() {
  const { pathname } =
    useLocation()

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  }, [pathname])

  return null
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
    </BrowserRouter>
  )
}

export default App
