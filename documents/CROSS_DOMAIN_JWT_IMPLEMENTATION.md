# Cross-Domain JWT Authentication Implementation

## 📋 Overview

This document explains the implementation of cross-domain JWT authentication between `https://ariths.com/` (main domain) and `https://trueday.ariths.com/` (subdomain dashboard application).

## 🔍 Problem Statement

**Issue**: Users logging in at the main domain (`ariths.com`) were being redirected to the subdomain (`trueday.ariths.com`) but losing their authentication, causing them to be redirected back to the main domain login page instead of accessing the dashboard.

**Root Cause**: No secure mechanism to share authentication data between different domains.

## 🛠️ Solution Implemented

We implemented a **Cross-Domain JWT Authentication System** that allows secure authentication sharing between the main domain and subdomain.

## 🏗️ Architecture

```
┌─────────────────┐    JWT Token    ┌──────────────────┐
│   Main Domain   │ ──────────────► │   Subdomain      │
│ ariths.com      │                 │ trueday.ariths.com│
│                 │                 │                  │
│ 1. User Login   │                 │ 3. Process JWT   │
│ 2. Generate JWT │                 │ 4. Authenticate  │
│ 3. Redirect     │                 │ 5. Access Dashboard│
└─────────────────┘                 └──────────────────┘
```

## 🔧 Implementation Details

### Backend Changes (`new_backend/app.py`)

#### 1. JWT Token Generation
```python
def generate_jwt_token(user_id, username, email=None):
    """Generate JWT token for cross-domain authentication"""
    payload = {
        'user_id': user_id,
        'username': username,
        'email': email,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=24),  # 24 hour expiration
        'iss': 'trueday.ariths.com',  # Issuer
        'aud': 'trueday.ariths.com'    # Audience
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    return token
```

#### 2. New API Endpoints

**Generate JWT Token** (`POST /api/auth/generate-jwt`)
- **Purpose**: Main domain calls this to generate JWT tokens
- **Input**: `{user_id, username, email}`
- **Output**: `{token, expires_in, user_id, username}`

**Validate JWT Token** (`POST /api/auth/validate-jwt`)
- **Purpose**: Subdomain validates JWT tokens
- **Input**: `{token}`
- **Output**: `{valid, user_id, username, email}`

### Frontend Changes

#### 1. Cross-Domain Authentication Handler (`my-vite-app/src/utils/crossDomainAuth.js`)

**Key Functions**:
- `handleCrossDomainAuth()`: Processes JWT tokens from URL parameters
- `generateDashboardRedirectUrl()`: Creates redirect URLs with JWT tokens
- `hasValidJWTToken()`: Validates JWT token expiration
- `getCurrentUserFromJWT()`: Extracts user information from JWT

#### 2. Enhanced Secure Authentication (`my-vite-app/src/utils/secureAuth.js`)

**Updated Functions**:
- `getSecureUserId()`: Now checks JWT tokens first, then secure tokens
- `storeJWTToken()`: Stores JWT tokens in localStorage
- `validateJWTToken()`: Validates JWT tokens with backend

#### 3. Updated App Component (`my-vite-app/src/App.jsx`)

**ProtectedRoute Changes**:
- Automatically detects JWT tokens in URL
- Processes cross-domain authentication
- Supports both JWT and legacy secure tokens

## 🔄 Authentication Flow

### Step 1: Main Domain Login
```javascript
// After successful login on ariths.com
const response = await fetch('https://trueday.ariths.com/api/auth/generate-jwt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: user.id,
    username: user.username,
    email: user.email
  })
});

const data = await response.json();
const jwtToken = data.token;
```

### Step 2: Redirect to Dashboard
```javascript
// Redirect to dashboard with JWT token
const dashboardUrl = `https://trueday.ariths.com/dashboard?jwt=${jwtToken}`;
window.location.href = dashboardUrl;
```

### Step 3: Subdomain Processing
```javascript
// Automatically handled by handleCrossDomainAuth()
1. Detect JWT token in URL parameters
2. Extract and store token in localStorage
3. Parse user information from token
4. Clean URL (remove JWT parameter)
5. Authenticate user
```

## 📁 Files Modified

### Backend Files
- `new_backend/app.py`
  - Added `generate_jwt_token()` function
  - Added `/api/auth/generate-jwt` endpoint
  - Added `/api/auth/validate-jwt` endpoint
  - Enhanced `decode_token()` function

### Frontend Files
- `my-vite-app/src/utils/crossDomainAuth.js` (NEW)
- `my-vite-app/src/utils/secureAuth.js` (MODIFIED)
- `my-vite-app/src/App.jsx` (MODIFIED)

## 🔐 Security Features

### JWT Token Security
- **Cryptographic Signing**: Uses HMAC-SHA256 with secret key
- **Expiration**: 24-hour token lifetime
- **Issuer/Audience Validation**: Prevents token misuse
- **Cross-Domain Validation**: Backend validates all tokens

### Data Protection
- **Secure Storage**: JWT tokens stored in localStorage
- **Automatic Cleanup**: Expired tokens are automatically removed
- **URL Cleaning**: JWT parameters removed from URL after processing

## 🚀 Integration Guide

### For Main Domain Developers

1. **After User Login**:
```javascript
// Generate JWT token
const jwtResponse = await fetch('https://trueday.ariths.com/api/auth/generate-jwt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: loggedInUser.id,
    username: loggedInUser.username,
    email: loggedInUser.email
  })
});

const jwtData = await jwtResponse.json();
```

2. **Redirect to Dashboard**:
```javascript
// Redirect with JWT token
window.location.href = `https://trueday.ariths.com/dashboard?jwt=${jwtData.token}`;
```

### For Subdomain Developers

The subdomain automatically handles JWT authentication. No additional code is required.

## 🧪 Testing

### Test Scenarios

1. **Successful Cross-Domain Authentication**:
   - Login at `ariths.com`
   - Redirect to `trueday.ariths.com/dashboard?jwt=TOKEN`
   - Verify user is authenticated and can access dashboard

2. **Token Expiration**:
   - Wait for JWT token to expire (24 hours)
   - Verify user is redirected to `ariths.com`

3. **Invalid Token**:
   - Try accessing dashboard with invalid JWT token
   - Verify user is redirected to `ariths.com`

### Debug Information

**Console Logs**:
- `JWT token found in URL, storing for authentication`
- `User info extracted from JWT: {user_id, username}`
- `JWT token processed from URL`

**Backend Logs**:
- `Generated JWT token for user_id: X`
- `Successfully decoded token for user_id: X`

## 🔧 Configuration

### Environment Variables
- `SECRET_KEY`: JWT signing key (must be same across domains)
- `JWT_EXPIRATION`: Token expiration time (default: 24 hours)

### CORS Settings
- Backend configured to allow cross-origin requests
- Headers include `Access-Control-Allow-Origin: *`
- Credentials support enabled

## 📊 Benefits

### For Users
- **Seamless Experience**: No re-login required when switching domains
- **Faster Access**: Direct redirect to dashboard
- **Consistent Authentication**: Single sign-on experience

### For Developers
- **Simple Integration**: Easy to implement on main domain
- **Backward Compatibility**: Works with existing authentication
- **Debug Friendly**: Comprehensive logging and error handling

### For Security
- **Token-Based**: No session data stored in cookies
- **Time-Limited**: Automatic token expiration
- **Cryptographically Secure**: JWT tokens are signed and validated

## 🚨 Troubleshooting

### Common Issues

1. **Token Not Found**:
   - Check if JWT parameter is in URL
   - Verify token generation on main domain

2. **Token Expired**:
   - Check token expiration time
   - Regenerate token on main domain

3. **CORS Errors**:
   - Verify backend CORS configuration
   - Check if endpoints are accessible

### Debug Steps

1. **Check Console Logs**: Look for JWT processing messages
2. **Verify Token**: Use JWT debugger to inspect token contents
3. **Test Endpoints**: Use Postman to test JWT generation/validation
4. **Check Network**: Monitor network requests for authentication calls

## 📈 Future Enhancements

### Potential Improvements
- **Refresh Tokens**: Implement token refresh mechanism
- **Multi-Domain Support**: Extend to support multiple subdomains
- **Token Revocation**: Add ability to revoke tokens
- **Analytics**: Track authentication success rates

### Monitoring
- **Token Usage**: Monitor JWT token generation and validation
- **Error Rates**: Track authentication failures
- **Performance**: Monitor authentication response times

## 📞 Support

For questions or issues related to this implementation:

1. **Check Logs**: Review console and backend logs
2. **Test Endpoints**: Verify JWT generation/validation endpoints
3. **Review Code**: Check implementation against this documentation
4. **Contact Team**: Reach out to the development team for assistance

---

**Last Updated**: January 2025  
**Version**: 1.0  
**Status**: Production Ready ✅
