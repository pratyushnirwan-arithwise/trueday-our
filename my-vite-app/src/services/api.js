import axios from 'axios';
import { API_ENDPOINTS } from '../config';

// Create axios instance with default config
const api = axios.create({
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    timeout: 10000, // 10 seconds timeout
});

// Add a request interceptor
api.interceptors.request.use(
    (config) => {
        // Add any auth token here if needed
        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// Add a response interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('Response error:', error.response.status, error.response.data);
            
            if (error.response.status === 401) {
                // Handle unauthorized access - redirect to ariths.com
                window.location.href = 'https://ariths.com/';
            }
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error setting up request:', error.message);
        }
        return Promise.reject(error);
    }
);

// Authentication
export const login = async (credentials) => {
    try {
        const response = await api.post(API_ENDPOINTS.LOGIN, credentials);
        return response.data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

export const register = async (userData) => {
    try {
        const response = await api.post(API_ENDPOINTS.REGISTER, userData);
        return response.data;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
};

// Tickets
export const getTickets = async () => {
    try {
        const response = await api.get(API_ENDPOINTS.TICKETS);
        return response.data;
    } catch (error) {
        console.error('Error fetching tickets:', error);
        throw error;
    }
};

export const getTicketById = async (ticketId) => {
    try {
        const response = await api.get(`${API_ENDPOINTS.SINGLE_TICKET}/${ticketId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching ticket:', error);
        throw error;
    }
};

export const createTicket = async (ticketData) => {
    try {
        const response = await api.post(API_ENDPOINTS.CREATE_TICKET, ticketData);
        return response.data;
    } catch (error) {
        console.error('Error creating ticket:', error);
        throw error;
    }
};

export const updateTicket = async (ticketId, ticketData) => {
    try {
        // Use the correct endpoint for updating tickets
        const response = await api.put(`/tickets/${ticketId}`, ticketData);
        return response.data;
    } catch (error) {
        console.error('Error updating ticket:', error);
        throw error;
    }
};

export const deleteTicket = async (ticketId) => {
    try {
        const response = await api.delete(`${API_ENDPOINTS.PERMANENTLY_DELETE_TICKET}/${ticketId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting ticket:', error);
        throw error;
    }
};

export const permanentlyDeleteTicket = async (ticketId) => {
    try {
        const response = await api.delete(`${API_ENDPOINTS.PERMANENTLY_DELETE_TICKET}/${ticketId}`);
        return response.data;
    } catch (error) {
        console.error('Error permanently deleting ticket:', error);
        throw error;
    }
};

export const moveTicketToDeleted = async (ticketId) => {
    try {
        // Use the correct endpoint for status update
        const response = await api.put(`/api/tickets/${ticketId}/status`, { status: 'DELETED' });
        return response.data;
    } catch (error) {
        console.error('Error moving ticket to deleted:', error);
        throw error;
    }
};

// Statuses
export const getStatuses = async () => {
    try {
        const response = await api.get('/api/status');
        // Ensure all statuses are uppercase
        return response.data.map(status => ({
            ...status,
            name: (status.name || status.status_name).toUpperCase()
        }));
    } catch (error) {
        console.error('Error fetching statuses:', error);
        throw error;
    }
};

export const addStatus = async (statusData) => {
    try {
        // Ensure status is uppercase before sending to API
        const uppercaseStatusData = {
            ...statusData,
            status: statusData.status.toUpperCase()
        };
        const response = await api.post(API_ENDPOINTS.ADD_STATUS, uppercaseStatusData);
        return response.data;
    } catch (error) {
        console.error('Error adding status:', error);
        throw error;
    }
};

// Messages
export const getTicketMessages = async (ticketId) => {
    try {
        const response = await api.get(`${API_ENDPOINTS.TICKET_MESSAGES}/${ticketId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }
};

export const addMessage = async (messageData) => {
    try {
        const response = await api.post(API_ENDPOINTS.MESSAGES, messageData);
        return response.data;
    } catch (error) {
        console.error('Error adding message:', error);
        throw error;
    }
};

// Users
export const getUsers = async () => {
    try {
        const response = await api.get(API_ENDPOINTS.USERS);
        return response.data;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
};

// Projects
export const getProjects = async () => {
    try {
        const response = await api.get(API_ENDPOINTS.PROJECTS);
        return response.data;
    } catch (error) {
        console.error('Error fetching projects:', error);
        throw error;
    }
};

// Attachments
export const uploadAttachment = async (formData) => {
    try {
        const response = await api.post(API_ENDPOINTS.ATTACHMENTS, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error uploading attachment:', error);
        throw error;
    }
};

export const getTicketAttachments = async (ticketId) => {
    try {
        const response = await api.get(`${API_ENDPOINTS.TICKET_ATTACHMENTS}/${ticketId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching attachments:', error);
        throw error;
    }
};

export const deleteAttachment = async (attachmentId) => {
    try {
        const response = await api.delete(`${API_ENDPOINTS.DELETE_ATTACHMENT}/${attachmentId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting attachment:', error);
        throw error;
    }
};

// Metrics and Analytics
export const getTeamPerformance = async () => {
    try {
        const response = await api.get(API_ENDPOINTS.TEAM_PERFORMANCE);
        return response.data;
    } catch (error) {
        console.error('Error fetching team performance:', error);
        throw error;
    }
};

export const getMetricsCards = async () => {
    try {
        const response = await api.get(API_ENDPOINTS.METRICS_CARDS);
        return response.data;
    } catch (error) {
        console.error('Error fetching metrics cards:', error);
        throw error;
    }
};

export const getTaskStatusDistribution = async () => {
    try {
        const response = await api.get(API_ENDPOINTS.TASK_STATUS_DISTRIBUTION);
        return response.data;
    } catch (error) {
        console.error('Error fetching task status distribution:', error);
        throw error;
    }
};

export const getWorkloadDistribution = async () => {
    try {
        const response = await api.get(API_ENDPOINTS.WORKLOAD_DISTRIBUTION);
        return response.data;
    } catch (error) {
        console.error('Error fetching workload distribution:', error);
        throw error;
    }
};

export const getPriorityDistribution = async () => {
    try {
        const response = await api.get(API_ENDPOINTS.PRIORITY_DISTRIBUTION);
        return response.data;
    } catch (error) {
        console.error('Error fetching priority distribution:', error);
        throw error;
    }
};

// Comments (Activity Feed)
export const getTicketComments = async (ticketId) => {
    try {
        const response = await api.get(`/api/timeline/${ticketId}`);
        return response.data.comments || [];
    } catch (error) {
        console.error('Error fetching comments:', error);
        throw error;
    }
};

export const addTicketComment = async (ticketId, commentData) => {
    try {
        const payload = {
            ticket_id: ticketId,
            user_name: commentData.created_by,
            user_id: commentData.user_id,
            comment: commentData.comment
        };
        const response = await api.post(`/api/comments`, payload);
        return response.data;
    } catch (error) {
        console.error('Error adding comment:', error);
        throw error;
    }
};

// Progress Pulse
export const getProgressEntries = async () => {
    try {
        const response = await api.get(API_ENDPOINTS.PROGRESS);
        return response.data;
    } catch (error) {
        console.error('Error fetching progress entries:', error);
        throw error;
    }
};

export const addProgressEntry = async (entryData) => {
    try {
        const response = await api.post(API_ENDPOINTS.PROGRESS, entryData);
        return response.data;
    } catch (error) {
        console.error('Error adding progress entry:', error);
        throw error;
    }
};

// Responses
export const getResponses = async (ticketId) => {
    try {
        const response = await api.get(`${API_ENDPOINTS.GET_TICKET_RESPONSES}/${ticketId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching responses:', error);
        throw error;
    }
};

export const submitResponses = async (responses) => {
    try {
        const response = await api.post(API_ENDPOINTS.SUBMIT_RESPONSES, { responses });
        return response.data;
    } catch (error) {
        console.error('Error submitting responses:', error);
        throw error;
    }
};

// Export all methods
export default {
    // Authentication
    login,
    register,
    
    // Tickets
    getTickets,
    getTicketById,
    createTicket,
    updateTicket,
    deleteTicket,
    permanentlyDeleteTicket,
    moveTicketToDeleted,
    
    // Statuses
    getStatuses,
    addStatus,
    
    // Messages
    getTicketMessages,
    addMessage,
    
    // Comments (Activity Feed)
    getTicketComments,
    addTicketComment,
    
    // Users
    getUsers,
    getProjects,
    
    // Attachments
    uploadAttachment,
    getTicketAttachments,
    deleteAttachment,
    
    // Metrics and Analytics
    getTeamPerformance,
    getMetricsCards,
    getTaskStatusDistribution,
    getWorkloadDistribution,
    getPriorityDistribution,
    
    // Progress Pulse
    getProgressEntries,
    addProgressEntry,
    
    // Responses
    getResponses,
    submitResponses
}; 