# Fluxiflow for Agency

Fluxiflow for Agency is a minimal, modern SaaS project management platform built to help agencies answer:
> What needs to be done, who is responsible, when is it due, and is it completed?

V2 includes **passwordless secure OTP email authentication**, multi-tenant organization scope boundaries, session signatures rotation/revocation, and an MUI-based Team workload control dashboard.

## Tech Stack
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Material-UI, TanStack Query, React Router, Lucide Icons, Axios.
- **Backend**: Python, Django, Django REST Framework, SimpleJWT (custom token rotation), Whitenoise (asset compression), PostgreSQL.
- **Database**: PostgreSQL (UUID keys, fully indexed for fast queries).

---

## Getting Started

### 1. Environment Variables
Copy `.env.example` to `.env` in the root folder:
```bash
cp .env.example .env
```
Provide your database, allowed hosts, and SMTP mail credentials:
```text
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database_name>
```

### 2. Backend Setup
1. Navigate to the backend directory and set up a virtual environment:
   ```bash
   cd backend
   python -m venv venv
   ```
2. Activate the virtual environment:
   - **Windows**: `venv\Scripts\activate`
   - **macOS/Linux**: `source venv/bin/activate`
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Perform database migrations:
   ```bash
   python manage.py migrate
   ```
5. Seed development demo data:
   ```bash
   python manage.py seed_demo
   ```
6. Spin up the local development API server:
   ```bash
   python manage.py runserver
   ```
   The backend API will run on `http://localhost:8000`.

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Run the development Vite dev server:
   ```bash
   npm run dev
   ```
   The web UI will run on `http://localhost:5173`.

---

## Seeding Development Demo Accounts
By running `python manage.py seed_demo`, you create:
- **Admin/Manager**: `muhammedshamil251@gmail.com`
- **Demo Member**: `member@demo.com`
- **Members**: `saleel@demo.com`, `fidha@demo.com`, `shamil@demo.com`
*Note: In development, generated OTP codes log directly to the Django server terminal.*

---

## Testing Backend APIs
You can execute automated API security tests locally inside the backend folder:
```bash
python manage.py test apps.tasks
```

---

## Production Deployment Checklist

To go live with this application, execute the following configuration steps:

### 1. Configure production environment variables in `.env`
Ensure that the following parameters are set:
```ini
DEBUG=False
SECRET_KEY=generate-a-secure-random-secret-key
DATABASE_URL=postgresql://production-user:prod-password@postgres-host:5432/prod-database
ALLOWED_HOSTS=agency.fluxiflow.com
CORS_ALLOWED_ORIGINS=https://agency.fluxiflow.com
SECURE_SSL_REDIRECT=True

# SMTP details for real email dispatch
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-smtp-api-key
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=no-reply@fluxiflow.agency
```

### 2. Collect Static Assets
Collect static assets so that Whitenoise can compress and host them securely:
```bash
python manage.py collectstatic --noinput
```

### 3. Run Production Security Checks
Verify the configurations pass all Django security checks for production environments:
```bash
python manage.py check --deploy
```

### 4. Serve the Backend
Run the backend using a WSGI server such as `gunicorn` (Unix) or `waitress` (Windows):
```bash
gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

### 5. Build and Deploy the Frontend
Compile the React code to static HTML/JS/CSS assets:
```bash
npm run build
```
Upload the compiled contents of the `dist/` directory to a static site host (such as Vercel, Netlify, Cloudflare Pages, Nginx, or AWS S3).
