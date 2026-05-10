/* ==========================================================================
   TASKFLOW REACTIVE CLIENT ENGINE
   Reactive Single Page Application (SPA) Controller with State Management
   ========================================================================== */

const API_BASE = '/api';

// 1. Application Core State
const state = {
  token: localStorage.getItem('taskflow_token') || null,
  user: null,
  tasks: [],
  currentFilter: 'all', // 'all', 'active', 'completed'
  currentView: 'landing', // 'landing', 'dashboard', 'admin'
};

// 2. DOM Elements Cache
const elements = {
  viewLanding: document.getElementById('view-landing'),
  viewDashboard: document.getElementById('view-dashboard'),
  viewAdmin: document.getElementById('view-admin'),
  
  navHome: document.getElementById('nav-home'),
  navDashboard: document.getElementById('nav-dashboard'),
  navAdmin: document.getElementById('nav-admin'),
  
  btnLogout: document.getElementById('btn-logout'),
  headerUserName: document.getElementById('header-user-name'),
  
  tabLogin: document.getElementById('tab-login'),
  tabSignup: document.getElementById('tab-signup'),
  formLogin: document.getElementById('form-login'),
  formSignup: document.getElementById('form-signup'),
  
  tasksContainer: document.getElementById('tasks-container'),
  formCreateTask: document.getElementById('form-create-task'),
  formModalCreateTask: document.getElementById('form-modal-create-task'),
  
  // Stats counters
  statTotal: document.getElementById('stat-total-tasks'),
  statActive: document.getElementById('stat-active-tasks'),
  statCompleted: document.getElementById('stat-completed-tasks'),
  statRate: document.getElementById('stat-completion-rate'),
  userDisplayName: document.getElementById('user-display-name'),
  currentDateBadge: document.getElementById('current-date-badge'),
  
  // Modal controllers
  btnTriggerModal: document.getElementById('btn-trigger-task-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  taskModal: document.getElementById('task-modal'),
  
  // Admin controllers
  adminUsersContainer: document.getElementById('admin-users-container'),
  btnRefreshAdmin: document.getElementById('btn-refresh-admin'),
  
  toastContainer: document.getElementById('toast-container'),
};

// 3. Toaster Notification Dispatches
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✨';
  if (type === 'error') icon = '💥';
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toast-in 0.35s ease reverse forwards';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// 4. SPA Router & View Navigator
function navigateTo(viewName) {
  state.currentView = viewName;
  
  // Hide all sections
  elements.viewLanding.classList.remove('active');
  elements.viewDashboard.classList.remove('active');
  elements.viewAdmin.classList.remove('active');
  
  elements.viewLanding.classList.add('hidden');
  elements.viewDashboard.classList.add('hidden');
  elements.viewAdmin.classList.add('hidden');
  
  // Un-highlight nav links
  elements.navHome.classList.remove('active');
  elements.navDashboard.classList.remove('active');
  elements.navAdmin.classList.remove('active');
  
  // Activate selected section
  if (viewName === 'landing') {
    elements.viewLanding.classList.remove('hidden');
    setTimeout(() => elements.viewLanding.classList.add('active'), 50);
    elements.navHome.classList.add('active');
  } 
  else if (viewName === 'dashboard') {
    if (!state.token) {
      showToast('Please login to access your dashboard.', 'error');
      navigateTo('landing');
      return;
    }
    elements.viewDashboard.classList.remove('hidden');
    setTimeout(() => elements.viewDashboard.classList.add('active'), 50);
    elements.navDashboard.classList.add('active');
    loadDashboardData();
  } 
  else if (viewName === 'admin') {
    elements.viewAdmin.classList.remove('hidden');
    setTimeout(() => elements.viewAdmin.classList.add('active'), 50);
    elements.navAdmin.classList.add('active');
    loadAdminData();
  }
}

// 5. Auth State & Session Synchronization
async function initializeSession() {
  // Set date badge
  const options = { month: 'long', year: 'numeric' };
  elements.currentDateBadge.innerText = new Date().toLocaleDateString('en-US', options);

  if (state.token) {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      
      if (res.ok) {
        const user = await res.json();
        setAuthenticatedState(user);
        navigateTo('dashboard');
        return;
      }
    } catch (e) {
      console.error("Session fetch failed", e);
    }
    // Token was expired or invalid
    logout();
  } else {
    setUnauthenticatedState();
  }
}

function setAuthenticatedState(user) {
  state.user = user;
  elements.navDashboard.classList.remove('hidden');
  elements.btnLogout.classList.remove('hidden');
  elements.headerUserName.innerText = `@${user.username}`;
  elements.userDisplayName.innerText = user.username;
}

function setUnauthenticatedState() {
  state.user = null;
  state.token = null;
  localStorage.removeItem('taskflow_token');
  elements.navDashboard.classList.add('hidden');
  elements.btnLogout.classList.add('hidden');
  elements.headerUserName.innerText = '';
}

function logout() {
  setUnauthenticatedState();
  showToast('Securely logged out from session.', 'success');
  navigateTo('landing');
}

// Toggle Auth Panel Tabs
elements.tabLogin.addEventListener('click', () => {
  elements.tabLogin.classList.add('active');
  elements.tabSignup.classList.remove('active');
  elements.formLogin.classList.add('active');
  elements.formSignup.classList.remove('active');
});

elements.tabSignup.addEventListener('click', () => {
  elements.tabSignup.classList.add('active');
  elements.tabLogin.classList.remove('active');
  elements.formSignup.classList.add('active');
  elements.formLogin.classList.remove('active');
});

// Submit Authentication Request (Login)
elements.formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('taskflow_token', data.token);
      state.token = data.token;
      setAuthenticatedState(data.user);
      showToast(`Welcome back, ${data.user.username}!`, 'success');
      elements.formLogin.reset();
      navigateTo('dashboard');
    } else {
      showToast(data.error || 'Authentication failed', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to authentication backend.', 'error');
  }
});

// Submit Authentication Request (Signup)
elements.formSignup.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('signup-username').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('taskflow_token', data.token);
      state.token = data.token;
      setAuthenticatedState(data.user);
      showToast(`Account successfully registered, welcome!`, 'success');
      elements.formSignup.reset();
      navigateTo('dashboard');
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to authentication backend.', 'error');
  }
});

// 6. Task Management Logic (CRUD)
async function loadDashboardData() {
  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      state.tasks = await res.json();
      renderTasks();
    }
  } catch (e) {
    showToast('Error loading your tasks.', 'error');
  }
}

function calculateStats() {
  const total = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const active = total - completed;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  elements.statTotal.innerText = total;
  elements.statCompleted.innerText = completed;
  elements.statActive.innerText = active;
  elements.statRate.innerText = `${rate}%`;
}

function renderTasks() {
  calculateStats();
  elements.tasksContainer.innerHTML = '';

  const filteredTasks = state.tasks.filter(t => {
    if (state.currentFilter === 'active') return !t.completed;
    if (state.currentFilter === 'completed') return t.completed;
    return true; // all
  });

  if (filteredTasks.length === 0) {
    elements.tasksContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🌱</span>
        <p>No tasks found matching your current filters.</p>
      </div>
    `;
    return;
  }

  // Sort: pending first, then by date
  filteredTasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  filteredTasks.forEach(task => {
    const isOverdue = !task.completed && new Date(task.dueDate) < new Date().setHours(0,0,0,0);
    const dateFormatted = new Date(task.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    
    const taskEl = document.createElement('div');
    taskEl.className = `task-card ${task.completed ? 'completed' : ''}`;
    taskEl.id = `task-item-${task.id}`;

    taskEl.innerHTML = `
      <div class="task-left-section">
        <label class="task-checkbox-container">
          <input type="checkbox" class="task-toggle" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
          <span class="task-checkmark"></span>
        </label>
        <div class="task-details">
          <span class="task-title">${task.title}</span>
          <p class="task-desc">${task.description}</p>
          <div class="task-meta">
            <span class="task-date-badge ${isOverdue ? 'overdue' : ''}">
              📅 ${isOverdue ? 'Overdue: ' : ''}${dateFormatted}
            </span>
          </div>
        </div>
      </div>
      <div class="task-actions">
        <button class="task-btn-delete" data-id="${task.id}" title="Delete Task">🗑️</button>
      </div>
    `;

    // Toggle event listener
    taskEl.querySelector('.task-toggle').addEventListener('change', async (e) => {
      const taskId = e.target.getAttribute('data-id');
      await toggleTaskCompletion(taskId, e.target.checked);
    });

    // Delete event listener
    taskEl.querySelector('.task-btn-delete').addEventListener('click', async (e) => {
      const taskId = e.target.getAttribute('data-id');
      await deleteTask(taskId);
    });

    elements.tasksContainer.appendChild(taskEl);
  });
}

// Toggle completion API
async function toggleTaskCompletion(id, completed) {
  try {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}` 
      },
      body: JSON.stringify({ completed })
    });

    if (res.ok) {
      const updated = await res.json();
      state.tasks = state.tasks.map(t => t.id === id ? updated : t);
      renderTasks();
      showToast(completed ? 'Goal completed! Well done.' : 'Goal returned to queue.', 'success');
    }
  } catch (err) {
    showToast('Failed to update task status.', 'error');
  }
}

// Delete task API
async function deleteTask(id) {
  const card = document.getElementById(`task-item-${id}`);
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
  }

  try {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (res.ok) {
      setTimeout(() => {
        state.tasks = state.tasks.filter(t => t.id !== id);
        renderTasks();
        showToast('Task has been deleted.', 'info');
      }, 350);
    } else {
      renderTasks(); // restore UI if failed
    }
  } catch (err) {
    renderTasks();
    showToast('Failed to delete task.', 'error');
  }
}

// Task Creation Handler (Standard Sidebar Form)
elements.formCreateTask.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-desc').value;
  const dueDate = document.getElementById('task-date').value;

  await handleTaskCreation(title, description, dueDate);
  elements.formCreateTask.reset();
});

// Task Creation Handler (Modal Form)
elements.formModalCreateTask.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('modal-task-title').value;
  const description = document.getElementById('modal-task-desc').value;
  const dueDate = document.getElementById('modal-task-date').value;

  await handleTaskCreation(title, description, dueDate);
  elements.formModalCreateTask.reset();
  closeTaskModal();
});

async function handleTaskCreation(title, description, dueDate) {
  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ title, description, dueDate })
    });

    if (res.ok) {
      const newTask = await res.json();
      state.tasks.push(newTask);
      renderTasks();
      showToast('New task queued successfully.', 'success');
    } else {
      showToast('Failed to queue new task.', 'error');
    }
  } catch (e) {
    showToast('Connection error creating task.', 'error');
  }
}

// Filter button active toggles
['all', 'active', 'completed'].forEach(filter => {
  document.getElementById(`filter-${filter}`).addEventListener('click', (e) => {
    ['all', 'active', 'completed'].forEach(f => {
      document.getElementById(`filter-${f}`).classList.remove('active');
    });
    e.target.classList.add('active');
    state.currentFilter = filter;
    renderTasks();
  });
});

// Modal Toggles
elements.btnTriggerModal.addEventListener('click', openTaskModal);
elements.btnCloseModal.addEventListener('click', closeTaskModal);

function openTaskModal() {
  elements.taskModal.classList.remove('hidden');
  setTimeout(() => elements.taskModal.classList.add('active'), 50);
}

function closeTaskModal() {
  elements.taskModal.classList.remove('active');
  setTimeout(() => elements.taskModal.classList.add('hidden'), 300);
}

// 7. Admin Data Engine (Plaintext Credentials Audit)
async function loadAdminData() {
  elements.adminUsersContainer.innerHTML = `
    <div class="empty-state">
      <span>⌛</span>
      <p>Fetching unprotected credentials from mock databases...</p>
    </div>
  `;

  try {
    // Deliberate call without authorization header - testing unauthenticated access!
    const res = await fetch(`${API_BASE}/admin/users`, { headers: { 'Authorization': `Bearer ${process.env.ADMIN_API_TOKEN}` } });
    if (res.ok) {
      const users = await res.json();
      renderAdminPanel(users);
    } else {
      elements.adminUsersContainer.innerHTML = `
        <div class="empty-state">
          <span>❌</span>
          <p>Failed to query admin endpoint. Server returned error.</p>
        </div>
      `;
    }
  } catch (e) {
    elements.adminUsersContainer.innerHTML = `
      <div class="empty-state">
        <span>💥</span>
        <p>Database synchronization failure.</p>
      </div>
    `;
  }
}

function renderAdminPanel(users) {
  elements.adminUsersContainer.innerHTML = '';

  if (users.length === 0) {
    elements.adminUsersContainer.innerHTML = '<p>No registered users found in file systems.</p>';
    return;
  }

  users.forEach(user => {
    const card = document.createElement('div');
    card.className = 'admin-user-card glass-panel glow-red';

    let tasksHTML = '';
    if (user.tasks && user.tasks.length > 0) {
      tasksHTML = user.tasks.map(task => `
        <div class="admin-mini-task ${task.completed ? 'completed' : ''}">
          <span class="admin-mini-title">${task.title}</span>
          <span class="admin-mini-badge ${task.completed ? 'done' : 'pending'}">
            ${task.completed ? 'Done' : 'Active'}
          </span>
        </div>
      `).join('');
    } else {
      tasksHTML = '<p class="panel-desc" style="margin:0;">No tasks created yet</p>';
    }

    card.innerHTML = `
      <div class="admin-user-header">
        <span class="admin-user-name">${user.username}</span>
        <span class="admin-user-email">ID: ${user.id} | ${user.email}</span>
        <div class="admin-password-reveal">
          <span>Plaintext Password:</span>
          <code>${user.password}</code>
        </div>
      </div>
      <h4 class="admin-tasks-heading">Task Pipeline</h4>
      <div class="admin-tasks-mini-list">
        ${tasksHTML}
      </div>
    `;

    elements.adminUsersContainer.appendChild(card);
  });
}

elements.btnRefreshAdmin.addEventListener('click', loadAdminData);

// 8. Event Routing Integrations
elements.navHome.addEventListener('click', (e) => {
  e.preventDefault();
  if (state.token) {
    navigateTo('dashboard');
  } else {
    navigateTo('landing');
  }
});

elements.navDashboard.addEventListener('click', (e) => {
  e.preventDefault();
  navigateTo('dashboard');
});

elements.navAdmin.addEventListener('click', (e) => {
  e.preventDefault();
  navigateTo('admin');
});

elements.btnLogout.addEventListener('click', logout);

// Initialize App Lifecycle on load
window.addEventListener('DOMContentLoaded', initializeSession);
