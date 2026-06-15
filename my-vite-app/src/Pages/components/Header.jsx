import { useState } from "react"
import { Link } from "react-router-dom"
import { useUser } from "../../contexts/UserContext"
import "./Header.css"

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { currentUser } = useUser()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <header className="header">
      <div className="container">
        <div className="logo">
          <Link to="/">
            <h1>TaskFlow</h1>
          </Link>
        </div>

        <div className="menu-icon" onClick={toggleMenu}>
          <div className={`hamburger ${isMenuOpen ? "active" : ""}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        <nav className={`nav ${isMenuOpen ? "active" : ""}`}>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/#features">Features</Link>
            </li>
            <li>
              <Link to="/#about">About</Link>
            </li>
            {currentUser ? (
              <li>
                <Link to="/dashboard" className="btn btn-primary">
                  Dashboard
                </Link>
              </li>
            ) : (
              <>
                <li>
                  <Link to="/login" className="btn btn-outline">
                    Login
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="btn btn-primary">
                    Sign Up
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  )
}

export default Header

