RetroMaze FPSA procedural sci-fi shooter built with Three.js. Features infinite dungeon generation, dynamic lighting, audio synthesis, and boss battles.🎮 How to PlayWASD: MoveMouse: LookClick: Shoot1-5: Switch Weapons (Blaster, Shotgun, Chaingun, Rocket, BFG)📁 Project Structure/retro-maze-fps
├── /public
│   └── index.html    <-- The Game Code
├── firebase.json     <-- Hosting Config
└── README.md
🚀 Deployment Guide (Google Cloud / Firebase)This project is hosted on Firebase Hosting.1. Install PrerequisitesEnsure you have Node.js installed.npm install -g firebase-tools
firebase login
2. Initialize (First Time Only)firebase init hosting
# Select "Use existing project"
# Public directory: "public"
# SPA: "No"
3. Deploy UpdatesAny time you modify index.html, run this to push changes live:firebase deploy
🛠 Git WorkflowRemember to commit your changes before deploying!# Check changed files
git status

# Stage all changes
git add .

# Commit with a message
git commit -m "Describe your update here"
