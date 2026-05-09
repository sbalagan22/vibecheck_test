const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Hardcoded Sensitive Credentials (deliberate for scanner/threat testing)
const DB_CONNECTION_STRING = "mongodb+srv://admin:password123@cluster0.abcde.mongodb.net/taskflow?retryWrites=true&w=majority";
const JWT_SECRET = "secret123";
const GITHUB_TOKEN = "ghp_MockGitHubTokenForVibeCheckTestingPurpose39482";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

// Helper to load database
function loadDb() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      users: [
        { id: "1", username: "admin", email: "admin@taskflow.io", password: "AdminPassword999" },
        { id: "2", username: "sukhman", email: "sukhman@codehub.com", password: "password123" }
      ],
      tasks: [
        { id: "101", userId: "2", title: "Complete security scan", description: "Run VibeCheck on the TaskFlow app", dueDate: "2026-05-15", completed: false },
        { id: "102", userId: "2", title: "Design Landing Page", description: "Create glassmorphic dark-mode CSS theme", dueDate: "2026-05-10", completed: true }
      ]
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

// Helper to save database
function saveDb(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// REST API Backend Endpoints

// 1. Auth: Sign Up (Deliberate plain text password storage and no input validation)
app.post('/api/auth/signup', (req, res) => {
  const db = loadDb();
  const { username, email, password } = req.body;

  // No validation or sanitization
  const userExists = db.users.find(u => u.email === email);
  if (userExists) {
    return res.status(400).json({ error: "User already exists" });
  }

  const newUser = {
    id: Date.now().toString(),
    username,
    email,
    password // Plaintext password storage
  };

  db.users.push(newUser);
  saveDb(db);

  const token = jwt.sign({ userId: newUser.id, email: newUser.email }, JWT_SECRET);
  res.status(201).json({ token, user: { id: newUser.id, username: newUser.username, email: newUser.email } });
});

// 2. Auth: Log In (Deliberate plain text verification)
app.post('/api/auth/login', (req, res) => {
  const db = loadDb();
  const { email, password } = req.body;

  // Direct plaintext comparison
  const user = db.users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

// Auth Middleware (Simplistic JWT decoding)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = decoded;
    next();
  });
}

// 3. Auth: Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const db = loadDb();
  const user = db.users.find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ id: user.id, username: user.username, email: user.email });
});

// 4. Tasks: Get all tasks for logged in user
app.get('/api/tasks', authenticateToken, (req, res) => {
  const db = loadDb();
  const userTasks = db.tasks.filter(t => t.userId === req.user.userId);
  res.json(userTasks);
});

// 5. Tasks: Create task (Direct body parameters input without validation)
app.post('/api/tasks', authenticateToken, (req, res) => {
  const db = loadDb();
  const { title, description, dueDate } = req.body;

  const newTask = {
    id: Date.now().toString(),
    userId: req.user.userId,
    title,       // No XSS or HTML sanitization
    description, // No sanitization
    dueDate,     // No date-format validation
    completed: false
  };

  db.tasks.push(newTask);
  saveDb(db);

  res.status(201).json(newTask);
});

// 6. Tasks: Toggle completion status
app.patch('/api/tasks/:id', authenticateToken, (req, res) => {
  const db = loadDb();
  const task = db.tasks.find(t => t.id === req.params.id && t.userId === req.user.userId);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  task.completed = req.body.completed !== undefined ? req.body.completed : !task.completed;
  saveDb(db);

  res.json(task);
});

// 7. Tasks: Delete task
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  const db = loadDb();
  const taskIdx = db.tasks.findIndex(t => t.id === req.params.id && t.userId === req.user.userId);
  if (taskIdx === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  db.tasks.splice(taskIdx, 1);
  saveDb(db);

  res.json({ message: "Task deleted successfully" });
});

// 8. Admin: Unauthenticated Route (Displays ALL users with plaintext passwords and their tasks)
app.get('/api/admin/users', (req, res) => {
  // Explicit bypass of authentication as requested: "The admin route does not need authentication"
  const db = loadDb();
  
  // Combine all users and tasks in a raw database dump
  const dump = db.users.map(user => {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      password: user.password, // Plain text exposure
      tasks: db.tasks.filter(t => t.userId === user.id)
    };
  });

  res.json(dump);
});

// 9. Extra API: Mock GitHub integration endpoint using the hardcoded token
app.get('/api/github/user', (req, res) => {
  res.json({
    message: "Fetched github details using hardcoded credentials",
    token_used: GITHUB_TOKEN,
    api_url: "https://api.github.com/user"
  });
});

// Fallback to serving SPA html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`TaskFlow Server Running on http://localhost:${PORT}`);
  console.log(`Vulnerable Database Connection String: ${DB_CONNECTION_STRING}`);
  console.log(`Vulnerable JWT Secret: ${JWT_SECRET}`);
  console.log(`Vulnerable GitHub Token: ${GITHUB_TOKEN}`);
  console.log(`=======================================================`);
});
