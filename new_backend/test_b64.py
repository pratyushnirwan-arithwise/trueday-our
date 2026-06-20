import base64

# Try to decode a fake JWT
jwt_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxOH0.signature"
try:
    print("Decoding JWT directly:", base64.b64decode(jwt_token + "=" * (-len(jwt_token) % 4)))
except Exception as e:
    print("JWT direct decode failed:", e)

# Try to decode the old secure token format
old_token = base64.b64encode(b"18:1234567890:User:sig").decode('utf-8')
try:
    print("Decoding old token:", base64.b64decode(old_token))
except Exception as e:
    print("Old token decode failed:", e)
