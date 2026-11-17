import Home from '../frontend/Home.jsx'
import './App.css'

function App() {
  // Wire onLogin / onRegister to your router when those pages exist, e.g.
  // <Home onLogin={(role) => navigate(`/login?role=${role}`)} onRegister={() => navigate('/register')} />
  return <Home />
}

export default App

