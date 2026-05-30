import { Navigate, Route, Routes } from 'react-router-dom'
import MobileShell from './components/MobileShell'
import ScrollToTop from './components/ScrollToTop'
import Education from './screens/Education'
import Evolution from './screens/Evolution'
import Habits from './screens/Habits'
import Home from './screens/Home'
import Login from './screens/Login'
import Profile from './screens/Profile'
import Splash from './screens/Splash'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />
        <Route element={<MobileShell />}>
          <Route path="/home" element={<Home />} />
          <Route path="/evolucao" element={<Evolution />} />
          <Route path="/habitos" element={<Habits />} />
          <Route path="/educacao" element={<Education />} />
          <Route path="/perfil" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
