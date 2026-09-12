import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import MobileShell from './components/MobileShell'
import ScrollToTop from './components/ScrollToTop'
import { brand } from './config/brand'
import Education from './screens/Education'
import Evolution from './screens/Evolution'
import Habits from './screens/Habits'
import Home from './screens/Home'
import Landing from './screens/Landing'
import Login from './screens/Login'
import Pricing from './screens/Pricing'
import Profile from './screens/Profile'
import Splash from './screens/Splash'

export default function App() {
  useEffect(() => {
    document.title = brand.siteTitle
  }, [])

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/splash" element={<Splash />} />
        <Route path="/planos" element={<Pricing />} />
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
