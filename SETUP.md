# Audit Platform - Team Setup Guide

## Prerequisites

- **Node.js** v18+ and npm
- **Python** v3.9+
- **PostgreSQL** database (Supabase recommended)
- **Git**

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd audit_platform
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your actual values (see Backend Environment Variables below)
# Use a text editor to update .env

# Run database migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Start the backend server
npm start
```

Backend will run on `http://localhost:4002`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env if needed (default points to localhost:4002)

# Start the development server
npm run dev
```

Frontend will run on `http://localhost:5173`

### 4. Python Service Setup (Optional - for audit processing)

```bash
cd python_service  # if exists

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the Python service
python main.py
```

Python service will run on `http://localhost:8000`

---

## Backend Environment Variables

Create `backend/.env` file with these variables:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend server port | `4002` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `DATABASE_URL` | Supabase pooler connection (port 6543) | See below |
| `DIRECT_URL` | Direct database connection for migrations (port 5432) | See below |
| `JWT_SECRET` | Secret key for JWT tokens (64+ chars) | Generate with command below |
| `REFRESH_TOKEN_SECRET` | Secret key for refresh tokens (64+ chars) | Generate with command below |
| `JWT_EXPIRES_IN` | JWT token expiration | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token expiration | `7d` |
| `PYTHON_SERVICE_URL` | Python service URL | `http://127.0.0.1:8000` |
| `CORS_ORIGIN` | Allowed frontend origins (comma-separated) | See below |
| `ENABLE_SWAGGER` | Enable API documentation | `false` or `true` |

### Database URL Format (Supabase)

**Important:** For Supabase, you need TWO connection strings:

**DATABASE_URL** (for application runtime - uses connection pooler):
```
postgresql://USERNAME:PASSWORD@HOST:6543/DATABASE?pgbouncer=true&connection_limit=1
```

**DIRECT_URL** (for migrations - direct connection):
```
postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE
```

**Note:** Always include `?pgbouncer=true&connection_limit=1` in `DATABASE_URL` when using Supabase pooler to avoid prepared statement errors.

### Generate Secure Secrets

Run this command to generate secure random secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

Run it twice to generate both `JWT_SECRET` and `REFRESH_TOKEN_SECRET`.

### CORS Origins

List all frontend URLs that should be allowed to access the API (comma-separated, **no spaces**):

```
CORS_ORIGIN=http://localhost:4000,http://localhost:5173,https://your-frontend-domain.com
```

---

## Frontend Environment Variables

Create `frontend/.env` file with:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:4002` (development)<br>`https://your-backend.com` (production) |

---

## Common Issues & Troubleshooting

### 1. Database Connection Errors

**Error:** `prepared statement "s20" does not exist` or `insufficient data left in message`

**Solution:** Make sure your `DATABASE_URL` includes `?pgbouncer=true&connection_limit=1`

### 2. CORS Errors

**Error:** Frontend can't connect to backend

**Solution:** 
- Add your frontend URL to `CORS_ORIGIN` in backend `.env`
- Restart the backend server after changing `.env`

### 3. Migration Errors

**Error:** Migration fails with connection issues

**Solution:** 
- Verify `DIRECT_URL` is correct (port 5432, not 6543)
- Make sure your database user has migration permissions

### 4. JWT Token Errors

**Error:** Invalid token or authentication fails

**Solution:**
- Regenerate `JWT_SECRET` and `REFRESH_TOKEN_SECRET`
- Make sure they're at least 64 characters long
- All users will need to log in again after changing secrets

### 5. Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Windows - kill process on port 4002:
netstat -ano | findstr :4002
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:4002 | xargs kill -9
```

---

## Development Workflow

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Update dependencies (if package.json changed):**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Run migrations (if schema changed):**
   ```bash
   cd backend
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Start development servers:**
   - Backend: `cd backend && npm start`
   - Frontend: `cd frontend && npm run dev`
   - Python: `cd python_service && python main.py` (if needed)

---

## Production Deployment

### Backend

1. Set `NODE_ENV=production` in `.env`
2. Use production database credentials
3. Set `ENABLE_SWAGGER=false` for security
4. Use strong, unique secrets for `JWT_SECRET` and `REFRESH_TOKEN_SECRET`
5. Add production frontend domain to `CORS_ORIGIN`

### Frontend

1. Update `VITE_API_BASE_URL` to production backend URL
2. Build: `npm run build`
3. Deploy the `dist/` folder to your hosting service

---

## Need Help?

- Check the logs: Backend logs show detailed error messages
- Review environment variables: Most issues come from incorrect `.env` values
- Database connection: Test with `npx prisma db pull` to verify connectivity
- Contact the team lead if stuck

---

## Security Reminders

⚠️ **Never commit `.env` files to Git**

✅ `.env` files are already in `.gitignore`

✅ Use `.env.example` as template (safe to commit)

✅ Generate new secrets for production (don't reuse development secrets)

✅ Keep database credentials secure
