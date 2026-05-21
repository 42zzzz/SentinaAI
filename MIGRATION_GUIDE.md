# Migration Guide: Moving SentinaAI to a New GCP Project

This guide outlines the steps required to migrate the SentinaAI project to a new Google Cloud Platform (GCP) account.

## Prerequisites
- A new GCP project created with billing enabled.
- Google Cloud SDK (`gcloud`) installed and configured on your machine.
- Permissions: Owner or Editor IAM roles on the new GCP project.

## Step-by-Step Migration

### 1. Configure Local Environment
Authenticate your local machine to the new account and select the new project:
```bash
gcloud auth login
gcloud config set project [NEW_PROJECT_ID]
gcloud config list
```

### 2. Update Deployment Configuration
Edit the `deploy.ps1` script in the root directory to point to your new project.
1. Open `deploy.ps1` in your code editor.
2. Locate the **CONFIG** section (lines 10-13).
3. Update `$PROJECT` with your new Project ID:
   ```powershell
   $PROJECT = "your-new-project-id"
   ```

### 3. Setup Persistent Data (Manual)
If your application relies on data stored in the previous GCP project (e.g., Firestore databases, Cloud Storage buckets), you must manually migrate this data. This script only handles infrastructure and container deployment.

### 4. Deploy to the New Environment
Once configured, run the deployment script. Ensure you provide the `JWT_SECRET` in your session environment first:

```powershell
# Set the secret
$env:JWT_SECRET = "8c0b2747063bb260fd66047dc7f63f904534556f0e0918d28efff95dd990906f"

# Execute the deployment
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

## Troubleshooting
- **Billing:** If you encounter `The request failed because billing is disabled`, visit the [GCP Billing Console](https://console.cloud.google.com/billing) to enable it for your new project.
- **API Errors:** The `deploy.ps1` script is designed to enable the necessary APIs (Cloud Build, Cloud Run, Artifact Registry) automatically. If it fails, ensure your account has sufficient IAM permissions.
