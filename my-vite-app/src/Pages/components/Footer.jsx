import { Link } from "react-router-dom"
import "./Footer.css"

const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>TaskFlow</h3>
            <p>Streamline your team's workflow with our intuitive task management platform.</p>
          </div>

          <div className="footer-section">
            <h3>Quick Links</h3>
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
              <li>
                <Link to="/login">Login</Link>
              </li>
              <li>
                <Link to="/register">Sign Up</Link>
              </li>
            </ul>
          </div>

          <div className="footer-section">
            <h3>Contact</h3>
            <p>Email: info@taskflow.com</p>
            <p>Phone: (123) 456-7890</p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {currentYear} TaskFlow. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

