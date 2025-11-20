# CSV Workflow Guide

## 1. Where are the files?
The CSV file used for manually adding customers is located at:
`New_Updates/customers_rows.csv`

## 2. How to add customers daily?

### Step 1: Edit the CSV
1.  Open `New_Updates/customers_rows.csv` in Excel, VS Code, or any text editor.
2.  Add new rows at the bottom.
3.  **Important**: Ensure you keep the header row exactly as it is.
4.  Save the file.

### Step 2: Run the Import Script
1.  Open your terminal (VS Code).
2.  Run the following command:
    ```bash
    npm run local-import
    ```
3.  The script will read the file, add new customers to the database, and update existing ones if the email matches.

## Notes
-   **Date Format**: Use `YYYY-MM-DD` for dates (e.g., `2024-12-31`).
-   **Emails**: The `primary_email` is the unique identifier. If you add a row with an existing email, it will update that customer's details.
