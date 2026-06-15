import React, { useState } from 'react';
import './Calendar.css';
import { Calendar as CalendarIcon, Plus, Bot, X } from 'lucide-react';
import Sidebar from './components/Sidebar';

const Calendar = () => {
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysInMonth = Array.from({ length: 30 }, (_, i) => i + 1);
  const [events, setEvents] = useState([
    { id: 1, title: 'Team Sync', date: 12 },
    { id: 2, title: 'Product Demo', date: 14 },
    { id: 3, title: 'Design Review', date: 18 }
  ]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [newEvent, setNewEvent] = useState({ title: '', date: '' });

  const handleAddEventClick = (day) => {
    setSelectedDate(day);
    setNewEvent({ ...newEvent, date: day });
    setShowEventModal(true);
  };

  const handleAddEvent = (e) => {
    e.preventDefault();
    const eventToAdd = {
      ...newEvent,
      id: events.length + 1,
      date: parseInt(newEvent.date)
    };
    setEvents([...events, eventToAdd]);
    setNewEvent({ title: '', date: '' });
    setShowEventModal(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEvent(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="calendar-container">
        <Sidebar />
      {/* Sidebar */}
      <div className="sidebar">
        <div>
          <h2><CalendarIcon size={20} style={{ marginRight: 6 }} /> Calendar</h2>
          <button className="create-event" onClick={() => setShowEventModal(true)}>
            <Plus size={16} style={{ marginRight: 6 }} />
            Create Event
          </button>

          {/* Mini Calendar */}
          <div className="mini-calendar">
            <h3>Mini Calendar</h3>
            <p>MAY 2025</p>
          </div>

          {/* Event List */}
          <div className="event-list">
            <h3>Upcoming Events</h3>
            <ul>
              {events.map(event => (
                <li key={event.id}>{event.title} - Apr {event.date}</li>
              ))}
            </ul>
          </div>
        </div>
        <small style={{ marginTop: 40, color: '#9ca3af' }}>v1.0.0</small>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="header">
          <h1>MAY 2025</h1>
          <div className="actions">
            <button>Week View</button>
            <button>Day View</button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="calendar-grid">
          {weekDays.map((day, index) => (
            <div key={index} className="day-cell">
              <strong>{day}</strong>
            </div>
          ))}
          {daysInMonth.map((day) => (
            <div key={day} className="day-cell">
              <div className="date-header">
                <span className="date">{day}</span>
                <button 
                  className="add-event-btn"
                  onClick={() => handleAddEventClick(day)}
                >
                  <Plus size={14} className="plus-icon" />
                </button>
              </div>
              {events
                .filter(event => event.date === day)
                .map(event => (
                  <div key={event.id} className="event">
                    {event.title}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="event-modal">
          <div className="event-modal-content">
            <div className="event-modal-header">
              <h2>Add New Event</h2>
              <button 
                className="close-modal"
                onClick={() => setShowEventModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddEvent}>
              <div className="form-group">
                <label>Event Title</label>
                <input
                  type="text"
                  name="title"
                  value={newEvent.title}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="number"
                  name="date"
                  min="1"
                  max="30"
                  value={newEvent.date}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  Add Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      
    </div>
  );
};

export default Calendar;