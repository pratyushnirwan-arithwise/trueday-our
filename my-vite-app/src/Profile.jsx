import React, { useState } from "react";
import DashboardSidebar from './components/DashboardSidebar';
import './Profile.css';
 
export default function ProfilePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    name: "Bhushan Datey", // Updated name
    email: "bhushan.datey@arithwise.com", // Updated email
    phone: "7385927297",
    location: "Nagpur, Maharashtra",
    bio: "Senior Software Engineer with 5 years of experience. Passionate about solving complex problems and building efficient systems.",
    department: "Engineering",
    position: "Senior Software Engineer", // Updated position
    joinDate: "June 15, 2020",
  });
  const [activeTab, setActiveTab] = useState("activity");
 
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
 
  const handleSaveProfile = () => {
    setIsEditing(false);
    alert("Profile updated successfully!");
  };
 
  const recentActivity = [
    { action: "Resolved ticket #1234", date: "2 hours ago" },
    { action: "Commented on ticket #1230", date: "5 hours ago" },
    { action: "Created ticket #1238", date: "Yesterday at 4:30 PM" },
    { action: "Completed Progress Pulse questionnaire", date: "Yesterday at 2:15 PM" },
    { action: "Earned 50 reward points", date: "2 days ago" },
  ];
 
  const achievements = [
    { name: "Ticket Master", description: "Resolved 50 tickets", date: "March 15, 2023" },
    { name: "First Responder", description: "Responded to 100 tickets within 1 hour", date: "January 10, 2023" },
    { name: "Team Player", description: "Helped 20 colleagues with their tickets", date: "December 5, 2022" },
  ];
 
  return (
    <div className="dashboard-container">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="dashboard-layout">
        <main className="dashboard-main">
        <div className="profile-container">
          <div className="profile-header">
            <h1>Profile</h1>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)}>Edit Profile</button>
            ) : (
              <div className="button-group">
                <button onClick={() => setIsEditing(false)}>Cancel</button>
                <button onClick={handleSaveProfile}>Save Changes</button>
              </div>
            )}
          </div>
 
          <div className="profile-grid">
            <div className="profile-card">
            <div className="avatar-section">
  <label htmlFor="avatar-upload" className="avatar-upload-label">
    <img
      className="avatar"
      src={userData.photo || "Bhushan.png"} // Use uploaded photo or placeholder
      alt={userData.name}
    />
    <input
      id="avatar-upload"
      type="file"
      accept="image/*"
      style={{ display: "none" }}
      onChange={(e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            setUserData({ ...userData, photo: reader.result }); // Update photo in state
          };
          reader.readAsDataURL(file);
        }
      }}
    />
  </label>
  <h2>{userData.name}</h2>
  <p>{userData.position}</p>
</div>
              <div className="info-section">
                <p><strong>Email:</strong> {userData.email}</p>
                <p><strong>Phone:</strong> {userData.phone}</p>
                <p><strong>Location:</strong> {userData.location}</p>
                <p><strong>Department:</strong> {userData.department}</p>
                <p><strong>Joined:</strong> {userData.joinDate}</p>
              </div>
              <div className="badges">
                <span className="badge">React</span>
                <span className="badge">TypeScript</span>
                <span className="badge">Node.js</span>
                <span className="badge">AWS</span>
              </div>
            </div>
 
            <div className="details-section">
              <div className="card">
                <h3>About</h3>
                {isEditing ? (
                  <div className="form-group">
                    <label>Full Name</label>
                    <input value={userData.name} onChange={(e) => setUserData({ ...userData, name: e.target.value })} />
                    <label>Email</label>
                    <input value={userData.email} onChange={(e) => setUserData({ ...userData, email: e.target.value })} />
                    <label>Phone</label>
                    <input value={userData.phone} onChange={(e) => setUserData({ ...userData, phone: e.target.value })} />
                    <label>Location</label>
                    <input value={userData.location} onChange={(e) => setUserData({ ...userData, location: e.target.value })} />
                    <label>Department</label>
                    <input
                      value={userData.department}
                      onChange={(e) => setUserData({ ...userData, department: e.target.value })}
                    />
                    <label>Joined Date</label>
                    <input
                      type="date"
                      value={userData.joinDate}
                      onChange={(e) => setUserData({ ...userData, joinDate: e.target.value })}
                    />
                   
                    <label>Bio</label>
                    <textarea rows={4} value={userData.bio} onChange={(e) => setUserData({ ...userData, bio: e.target.value })}></textarea>
                  </div>
                ) : (
                  <p>{userData.bio}</p>
                )}
              </div>
 
              <div className="tabs">
                <div className="tab-buttons">
                  <button className={activeTab === "activity" ? "active" : ""} onClick={() => setActiveTab("activity")}>Recent Activity</button>
                  <button className={activeTab === "achievements" ? "active" : ""} onClick={() => setActiveTab("achievements")}>Achievements</button>
                </div>
 
                {activeTab === "activity" && (
                  <div className="card">
                    <h3>Recent Activity</h3>
                    <p className="description">Your latest actions and updates</p>
                    <ul>
                      {recentActivity.map((item, idx) => (
                        <li key={idx} className="activity-item">
                          <div className="activity-info">
                            <span>{item.action}</span>
                            <span className="activity-date">{item.date}</span>
                          </div>
                          {idx < recentActivity.length - 1 && <hr />}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
 
                {activeTab === "achievements" && (
                  <div className="card">
                    <h3>Achievements</h3>
                    <p className="description">Milestones you've reached</p>
                    <ul>
                      {achievements.map((item, idx) => (
                        <li key={idx} className="achievement-item">
                          <div className="achievement-info">
                            <strong>{item.name}</strong>
                            <span className="achievement-date">{item.date}</span>
                          </div>
                          <p>{item.description}</p>
                          {idx < achievements.length - 1 && <hr />}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </main>
      </div>
    </div>
  );
}
 