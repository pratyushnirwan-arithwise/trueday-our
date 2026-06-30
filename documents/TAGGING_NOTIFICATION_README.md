# Tagging Notification Feature

## Overview

This feature implements email notifications when users are tagged with `@username` in the comment/discussion section of tickets. When a user is mentioned in a comment, they will receive an email notification similar to how email notifications are sent when tickets are assigned to users.

## Implementation Details

### Backend Changes

#### 1. New Functions Added

**`extract_tagged_usernames(message_text)`**
- Extracts usernames that are tagged with `@` symbol from message text
- Uses regex pattern `@([a-zA-Z0-9_-]+)` to match usernames
- Returns a list of unique usernames found in the message

**`send_tagging_notifications(tagged_usernames, ticket_id, commenter_username, message_text)`**
- Sends email notifications to tagged users
- Retrieves ticket information and commenter details from database
- Creates HTML email with ticket details and comment preview
- Sends emails in a background thread to avoid blocking

#### 2. Modified Endpoints

**`/add_ticket_message` (POST)**
- Added tagging detection after message insertion
- Extracts tagged usernames from the message
- Sends notifications in background thread if mentions are found

**`/update_ticket_message` (PUT)**
- Added tagging detection for edited messages
- Sends notifications for mentions in edited comments

### Frontend Integration

The frontend already has a complete mention system implemented in `EditTicket.jsx`:

- **Mention Detection**: Detects `@` symbols in comment input
- **User Suggestions**: Shows dropdown with matching users
- **Mention Selection**: Creates mention spans with `@username` format
- **Visual Highlighting**: Mentions are highlighted in comments

### Email Template

The email notification includes:
- Personalized greeting with the tagged user's name
- Commenter's name who made the mention
- Ticket ID and title
- Preview of the comment (first 200 characters)
- Direct link to view the ticket
- Professional styling with Trueday branding

## How It Works

1. **User Types Comment**: User types a comment in the discussion section
2. **Mention Detection**: User types `@` followed by username
3. **User Selection**: Frontend shows user suggestions and user selects one
4. **Comment Submission**: Comment is sent to backend with `@username` in text
5. **Backend Processing**: 
   - Message is saved to database
   - Backend extracts usernames with `@` pattern
   - For each tagged user, email notification is sent
6. **Email Delivery**: Tagged users receive email notifications

## Testing

Use the provided test script `test_tagging_notification.py` to verify the functionality:

```bash
python test_tagging_notification.py
```

The test script will:
1. Create a test user
2. Create a test ticket
3. Add comments with mentions
4. Edit comments with mentions
5. Verify email notifications are triggered

## Configuration

### Email Settings
The feature uses the existing email configuration in `app.py`:
- SMTP Server: `smtp.office365.com`
- Port: `587`
- TLS: Enabled
- Sender: `ariths@arithwise.com`

### Database Requirements
- Users table must have `username` and `email` fields
- Messages table must have `message_text` field
- Tickets table must have `title` field

## Error Handling

- **Invalid Usernames**: If a mentioned username doesn't exist, no email is sent
- **Email Failures**: Email sending errors are logged but don't block the comment
- **Database Errors**: Database connection issues are handled gracefully
- **Background Processing**: Email sending runs in background thread to avoid blocking

## Security Considerations

- Only valid usernames from the database receive notifications
- Email addresses are retrieved from the database, not from user input
- Background processing prevents email sending from blocking the UI
- Input validation ensures only valid usernames are processed

## Future Enhancements

Potential improvements for the future:
1. **Notification Preferences**: Allow users to opt-out of mention notifications
2. **In-App Notifications**: Add in-app notification badges for mentions
3. **Mention History**: Track and display mention history
4. **Bulk Mentions**: Optimize for multiple mentions in single comment
5. **Mention Analytics**: Track mention frequency and engagement

## Troubleshooting

### Common Issues

1. **Emails Not Sending**
   - Check SMTP configuration in `app.py`
   - Verify email credentials are correct
   - Check backend logs for email errors

2. **Mentions Not Detected**
   - Ensure username exists in database
   - Check regex pattern matches username format
   - Verify comment contains `@username` format

3. **Frontend Mention Suggestions Not Working**
   - Check if users are loaded in frontend
   - Verify mention detection logic in `EditTicket.jsx`
   - Check browser console for JavaScript errors

### Debugging

Enable debug logging in the backend to see:
- Tagged usernames extracted from messages
- Email sending attempts and results
- Database queries and results

## API Endpoints

### Add Message with Mentions
```
POST /add_ticket_message
{
  "ticket_id": 123,
  "user_id": 456,
  "message": "Hey @username, please check this ticket!"
}
```

### Update Message with Mentions
```
PUT /update_ticket_message/{message_id}
{
  "message": "Updated: @username please review this!",
  "user_id": 456
}
```

Both endpoints will automatically detect mentions and send email notifications to tagged users.
