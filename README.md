Maluxury Invoice Generator

A modern and user-friendly invoice generator built with HTML, CSS, and JavaScript. Maluxury makes it easy to create professional invoices, generate invoice PDFs, and send invoices to customers electronically.

Features
Professional invoice generation
Customer information management
Product and service details
Automatic invoice calculations
PDF invoice generation
Email invoice delivery with EmailJS
Responsive design
Clean and modern user interface
Supabase integration for online data storage
Technologies Used
HTML5 for the page structure
CSS3 for styling and responsive design
JavaScript for functionality and invoice calculations
html2pdf.js for PDF generation
EmailJS for sending invoices via email
Supabase for database functionality
Git & GitHub for version control
Project Structure
maluxury-invoice/
│
├── index.html
├── style.css
├── script.js
│
├── images/
│   └── ...
│
└── README.md
Getting Started
1. Clone the repository
git clone https://github.com/YOUR-USERNAME/maluxury-invoice.git
2. Open the project
cd maluxury-invoice

Open the project in VS Code.

3. Run the project

Because this is a basic HTML/CSS/JavaScript project, you can run it using Live Server in VS Code.

Right-click index.html and select:

Open with Live Server

EmailJS Configuration

Maluxury uses EmailJS to send invoices to customers.

Create an EmailJS account and configure:

Email Service
Email Template
Public Key

Then add your EmailJS credentials to the JavaScript configuration.

emailjs.init({
    publicKey: "YOUR_PUBLIC_KEY"
});
Supabase Configuration

If Supabase is enabled, add your project URL and Publishable key to the application.

const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseKey = "YOUR_SUPABASE_PUBLISHABLE_KEY";

Never expose your Supabase service_role or secret key in frontend JavaScript.

Git Workflow

After making changes:

git add .
git commit -m "Describe your changes"
git push
Deployment

The project can be deployed as a static website using platforms such as Vercel or Netlify.

For example, with Vercel:

Push the project to GitHub.
Connect your GitHub account to Vercel.
Import the maluxury-invoice repository.
Deploy the project.

Every future push to the GitHub repository can automatically trigger a new deployment.

Future Improvements
User authentication
Invoice history
Customer database
Product management
Invoice search and filtering
Custom invoice templates
Online invoice sharing
Payment integration
Business dashboard

Author
Romeo

Built with  HTML, CSS, and JavaScript.

License

This project is currently for personal/business use.