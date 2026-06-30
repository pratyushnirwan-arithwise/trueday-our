import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Regsiter.css"; // Import the CSS file here

const Register = () => {
  const [username, setUsername] = useState(""); // Renamed from setName to setUsername
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(""); // Reset error message

    if (!username || !email || !password) {
      setError("All fields are required.");
      return;
    }

    try {
      const response = await fetch("/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }), // Send data to backend
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Check for unique constraint violation on email
        if (
          errorData.error &&
          errorData.error.toLowerCase().includes('duplicate key value') &&
          errorData.error.toLowerCase().includes('users_email_key')
        ) {
          setError('Email already exists');
        } else {
          setError(errorData.error || 'Registration failed');
        }
        return;
      }

      const data = await response.json();
      alert("Registration Successful!");
      navigate("/login"); // Navigate to login page after successful registration
    } catch (error) {
      console.error("Error:", error);
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center text-gray-800">Register</h2>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <form className="mt-4" onSubmit={handleRegister}>
        <div className="mb-4">
          <label className="block text-gray-700">Username</label>
          <input
            type="text"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Email</label>
          <input
            type="email"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Password</label>
          <input
            type="password"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
          Register
        </button>
      </form>
      <p className="text-sm text-center mt-4">
        Already have an account?{" "}
        <Link to="/login" className="text-blue-600">
          Login
        </Link>
      </p>
    </div>
  );
};

export default Register;
