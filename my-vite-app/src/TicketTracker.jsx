import { useState, useEffect } from "react"
import { CalendarIcon, Download, LayoutDashboard, Ticket, BarChart, Activity, ListTodo, Trophy, User, LogOut } from "lucide-react"
import "./TicketTracker.css" // Importing our CSS
import { useNavigate } from "react-router-dom"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import DashboardSidebar from './components/DashboardSidebar';


export default function TicketTracker() {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const navigate = useNavigate();

  // Fetch responses from backend
  const fetchResponses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/answers', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        mode: 'cors'
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Answers endpoint not found. Please check the backend server.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch answers');
      }

      const data = await response.json();
      if (!data || !Array.isArray(data)) {
        console.log('Received data:', data);
        throw new Error('Invalid response format from server');
      }

      console.log('Fetched answers:', data);
      setResponses(data);
    } catch (error) {
      console.error('Error fetching answers:', error);
      setError(error.message || 'Failed to fetch answers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResponses();
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = 'https://ariths.com/';
  };

  const routes = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/tickets', label: 'Tickets', icon: Ticket },
    { path: '/reports', label: 'Reports', icon: BarChart },
    { path: '/progrespulse', label: 'Progress Pulse', icon: Activity },
    { path: '/tickettracker', label: 'Ticket Tracker', icon: ListTodo },
    { path: '/rewards', label: 'Game & Rewards', icon: Trophy },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
  };

  // Filter responses based on search term and date
  const filteredResponses = responses.filter(res => {
    console.log(res.ticket_id);
    const matchesSearch = 
      res.username?.toLowerCase().includes(searchTerm.toLowerCase())||
      res.ticket_id?.toString().includes(searchTerm);
    
    const matchesDate = !selectedDate || 
      new Date(res.created_at).toDateString() === selectedDate.toDateString();
    
    return matchesSearch && matchesDate;
  });

  if (loading) {
    return (
      <div className="dashboard-container">
        <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} open={sidebarOpen} setOpen={setSidebarOpen} />
        <div className="dashboard-layout">
        <main className="dashboard-main">
          <div className="loading">Loading responses...</div>
        </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} open={sidebarOpen} setOpen={setSidebarOpen} />
        <div className="dashboard-layout">
        <main className="dashboard-main">
          <div className="error">{error}</div>
        </main>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="dashboard-layout">
      <main className="dashboard-main">
        <div className="dashboard-content">
        <div className="header" style={{marginTop: "-20px"  , marginBottom: "-10px"}}>
        {/* <img 
            src="/transaction.png" 
            alt="transaction Logo" `
            style={{
              marginRight: '-423px',
              backgroundColor: 'bisque',
              height: '40px', // Adjust height as needed
              width: 'auto',
            }}
          /> */}
          <h1>🎫 Ticket Tracker</h1>
          <div className="filter-row">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="date-picker-container">
              <DatePicker
                selected={selectedDate}
                onChange={handleDateSelect}
                placeholderText="Filter by date"
                dateFormat="yyyy-MM-dd"
                className="date-picker"
              />
              {selectedDate && (
                <button onClick={clearDateFilter} className="clear-date">
                  Clear Date
                </button>
              )}
            </div>

            {/* <button className="export-btn">
              <Download size={16} />
              Export
            </button> */}
          </div>
          </div>

          {/* <div className="table-wrapper">
            <table className="response-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Username</th>
                  <th>Question</th>
                  <th>Response</th>
                  <th>Date</th>
                  <th>Status</th> 
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="loading-cell">Loading responses...</td>
                  </tr>
                ) : filteredResponses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="no-data-cell">No responses found</td>
                  </tr>
                ) : (
                  filteredResponses.map((res) => (
                    <tr key={res.response_id}>
                      <td>{res.ticket_id}</td>
                      <td>{res.username}</td>
                      <td>{res.question_text}</td>
                      <td>
                        {res.selected_option ? (
                          <span className="response-tag">{res.selected_option}</span>
                        ) : (
                          <span className="text-response">{res.text_response || "—"}</span>
                        )}
                      </td>
                      <td>{new Date(res.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div> */}
          <div className="table-wrapper">
  <table className="response-table">
    <thead>
      <tr>
        <th>SrNo</th>
        <th>Ticket ID</th>
        <th>Username</th>
        <th>What did you do today?</th>
        <th>What did you learn today?</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      {loading ? (
        <tr>
          <td colSpan="6" className="loading-cell">Loading answers...</td>
        </tr>
      ) : filteredResponses.length === 0 ? (
        <tr>
          <td colSpan="6" className="no-data-cell">No answers found</td>
        </tr>
      ) : (
        filteredResponses.map((ans, idx) => (
          <tr key={ans.answer_id}>
            <td>{idx + 1}</td>
            <td>{ans.ticket_id}</td>
            <td>{ans.username}</td>
            <td>{ans.text_response_1}</td>
            <td>{ans.text_response_2}</td>
            <td>{ans.created_at ? new Date(ans.created_at).toLocaleDateString() : ''}</td>
          </tr>
        ))
      )}
    </tbody>
  </table>
</div>
        </div>
      </main>
      </div>
    </div>
  );
}
